import csv
import json
import math
import os
from pathlib import Path
import re
from statistics import mean

import requests
from google import genai
from dotenv import load_dotenv
from flask import Flask, jsonify, request

load_dotenv(Path(__file__).resolve().parent / ".env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
from flask_cors import CORS

app = Flask(__name__)
default_origins = ",".join((
    "https://fancy-pudding-438b4a.netlify.app",
    "https://b4a.netlify.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5500",
))
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", default_origins).split(",")
    if origin.strip()
]
CORS(app, origins=FRONTEND_ORIGINS)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "student_analytics_1000.csv")
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "gemma3:4b"
REQUEST_TIMEOUT = 180
MAX_ROWS_PER_RESPONSE = 1000
MAX_CONTEXT_RECORDS = 100

# Fallback context for short follow-ups if the frontend does not send history.
LAST_DATA_QUESTION = None


def to_number(value, default=0.0):
    try:
        cleaned = str(value if value is not None else "").strip().replace("%", "")
        return float(cleaned) if cleaned else default
    except (TypeError, ValueError):
        return default


def safe_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def load_students():
    if not os.path.isfile(CSV_PATH):
        raise FileNotFoundError(
            f"Student dataset not found: {CSV_PATH}. "
            "Expected data/student_analytics_1000.csv."
        )
    with open(CSV_PATH, "r", newline="", encoding="utf-8-sig") as file:
        rows = list(csv.DictReader(file))
    if not rows:
        raise ValueError("The student dataset is empty.")

    import pandas as pd
    from src.student_segmentation import segment_students

    segmented = segment_students(pd.DataFrame(rows))
    return segmented.astype(object).where(pd.notna(segmented), None).to_dict(orient="records")



@app.get("/api/students")
def get_students():
    """Return student records with calculated segmentation categories."""
    try:
        return jsonify({
            "total_students": len(load_students()),
            "students": load_students(),
        })
    except Exception:
        app.logger.exception("Could not load student records")
        return jsonify({"error": "Could not load student records."}), 500


def normalized(value):
    return str(value or "").strip().lower()


def dataset_summary(students):
    departments = sorted({s.get("department", "Unknown") for s in students})
    cgpas = [to_number(s.get("cgpa")) for s in students]
    attendances = [to_number(s.get("attendance_pct")) for s in students]
    success_scores = [to_number(s.get("student_success_score")) for s in students]
    backlogs = [to_number(s.get("backlogs")) for s in students]

    by_department = {}
    for department in departments:
        group = [s for s in students if s.get("department") == department]
        by_department[department] = {
            "student_count": len(group),
            "average_cgpa": round(mean(to_number(s.get("cgpa")) for s in group), 2),
            "average_attendance_pct": round(mean(to_number(s.get("attendance_pct")) for s in group), 2),
            "average_success_score": round(mean(to_number(s.get("student_success_score")) for s in group), 2),
        }

    return {
        "total_students": len(students),
        "average_cgpa": round(mean(cgpas), 2),
        "average_attendance_pct": round(mean(attendances), 2),
        "average_success_score": round(mean(success_scores), 2),
        "students_with_backlogs": sum(value > 0 for value in backlogs),
        "students_below_75_attendance": sum(value < 75 for value in attendances),
        "high_academic_risk": sum(normalized(s.get("academic_risk")) == "high" for s in students),
        "departments": by_department,
    }


def extract_count(question, default=10):
    q = normalized(question)
    patterns = [
        r"\btop\s+(\d{1,4})\b",
        r"\b(?:show|list|give|display)\s+(?:me\s+)?(?:the\s+)?(?:first\s+)?(\d{1,4})\b",
        r"\b(\d{1,4})\s+(?:students|records|rows|people)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, q)
        if match:
            return max(1, min(int(match.group(1)), MAX_ROWS_PER_RESPONSE))
    if any(phrase in q for phrase in (
        "all students", "all records", "give data", "show data", "full list",
        "every student", "their list", "that list", "those students",
        "all of them", "list of them", "list them",
    )):
        return MAX_ROWS_PER_RESPONSE
    return max(1, min(default, MAX_ROWS_PER_RESPONSE))


def find_student_id(question):
    match = re.search(r"\bstu[\s_-]*0*([0-9]+)\b", str(question), re.IGNORECASE)
    if not match:
        return None
    return "STU" + match.group(1).zfill(4)


def ranking_field(question):
    q = normalized(question)
    fields = [
        ("internal_marks", ["internal mark", "internal marks", "internal score"]),
        ("student_success_score", ["success score", "overall score", "performance score"]),
        ("technical_skill_score", ["technical skill", "technical score"]),
        ("mock_interview_score", ["mock interview", "interview score"]),
        ("communication_score", ["communication score", "communication"]),
        ("coding_score", ["coding score", "coding", "programming"]),
        ("aptitude_score", ["aptitude score", "aptitude"]),
        ("attendance_pct", ["attendance"]),
        ("backlogs", ["backlog", "arrear"]),
        ("cgpa", ["cgpa", "gpa", "marks", "mark", "college rank", "rank in college"]),
    ]
    for field, keywords in fields:
        if any(word in q for word in keywords):
            return field
    return "cgpa"


def student_record(index, student, field=None):
    result = {
        "rank": index,
        "student_id": student.get("student_id", ""),
        "department": student.get("department", ""),
        "semester": safe_int(student.get("semester")),
        "cgpa": to_number(student.get("cgpa")),
        "attendance_pct": to_number(student.get("attendance_pct")),
        "backlogs": safe_int(student.get("backlogs")),
        "internal_marks": to_number(student.get("internal_marks")),
        "aptitude_score": to_number(student.get("aptitude_score")),
        "coding_score": to_number(student.get("coding_score")),
        "mock_interview_score": to_number(student.get("mock_interview_score")),
        "technical_skill_score": to_number(student.get("technical_skill_score")),
        "communication_score": to_number(student.get("communication_score")),
        "student_success_score": to_number(student.get("student_success_score")),
        "academic_risk": student.get("academic_risk", ""),
        "placement_risk": student.get("placement_risk", ""),
        "student_category": student.get("student_category", ""),
    }
    if field:
        result["ranked_by"] = field
        result["ranked_value"] = to_number(student.get(field))
    return result


def find_department(question, students):
    q = normalized(question)
    departments = sorted(
        {str(s.get("department", "")).strip() for s in students if s.get("department")},
        key=len,
        reverse=True,
    )
    for department in departments:
        if re.search(r"(?<!\w)" + re.escape(department.lower()) + r"(?!\w)", q):
            return department
    # Common aliases
    aliases = {"computer science": "CSE", "computer science engineering": "CSE",
               "information technology": "IT", "electronics": "ECE",
               "electrical": "EEE", "mechanical engineering": "Mechanical",
               "civil engineering": "Civil"}
    for alias, department in aliases.items():
        if alias in q and any(s.get("department") == department for s in students):
            return department
    return None


def comparison_operator_and_threshold(q, default_threshold=75.0):
    match = re.search(
        r"\b(above|over|greater than|more than|below|under|less than|at least|at most|equal to|exactly)\s*(\d+(?:\.\d+)?)\s*%?",
        q,
    )
    if not match:
        return None, default_threshold
    operator = match.group(1)
    threshold = float(match.group(2))
    if operator in ("above", "over", "greater than", "more than"):
        return "gt", threshold
    if operator in ("below", "under", "less than"):
        return "lt", threshold
    if operator == "at least":
        return "ge", threshold
    if operator == "at most":
        return "le", threshold
    return "eq", threshold


def apply_numeric_filter(selected, column, q, trigger_terms):
    if not any(term in q for term in trigger_terms):
        return selected
    operator, threshold = comparison_operator_and_threshold(q)
    if operator is None:
        return selected
    def keep(student):
        value = to_number(student.get(column))
        return {
            "gt": value > threshold,
            "lt": value < threshold,
            "ge": value >= threshold,
            "le": value <= threshold,
            "eq": value == threshold,
        }[operator]
    return [s for s in selected if keep(s)]


def filter_students(question, students):
    q = normalized(question)
    selected = list(students)

    student_id = find_student_id(question)
    if student_id:
        return [s for s in selected if normalized(s.get("student_id")).upper() == student_id]

    department = find_department(question, students)
    if department:
        selected = [s for s in selected if normalized(s.get("department")) == normalized(department)]

    semester_match = re.search(r"\b(?:semester|sem)\s*(\d+)\b", q)
    if semester_match:
        semester = int(semester_match.group(1))
        selected = [s for s in selected if safe_int(s.get("semester"), -1) == semester]

    year_match = re.search(r"\b(?:year|yr)\s*([1-4])\b|\b(first|second|third|fourth)\s+year\b", q)
    if year_match:
        token = year_match.group(0).lower()
        year_words = {"first": 1, "second": 2, "third": 3, "fourth": 4}
        year = next((value for word, value in year_words.items() if word in token), None)
        if year is None:
            digit_match = re.search(r"[1-4]", token)
            year = int(digit_match.group()) if digit_match else None
        if year:
            selected = [
                s for s in selected
                if math.ceil(safe_int(s.get("semester"), 0) / 2) == year
            ]

    # Apply explicit risk filters.
    if "academic risk" in q or "academic-risk" in q:
        risk = next((level for level in ("high", "moderate", "medium", "low") if level in q), None)
        if risk:
            if risk == "medium":
                risk = "moderate"
            selected = [s for s in selected if normalized(s.get("academic_risk")) == risk]
    elif "placement risk" in q or "placement-risk" in q:
        risk = next((level for level in ("high", "moderate", "medium", "low") if level in q), None)
        if risk:
            if risk == "medium":
                risk = "moderate"
            selected = [s for s in selected if normalized(s.get("placement_risk")) == risk]
    elif "high risk" in q:
        selected = [s for s in selected if normalized(s.get("academic_risk")) == "high"]

    # Numeric filters. Apply only when a relevant column is mentioned.
    numeric_columns = [
        ("cgpa", ["cgpa", "gpa"]),
        ("internal_marks", ["internal mark", "internal marks", "internal score"]),
        ("student_success_score", ["success score"]),
        ("coding_score", ["coding score", "coding", "programming score"]),
        ("aptitude_score", ["aptitude score", "aptitude"]),
        ("technical_skill_score", ["technical skill", "technical score"]),
        ("mock_interview_score", ["mock interview", "interview score"]),
        ("communication_score", ["communication score"]),
    ]
    for column, terms in numeric_columns:
        if any(term in q for term in terms):
            selected = apply_numeric_filter(selected, column, q, terms)
            break

    if "attendance" in q:
        selected = apply_numeric_filter(
            selected, "attendance_pct", q,
            ["attendance", "below", "under", "less than", "above", "over",
             "more than", "at least", "at most", "equal to", "exactly"],
        )

    if "backlog" in q or "arrear" in q:
        if any(word in q for word in ("no backlog", "zero backlog", "without backlog", "no backlogs")):
            selected = [s for s in selected if to_number(s.get("backlogs")) == 0]
        elif any(word in q for word in ("more than", "greater than", "above", "at least", "at most", "below", "under", "less than", "exactly")):
            selected = apply_numeric_filter(selected, "backlogs", q, ["backlog", "arrear"])
        elif not any(word in q for word in ("average", "mean", "how many", "total", "count")):
            selected = [s for s in selected if to_number(s.get("backlogs")) > 0]

    return selected


def is_dataset_question(question, students):
    q = normalized(question)
    data_terms = [
        "student", "students", "dataset", "cgpa", "gpa", "attendance", "backlog",
        "arrear", "department", "semester", "academic risk", "placement risk",
        "success score", "internal mark", "coding score", "aptitude", "mock interview",
        "technical skill", "communication score", "college rank", "top ", "lowest",
        "highest", "records", "those students", "their list", "that list",
        "these students", "risk level", "average", "count", "how many",
    ]
    if find_student_id(question):
        return True
    return any(term in q for term in data_terms)


def wants_records(question):
    q = normalized(question)
    return any(phrase in q for phrase in (
        "list", "show", "display", "give me", "give data", "show data", "records",
        "details", "their list", "those students", "student ids", "all students",
        "top ", "highest", "lowest", "best", "worst", "rank", "bottom ",
    ))


def requested_metric(question):
    q = normalized(question)
    metric_map = [
        ("attendance_pct", ["attendance"]),
        ("internal_marks", ["internal mark", "internal marks", "internal score"]),
        ("student_success_score", ["success score", "overall score", "performance score"]),
        ("technical_skill_score", ["technical skill", "technical score"]),
        ("mock_interview_score", ["mock interview", "interview score"]),
        ("communication_score", ["communication"]),
        ("coding_score", ["coding", "programming"]),
        ("aptitude_score", ["aptitude"]),
        ("backlogs", ["backlog", "arrear"]),
        ("cgpa", ["cgpa", "gpa", "marks", "mark", "rank"]),
    ]
    for field, words in metric_map:
        if any(word in q for word in words):
            return field
    return "cgpa"


def direct_answer(question, students):
    q = normalized(question)
    summary = dataset_summary(students)

    # Single-student lookup.
    student_id = find_student_id(question)
    if student_id:
        match = next((s for s in students if normalized(s.get("student_id")).upper() == student_id), None)
        if not match:
            return {"answer": f"I couldn't find {student_id} in the dataset.", "data": [], "total_matching": 0}
        return {
            "answer": f"Student record for {student_id}:",
            "data": [student_record(1, match)],
            "total_matching": 1,
            "shown": 1,
        }

    # Filter once, then compute averages over that filtered group.
    filtered = filter_students(question, students)

    if any(word in q for word in ("average", "mean", "avg")):
        metric = None
        label = ""
        suffix = ""
        metric_options = [
            ("cgpa", ["cgpa", "gpa"], "CGPA", ""),
            ("attendance_pct", ["attendance"], "attendance", "%"),
            ("student_success_score", ["success score", "success"], "student success score", ""),
            ("backlogs", ["backlog", "arrear"], "backlogs", ""),
            ("internal_marks", ["internal mark", "internal score"], "internal marks", ""),
            ("coding_score", ["coding", "programming"], "coding score", ""),
            ("aptitude_score", ["aptitude"], "aptitude score", ""),
            ("technical_skill_score", ["technical skill", "technical score"], "technical skill score", ""),
            ("communication_score", ["communication"], "communication score", ""),
            ("mock_interview_score", ["mock interview", "interview score"], "mock interview score", ""),
        ]
        for field, terms, display, unit in metric_options:
            if any(term in q for term in terms):
                metric, label, suffix = field, display, unit
                break
        if metric:
            if not filtered:
                return {"answer": "No students match the filters in your question.", "data": [], "total_matching": 0}
            average_value = round(mean(to_number(s.get(metric)) for s in filtered), 2)
            scope = "across all students" if len(filtered) == len(students) else f"for {len(filtered)} matching students"
            return {
                "answer": f"The average {label} {scope} is {average_value}{suffix}.",
                "data": [],
                "total_matching": len(filtered),
            }

    # Counts and percentages should use the filtered group if the question contains filters.
    if any(word in q for word in ("how many", "count", "number of", "total number")):
        if "department" in q and not find_department(question, students):
            departments = sorted({s.get("department", "") for s in students if s.get("department")})
            return {"answer": f"There are {len(departments)} departments: {', '.join(departments)}.", "data": []}
        if "backlog" in q or "arrear" in q:
            count = sum(to_number(s.get("backlogs")) > 0 for s in filtered)
            return {"answer": f"{count} matching students have one or more backlogs.", "data": [], "total_matching": count}
        if "high academic risk" in q or "high risk" in q:
            count = sum(normalized(s.get("academic_risk")) == "high" for s in filtered)
            return {"answer": f"{count} matching students have high academic risk.", "data": [], "total_matching": count}
        if "attendance" in q and not any(op in q for op in ("below", "under", "above", "over", "less than", "more than", "at least", "at most")):
            return {"answer": f"There are {len(filtered)} matching students.", "data": [], "total_matching": len(filtered)}
        return {"answer": f"The dataset contains {len(filtered)} matching students.", "data": [], "total_matching": len(filtered)}

    if "percentage" in q or "percent of" in q:
        if not filtered:
            return {"answer": "No students match the filters in your question.", "data": [], "total_matching": 0}
        count = len(filtered)
        percentage = round(100 * count / len(students), 2)
        return {
            "answer": f"{count} students match these conditions, representing {percentage}% of the full dataset.",
            "data": [],
            "total_matching": count,
        }

    # Department comparisons/rankings.
    if "department" in q and any(word in q for word in ("highest", "best", "top", "average", "compare", "lowest", "worst")):
        departments = list(summary["departments"].items())
        metric = "average_cgpa"
        if "attendance" in q:
            metric = "average_attendance_pct"
        elif "success" in q or "performance" in q:
            metric = "average_success_score"
        reverse = not any(word in q for word in ("lowest", "worst", "ascending"))
        departments.sort(key=lambda item: item[1][metric], reverse=reverse)
        rows = [{"department": department, **metrics} for department, metrics in departments]
        return {
            "answer": f"Departments ranked by {metric.replace('_', ' ')}:",
            "data": rows,
            "total_matching": len(rows),
            "shown": len(rows),
        }

    # Return actual records for list/ranking requests.
    if wants_records(question):
        metric = requested_metric(question)
        reverse = not any(word in q for word in ("lowest", "worst", "ascending", "bottom "))
        # If asking for attendance below a threshold, show the lowest attendance first.
        if "attendance" in q and any(word in q for word in ("below", "under", "less than")):
            reverse = False
            metric = "attendance_pct"
        filtered.sort(key=lambda s: to_number(s.get(metric)), reverse=reverse)
        full_list_requested = any(
            phrase in q
            for phrase in (
                "all students",
                "their list",
                "those students",
                "full list",
                "list of them",
                "list students",
                "list all",
                "show all",
                "all matching",
            )
        )

        limit = extract_count(
            question,
            default=len(filtered) if full_list_requested else 10,
        )
        shown = filtered[:limit]
        records = [student_record(i, student, metric) for i, student in enumerate(shown, 1)]
        return {
            "answer": f"Found {len(filtered)} matching students. Showing {len(shown)}, ranked by {metric.replace('_', ' ')}.",
            "data": records,
            "total_matching": len(filtered),
            "shown": len(shown),
        }

    return None


def resolve_followup(question, history):
    """Resolve clear follow-ups without inheriting stale filters."""
    global LAST_DATA_QUESTION

    q = normalized(question)

    # Standalone questions must never inherit the previous question.
    standalone_phrases = (
        "top ", "bottom ", "highest ", "lowest ",
        "average ", "mean ", "avg ",
        "list students", "show students",
        "rank students", "rank the students",
        "what is the average", "how many students",
    )

    if any(phrase in q for phrase in standalone_phrases):
        return question

    followup_phrases = (
        "their list", "that list", "those students",
        "these students", "show them", "give them",
        "more details", "filter that", "export them",
        "sort them", "sort by",
    )

    if not any(phrase in q for phrase in followup_phrases):
        return question

    previous = None

    if isinstance(history, list):
        for item in reversed(history):
            if not isinstance(item, dict) or item.get("role") != "user":
                continue

            content = str(item.get("content", item.get("message", ""))).strip()
            if content and normalized(content) != q:
                previous = content
                break

    if not previous:
        previous = LAST_DATA_QUESTION

    if not previous:
        return question

    if any(phrase in q for phrase in (
        "their list", "that list", "those students",
        "these students", "show them", "give them",
        "more details", "export them",
    )):
        return previous if wants_records(previous) else previous + " list all matching students"

    if q.startswith("sort by"):
        return previous + " " + question

    return question

def ollama_chat(messages):
    """Generate AI responses using Gemini with automatic retries."""
    import time
    import random

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing from the .env file.")

    client = genai.Client(api_key=GEMINI_API_KEY)
    contents = []
    system_instruction = ""

    for item in messages:
        role = item.get("role", "user")
        content = str(item.get("content", ""))

        if role == "system":
            system_instruction += content + "\n"
        elif role == "assistant":
            contents.append({
                "role": "model",
                "parts": [{"text": content}],
            })
        else:
            contents.append({
                "role": "user",
                "parts": [{"text": content}],
            })

    last_error = None

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
                config={
                    "system_instruction": system_instruction.strip() or None,
                    "temperature": 0.2,
                    "max_output_tokens": 700,
                },
            )

            answer = getattr(response, "text", None)
            if not answer:
                raise RuntimeError("Gemini returned an empty response.")
            return answer

        except Exception as error:
            last_error = error
            error_text = str(error).lower()
            temporary = any(code in error_text for code in (
                "503", "unavailable", "429", "resource_exhausted",
                "500", "502", "504", "deadline"
            ))

            if not temporary or attempt == 2:
                break

            delay = 2 ** (attempt + 1) + random.random()
            print(f"Gemini temporarily unavailable; retrying in {delay:.1f}s.")
            time.sleep(delay)

    raise RuntimeError(f"Gemini could not respond after retries: {last_error}")

@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "ai_provider": "Gemini",
        "api_key_configured": bool(GEMINI_API_KEY),
        "model": GEMINI_MODEL,
        "dataset": str(CSV_PATH),
    })
def fallback_student_recommendations(student):
    """Generate personalized recommendations from actual student metrics."""
    def score(*keys):
        for key in keys:
            if student.get(key) not in (None, ""):
                return to_number(student[key])
        return None

    cgpa = score("cgpa")
    attendance = score("attendance_pct", "attendance")
    coding = score("coding_score")
    aptitude = score("aptitude_score")
    communication = score("communication_score")
    interview = score("mock_interview_score")
    technical = score("technical_skill_score")
    backlogs = score("backlogs")
    assignments = score("assignment_completion_pct")

    priorities = []
    maintain = []

    def add(label, current, target, action, threshold):
        if current is None:
            return
        if current < threshold:
            priorities.append(
                (current, f"{label}: current {current:g}; suggested target {target}. {action}")
            )
        else:
            maintain.append(
                f"{label}: {current:g}. Maintain this strength and keep practising."
            )

    add(
        "Communication score", communication, "80+",
        "Practise spoken communication for 20 minutes daily, explain one technical topic aloud, "
        "and complete a weekly presentation or mock interview.", 75
    )
    add(
        "Aptitude score", aptitude, "85+",
        "Solve 15 quantitative and logical reasoning questions daily and review mistakes.", 75
    )
    add(
        "Coding score", coding, "85+",
        "Practise coding problems regularly, review time complexity, and build a small project.", 75
    )
    add(
        "Technical skill score", technical, "80+",
        "Revise core subject concepts and practise explaining technical solutions.", 75
    )
    add(
        "Mock interview score", interview, "85+",
        "Practise answering project, technical, and behavioural interview questions.", 75
    )

    if attendance is not None:
        if attendance < 75:
            priorities.append((
                -1,
                f"Attendance: current {attendance:g}%. Priority: attend scheduled classes consistently, "
                "check college attendance rules, and make a weekly attendance plan."
            ))
        elif attendance < 85:
            priorities.append((
                -2,
                f"Attendance: current {attendance:g}%. Aim for at least 85% or the college's required "
                "threshold; attend consistently and track attendance weekly."
            ))
        else:
            maintain.append(
                f"Attendance: {attendance:g}%. Maintain consistent attendance."
            )

    if backlogs is not None and backlogs > 0:
        priorities.append((
            -3,
            f"Backlogs: {backlogs:g}. Make a subject-wise revision timetable, practise previous "
            "exam questions, and seek faculty help on difficult topics."
        ))

    if cgpa is not None:
        if cgpa < 6:
            priorities.append((
                -4,
                f"CGPA: {cgpa:g}. Prioritise foundational concepts, weekly revision, and faculty support."
            ))
        elif cgpa < 8.5:
            priorities.append((
                -5,
                f"CGPA: {cgpa:g}. Review lower-scoring subjects and target gradual improvement in "
                "internal assessments and semester examinations."
            ))
        else:
            maintain.append(f"CGPA: {cgpa:g}. Maintain your academic performance.")

    if assignments is not None and assignments < 85:
        priorities.append((
            -6,
            f"Assignment completion: {assignments:g}%. Use a weekly deadline tracker and complete "
            "pending assignments before starting new tasks."
        ))

    priorities.sort(key=lambda item: item[0])
    actions = [item[1] for item in priorities]

    if not actions:
        actions = [
            "Maintain current performance and review all available scores monthly.",
            "Set a measurable skill-development goal and track progress weekly.",
            "Continue practising interview and subject-specific questions."
        ]

    return (
        "OVERALL ASSESSMENT\n"
        "Recommendations are based on the available student records. Focus first on the improvement "
        "areas listed below.\n\n"
        "WHAT YOU NEED TO IMPROVE\n"
        + "\n".join(f"{i}. {item}" for i, item in enumerate(actions, 1))
        + "\n\nWHAT TO MAINTAIN\n"
        + ("\n".join(f"- {item}" for item in maintain) if maintain else
           "- Keep tracking your academic and skill performance each week.")
        + "\n\nPRIORITY ACTIONS\n"
        + "\n".join(f"{i}. {item.split('. ', 1)[-1]}" for i, item in enumerate(actions[:3], 1))
        + "\n\n30-DAY PLAN\n"
        "Week 1: Establish a baseline and schedule practice for your top improvement areas.\n"
        "Week 2: Follow the schedule and record completed activities and difficult topics.\n"
        "Week 3: Take a practice assessment and focus on mistakes.\n"
        "Week 4: Repeat the assessment, compare results, and plan the next improvement cycle.\n\n"
        "Note: This fallback uses available dataset metrics, not a Gemini-generated assessment."
    )


@app.post("/api/recommendations")
def student_recommendations():
    body = request.get_json(silent=True) or {}
    student_id = str(body.get("student_id", "")).strip().upper()

    if not student_id:
        return jsonify({"error": "student_id is required"}), 400

    try:
        students = load_students()
        student = next(
            (row for row in students
             if str(row.get("student_id", "")).strip().upper() == student_id),
            None
        )

        if student is None:
            return jsonify({"error": "Student not found"}), 404

        try:
            prompt = [
                {
                    "role": "system",
                    "content": (
                        "You are EduPulse AI, a student improvement coach. "
                        "Focus on what the student should improve, why, measurable targets, "
                        "specific actions, three priorities, and a four-week plan. "
                        "Use only the supplied student data. Do not invent facts. "
                        "Briefly mention strengths worth maintaining."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Give personalized improvement recommendations for this student. "
                        "Identify weaknesses and rank them by priority. Student data:\\n"
                        + json.dumps(student, ensure_ascii=False)
                    ),
                },
            ]
            answer = ollama_chat(prompt)
            source = "gemini"
        except Exception as ai_error:
            app.logger.warning(
                "Gemini recommendations unavailable for %s; using dataset fallback: %s",
                student_id, ai_error
            )
            answer = fallback_student_recommendations(student)
            source = "calculated_from_csv_fallback"

        return jsonify({
            "student_id": student_id,
            "recommendations": answer,
            "source": source,
        })

    except Exception as error:
        app.logger.exception("Could not generate student recommendations")
        return jsonify({
            "error": "Could not generate recommendations.",
            "details": str(error),
        }), 500


@app.post("/api/chat")
def chat():
    global LAST_DATA_QUESTION
    body = request.get_json(silent=True) or {}
    original_question = str(body.get("message", "")).strip()
    history = body.get("history", [])
    if not original_question:
        return jsonify({"error": "Please enter a question."}), 400

    try:
        students = load_students()
        question = resolve_followup(original_question, history)
        data_question = is_dataset_question(question, students)

        if data_question:
            direct = direct_answer(question, students)
            if direct is not None:
                LAST_DATA_QUESTION = question
                direct.setdefault("source", "calculated_from_csv")
                direct["total_students"] = len(students)
                return jsonify(direct)

            # If a data question isn't supported by deterministic analytics,
            # ask Gemma to explain only facts grounded in the selected records.
            filtered = filter_students(question, students)
            context = {
                "total_students": len(students),
                "matching_record_count": len(filtered),
                "dataset_summary": dataset_summary(students),
                "available_columns": list(students[0].keys()),
                "matching_records_sample": filtered[:MAX_CONTEXT_RECORDS],
            }
            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are EduPulse AI, an assistant for student analytics. "
                        "Answer the user's exact question. Use only the supplied dataset context "
                        "for student-specific facts. Never invent IDs, records, counts, or statistics. "
                        "If the available context is insufficient, say what is missing. "
                        "The Python analytics layer is the source of truth for calculations."
                    ),
                },
                {
                    "role": "user",
                    "content": "Question:\n" + question + "\n\nDataset context:\n" +
                               json.dumps(context, ensure_ascii=False),
                },
            ]
            answer = ollama_chat(messages)
            LAST_DATA_QUESTION = question
            return jsonify({
                "answer": answer,
                "data": [],
                "source": "ollama_with_csv_context",
                "records_considered": len(filtered),
                "total_students": len(students),
            })

        # General questions use conversation history but do not receive the CSV.
        messages = [{
            "role": "system",
            "content": (
                "You are EduPulse AI, a helpful general-purpose assistant. "
                "Answer clearly and accurately. You can help with study questions, programming, "
                "writing, reasoning, and general knowledge. Be transparent about uncertainty. "
                "Do not claim to have performed actions you have not performed."
            ),
        }]
        if isinstance(history, list):
            for item in history[-8:]:
                if not isinstance(item, dict):
                    continue
                role = item.get("role")
                content = item.get("content", item.get("message", ""))
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": str(content)[:4000]})
        messages.append({"role": "user", "content": original_question})
        answer = ollama_chat(messages)
        return jsonify({"answer": answer, "data": [], "source": "gemini"})

    except FileNotFoundError as error:
        return jsonify({"error": str(error)}), 500
    except requests.Timeout:
        return jsonify({"error": "The AI took too long to respond. Please try a shorter question."}), 504
    except requests.RequestException as error:
        app.logger.exception("Ollama request failed")
        return jsonify({
           "error": "Could not connect to Ollama. Make sure Ollama is running and the model is installed.",
            "details": str(error),
        }), 503
    except Exception as error:
        app.logger.exception("Chat request failed")
        return jsonify({
            "error": "Could not process the question.",
            "details": str(error)
        }), 500





# ---------------- Feedback module ----------------

import sqlite3
from datetime import datetime, timezone

FEEDBACK_DB = os.path.join(BASE_DIR, "data", "engagement_feedback.db")
FEEDBACK_CATEGORIES = {
    "Student Satisfaction",
    "Teaching Quality",
    "Learning Resources",
    "Course Curriculum",
    "Faculty Feedback",
    "Student Performance",
    "Attendance and Participation",
    "Suggestions",
}


def init_feedback_db():
    os.makedirs(os.path.dirname(FEEDBACK_DB), exist_ok=True)
    with sqlite3.connect(FEEDBACK_DB) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                department TEXT NOT NULL DEFAULT '',
                submitter_role TEXT NOT NULL,
                category TEXT NOT NULL,
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                comments TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_feedback_student
            ON feedback(student_id)
        """)


init_feedback_db()


@app.post("/api/feedback")
def submit_feedback():
    body = request.get_json(silent=True) or {}

    student_id = str(body.get("student_id", "")).strip().upper()
    role = str(body.get("submitter_role", "")).strip().title()
    category = str(body.get("category", "")).strip()
    comments = str(body.get("comments", "")).strip()

    try:
        rating = int(body.get("rating", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Rating must be an integer from 1 to 5."}), 400

    if not student_id:
        return jsonify({"error": "Student ID is required."}), 400
    if role not in {"Student", "Faculty"}:
        return jsonify({"error": "Submitter role must be Student or Faculty."}), 400
    if category not in FEEDBACK_CATEGORIES:
        return jsonify({"error": "Please select a valid feedback category."}), 400
    if not 1 <= rating <= 5:
        return jsonify({"error": "Rating must be between 1 and 5."}), 400
    if len(comments) > 2000:
        return jsonify({"error": "Comments must be 2000 characters or fewer."}), 400

    try:
        students = load_students()
        student = next(
            (row for row in students
             if str(row.get("student_id", "")).strip().upper() == student_id),
            None
        )
        if student is None:
            return jsonify({"error": "Student ID was not found in the dataset."}), 404

        department = str(student.get("department", ""))
        created_at = datetime.now(timezone.utc).isoformat()

        with sqlite3.connect(FEEDBACK_DB) as connection:
            cursor = connection.execute("""
                INSERT INTO feedback
                (student_id, department, submitter_role, category, rating, comments, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                student_id, department, role, category, rating, comments, created_at
            ))
            feedback_id = cursor.lastrowid

        return jsonify({
            "message": "Feedback submitted successfully.",
            "feedback_id": feedback_id,
            "student_id": student_id,
        }), 201

    except Exception:
        app.logger.exception("Could not save feedback")
        return jsonify({"error": "Could not save feedback."}), 500


@app.get("/api/engagement-feedback/summary")
def feedback_summary():
    try:
        with sqlite3.connect(FEEDBACK_DB) as connection:
            connection.row_factory = sqlite3.Row

            totals = connection.execute("""
                SELECT COUNT(*) AS total,
                       ROUND(AVG(rating), 2) AS average_rating,
                       SUM(CASE WHEN submitter_role = 'Student' THEN 1 ELSE 0 END) AS student_feedback,
                       SUM(CASE WHEN submitter_role = 'Faculty' THEN 1 ELSE 0 END) AS faculty_feedback
                FROM feedback
            """).fetchone()

            categories = connection.execute("""
                SELECT category, COUNT(*) AS responses,
                       ROUND(AVG(rating), 2) AS average_rating
                FROM feedback
                GROUP BY category
                ORDER BY responses DESC, category
            """).fetchall()

            departments = connection.execute("""
                SELECT department, COUNT(*) AS responses,
                       ROUND(AVG(rating), 2) AS average_rating
                FROM feedback
                GROUP BY department
                ORDER BY responses DESC, department
            """).fetchall()

        return jsonify({
            "total_feedback": totals["total"] or 0,
            "average_rating": totals["average_rating"] or 0,
            "student_feedback": totals["student_feedback"] or 0,
            "faculty_feedback": totals["faculty_feedback"] or 0,
            "by_category": [dict(row) for row in categories],
            "by_department": [dict(row) for row in departments],
        })
    except Exception:
        app.logger.exception("Could not summarize feedback")
        return jsonify({"error": "Could not load feedback summary."}), 500



@app.get("/api/engagement-feedback/all")
def all_feedback():
    """Return feedback records for the Feedback Analytics dashboard."""
    try:
        with sqlite3.connect(FEEDBACK_DB) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute("""
                SELECT id, student_id, department, submitter_role,
                       category, rating, comments, created_at
                FROM feedback
                ORDER BY created_at DESC
                LIMIT 5000
            """).fetchall()

        return jsonify({
            "feedback": [dict(row) for row in rows],
            "count": len(rows),
        })
    except Exception:
        app.logger.exception("Could not load detailed feedback")
        return jsonify({"error": "Could not load feedback records."}), 500


@app.get("/api/engagement-feedback/<student_id>")
def student_feedback_history(student_id):
    student_id = str(student_id).strip().upper()

    try:
        with sqlite3.connect(FEEDBACK_DB) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute("""
                SELECT id, student_id, department, submitter_role,
                       category, rating, comments, created_at
                FROM feedback
                WHERE student_id = ?
                ORDER BY created_at DESC
                LIMIT 100
            """, (student_id,)).fetchall()

        return jsonify({
            "student_id": student_id,
            "feedback": [dict(row) for row in rows],
        })
    except Exception:
        app.logger.exception("Could not load student feedback")
        return jsonify({"error": "Could not load student feedback."}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    host = "0.0.0.0"

    print(f"EduPulse AI API starting on port {port}")
    print(f"Dataset: {CSV_PATH}")

    app.run(host=host, port=port, debug=False)
