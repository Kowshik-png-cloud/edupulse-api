import { API_BASE_URL } from "./api";
import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Award, BookOpen,
  BrainCircuit, CheckCircle2, ChevronDown, GraduationCap, LayoutDashboard,
  MessageCircle, Search, Send, ShieldAlert, Sparkles, Target, Users, X,
  Bot, UserRound, TrendingUp, CalendarCheck, BriefcaseBusiness
} from "lucide-react";
import {
  ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar,
  PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

const COLORS = {
  ink: "#172b4d", muted: "#6c7b91", teal: "#168c83", tealLight: "#e4f7f3",
  blue: "#5276d0", blueLight: "#edf2ff", purple: "#8065d8",
  purpleLight: "#f1edff", orange: "#d98735", orangeLight: "#fff3e5",
  red: "#cf5d65", redLight: "#fff0f0", bg: "#f4f7fb", border: "#e4eaf2",
  white: "#ffffff"
};
const PIE_COLORS = [COLORS.teal, COLORS.blue, COLORS.orange, COLORS.red];

const num = (v, fallback = 0) => {
  const n = Number(String(v ?? "").replace("%", "").trim());
  return Number.isFinite(n) ? n : fallback;
};
const first = (row, keys, fallback = "") => {
  for (const key of keys) if (row[key] !== undefined && row[key] !== "") return row[key];
  return fallback;
};
const average = (arr, key) => arr.length ? arr.reduce((s, x) => s + num(x[key]), 0) / arr.length : 0;
const pct = (n) => `${num(n).toFixed(1)}%`;
const yearFromSemester = (sem) => Math.max(1, Math.min(4, Math.ceil(num(sem, 1) / 2)));
const normalizeRisk = (value, fallback) => {
  const s = String(value ?? "").toLowerCase();
  if (s.includes("high") || s.includes("critical")) return "High";
  if (s.includes("medium") || s.includes("moderate")) return "Medium";
  if (s.includes("low")) return "Low";
  return fallback;
};

function normalizeRow(row, index) {
  const semester = num(first(row, ["semester", "Semester"], 1), 1);
  const cgpa = num(first(row, ["cgpa", "CGPA"], 0));
  const attendance = num(first(row, ["attendance_pct", "attendance", "attendance_percentage"], 0));
  const backlogs = num(first(row, ["backlogs", "backlog_count"], 0));
  const internal = num(first(row, ["internal_marks", "internal_score"], 0));
  const assignments = num(first(row, ["assignment_completion_pct", "assignment_completion", "assignments"], 0));
  const lms = num(first(row, ["lms_logins_week", "lms_logins", "weekly_lms_logins"], 0));
  const aptitude = num(first(row, ["aptitude_score", "aptitude"], 0));
  const coding = num(first(row, ["coding_score", "coding"], 0));
  const interview = num(first(row, ["mock_interview_score", "interview_score"], 0));
  const technical = num(first(row, ["technical_skill_score", "technical_score"], 0));
  const communication = num(first(row, ["communication_score", "communication"], 0));
  const score = num(first(row, ["student_success_score", "success_score", "score"], (cgpa * 7 + attendance * 0.15)));
  const academicRisk = normalizeRisk(first(row, ["academic_risk", "academicRisk"], ""), backlogs >= 3 || attendance < 65 || cgpa < 5.5 ? "High" : backlogs > 0 || attendance < 75 || cgpa < 6.5 ? "Medium" : "Low");
  const placementRisk = normalizeRisk(first(row, ["placement_risk", "placementRisk"], ""), score < 45 || (coding > 0 && coding < 40) ? "High" : score < 65 ? "Medium" : "Low");
  return {
    ...row,
    id: String(first(row, ["student_id", "studentId", "id"], `STU${String(index + 1).padStart(4, "0")}`)),
    department: String(first(row, ["department", "Department"], "Unknown")),
    semester, year: yearFromSemester(semester), cgpa, attendance, backlogs, internal,
    assignments, lms, events: num(first(row, ["events_participated", "events"], 0)),
    certifications: num(first(row, ["certifications", "certification_count"], 0)),
    aptitude, coding, interview, technical, communication, score,
    academicRisk, placementRisk,
    academicReasons: String(first(row, ["academic_risk_reasons"], "")),
    placementReasons: String(first(row, ["placement_risk_reasons"], "")),
    category: String(first(row, ["student_category", "category"], ""))
  };
}

function Card({ children, style = {} }) {
  return <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 20, minWidth: 0, ...style }}>{children}</div>;
}
function SectionTitle({ title, subtitle, right }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
    <div><h2 style={{ margin: 0, color: COLORS.ink, fontSize: 21 }}>{title}</h2>{subtitle && <p style={{ margin: "5px 0 0", color: COLORS.muted, fontSize: 13 }}>{subtitle}</p>}</div>{right}
  </div>;
}
function Metric({ label, value, note, icon: Icon, tint = COLORS.tealLight, accent = COLORS.teal }) {
  return <Card><div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
    <div><div style={{ color: COLORS.muted, fontSize: 13, fontWeight: 600 }}>{label}</div><div style={{ color: COLORS.ink, fontSize: 29, fontWeight: 800, marginTop: 8 }}>{value}</div><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 7 }}>{note}</div></div>
    <div style={{ width: 42, height: 42, borderRadius: 13, background: tint, color: accent, display: "grid", placeItems: "center" }}><Icon size={21}/></div>
  </div></Card>;
}
function RiskBadge({ value }) {
  const style = value === "High" ? { bg: COLORS.redLight, fg: COLORS.red } : value === "Medium" ? { bg: COLORS.orangeLight, fg: COLORS.orange } : { bg: COLORS.tealLight, fg: COLORS.teal };
  return <span style={{ padding: "5px 9px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: style.bg, color: style.fg }}>{value}</span>;
}

function Assistant({ data, onSelectStudent }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", text: "Hi! I’m connected to EduPulse’s student analytics API. Ask about CGPA, attendance, backlogs, departments, risks, rankings, or a student ID." }]);
  const [sending, setSending] = useState(false);

  function respond(question) {
    const n = question.toLowerCase().replace(/[’']/g, "'");
    const all = data;
    const sorted = (list, key, desc = true) => [...list].sort((a, b) => desc ? num(b[key]) - num(a[key]) : num(a[key]) - num(b[key]));
    const requestedCount = Math.min(1000, Math.max(1, Number((n.match(/\b(?:top|best|first|show|list|give me)\s+(\d{1,4})\b/) || [])[1] || 10)));
    const show = (list, key, label = key, limit = requestedCount) => list.slice(0, limit).map((s, i) => `${i + 1}. ${s.id} — ${s.department}, Sem ${s.semester} — ${label}: ${num(s[key]).toFixed(key === "cgpa" ? 2 : 1)}`).join("\n");
    const yearMatch = n.match(/\b(?:year|yr)\s*(1|2|3|4)\b|\b(first|second|third|fourth)\s+year\b/);
    let filtered = all;
    if (yearMatch) {
      const word = yearMatch[0];
      const yr = /\b1\b|first/.test(word) ? 1 : /\b2\b|second/.test(word) ? 2 : /\b3\b|third/.test(word) ? 3 : 4;
      filtered = all.filter(s => s.year === yr);
    }
    const dept = [...new Set(all.map(s => s.department))].sort((a,b)=>b.length-a.length).find(d => d && n.includes(d.toLowerCase()));
    if (dept) filtered = filtered.filter(s => s.department === dept);

    const listLines = (list, fn, limit = 12) => list.slice(0, limit).map((s, i) => `${i + 1}. ${fn(s)}`).join("\n") || "No matching students found.";
    const hasAny = (...words) => words.some(w => n.includes(w));
    const count = (list) => list.length;
    const averageCgpa = average(all, "cgpa");
    const avgAttendance = average(all, "attendance");
    const avgSuccess = average(all, "score");

    if (/^(hi|hello|hey)\b/.test(n)) return "Hello! Ask me any question about the loaded student dataset—overall pass percentage, pass/fail counts, year-wise or department-wise results, toppers, attendance, backlogs, CGPA, risks, placements, or an individual student.";
    if (hasAny("help", "what can you", "examples")) return "I can answer questions about overall/year-wise/department-wise pass percentage, pass and fail counts, toppers, lowest scores, CGPA, attendance, backlogs, academic risk, placement readiness, assignments, LMS activity, skills, and individual student records. Ask in your own words.";

    // Individual student lookup
    const idMatch = question.match(/\bSTU[\s_-]*\d+\b/i);
    if (idMatch) {
      const id = idMatch[0].replace(/[\s_-]/g, "").toUpperCase();
      const st = all.find(x => x.id.toUpperCase() === id);
      if (!st) return `I couldn't find ${id} in the loaded dataset. Check the ID and try again.`;
      onSelectStudent?.(st);
      return `${st.id} — ${st.department}, Year ${st.year} (Semester ${st.semester})\nCGPA: ${st.cgpa.toFixed(2)} | Attendance: ${pct(st.attendance)} | Backlogs: ${st.backlogs}\nSuccess score: ${st.score.toFixed(1)} | Academic risk: ${st.academicRisk} | Placement risk: ${st.placementRisk}\nInternal marks: ${st.internal} | Assignments: ${pct(st.assignments)} | LMS logins/week: ${st.lms}\nAptitude: ${st.aptitude} | Coding: ${st.coding} | Mock interview: ${st.interview} | Technical: ${st.technical} | Communication: ${st.communication}`;
    }

    // Pass percentage / pass-fail analysis. CGPA >= 5 is used as a proxy only because the CSV has no explicit pass/fail or subject result field.
    if (hasAny("pass percentage", "passing percentage", "pass rate", "passed", "pass out", "passout", "fail percentage", "failure rate", "failed students", "pass and fail", "pass/fail", "overall result", "result percentage", "college result", "clg result", "college pass")) {
      const passingThresholdMatch = n.match(/(?:pass(?:ing)?\s*(?:mark|cgpa|threshold)|cgpa\s*(?:of|above|at least|>=?)?)\s*(\d+(?:\.\d+)?)/);
      const threshold = passingThresholdMatch ? Number(passingThresholdMatch[1]) : 5.0;
      const passing = all.filter(s => s.cgpa >= threshold);
      const failing = all.filter(s => s.cgpa < threshold);
      const rate = all.length ? passing.length / all.length * 100 : 0;
      const yearRequested = yearMatch;
      const deptRequested = dept;
      const scope = deptRequested || yearRequested ? filtered : all;
      const scopePass = scope.filter(s => s.cgpa >= threshold);
      const scopeFail = scope.filter(s => s.cgpa < threshold);
      const scopeName = deptRequested ? `${deptRequested} department` : yearRequested ? `Year ${scope[0]?.year ?? ""}` : "the full loaded college dataset";
      return `Overall pass percentage for ${scopeName}: ${scope.length ? (scopePass.length / scope.length * 100).toFixed(2) : "0.00"}%\nStudents assessed: ${scope.length}\nPassed: ${scopePass.length}\nFailed: ${scopeFail.length}`;
    }

    // Generic numeric/data questions are answered from the dataset rather than requiring exact wording.
    if (hasAny("attendance", "absent")) {
      const threshold = Number((n.match(/(?:below|under|less than|<)\s*(\d{1,3})/) || [])[1] || 75);
      const list = sorted(filtered.filter(s => s.attendance < threshold), "attendance", false);
      if (hasAny("average", "avg", "mean")) return `Average attendance for ${dept ? dept + " department" : yearMatch ? "the selected year" : "all students"}: ${pct(average(filtered, "attendance"))} (${filtered.length} students). ${list.length} students are below ${threshold}% attendance.`;
      return `${list.length} students have attendance below ${threshold}% in ${dept ? dept : yearMatch ? "the selected year" : "the full dataset"}.\n${listLines(list, s => `${s.id} — ${s.department}, Sem ${s.semester}: ${s.attendance}%`)}`;
    }
    if (hasAny("backlog", "arrear", "arrears")) {
      const list = sorted(filtered.filter(s => s.backlogs > 0), "backlogs");
      if (hasAny("average", "avg", "how many", "count", "total")) return `${list.length} students have one or more backlogs in the selected dataset (${filtered.length ? (list.length / filtered.length * 100).toFixed(1) : "0.0"}%). Average backlogs per student: ${average(filtered, "backlogs").toFixed(2)}.`;
      return `${list.length} students have one or more backlogs.\n${listLines(list, s => `${s.id} — ${s.department}, Sem ${s.semester}: ${s.backlogs} backlog(s)`)}`;
    }
    if (hasAny("risk", "at risk", "struggling", "need support")) {
      const placement = hasAny("placement", "job", "employability");
      const key = placement ? "placementRisk" : "academicRisk";
      const level = hasAny("medium", "moderate") ? "Medium" : hasAny("low risk") ? "Low" : "High";
      const list = filtered.filter(s => s[key] === level);
      if (hasAny("how many", "count", "total", "number")) return `${list.length} students have ${level.toLowerCase()} ${placement ? "placement" : "academic"} risk${dept ? ` in ${dept}` : yearMatch ? " in the selected year" : ""}.`;
      return `${list.length} students have ${level.toLowerCase()} ${placement ? "placement" : "academic"} risk.\n${listLines(list, s => `${s.id} — ${s.department}, Sem ${s.semester}; CGPA ${s.cgpa.toFixed(2)}, attendance ${s.attendance}%, backlogs ${s.backlogs}`)}`;
    }
    if (hasAny("compare", "comparison") && hasAny("department", "departments", "branch", "branches")) {
      const groups = [...new Set(all.map(s => s.department))].map(d => { const a=all.filter(s=>s.department===d); return {d,count:a.length,cgpa:average(a,"cgpa"),attendance:average(a,"attendance"),score:average(a,"score"),risk:a.filter(s=>s.academicRisk==="High").length}; }).sort((a,b)=>b.score-a.score);
      return "Department comparison, ranked by average success score:\n" + groups.map((g,i)=>`${i+1}. ${g.d} — ${g.count} students; avg CGPA ${g.cgpa.toFixed(2)}; attendance ${g.attendance.toFixed(1)}%; success score ${g.score.toFixed(1)}; high academic risk ${g.risk}`).join("\n");
    }
    if (hasAny("department", "departments", "branch", "branches") && hasAny("best", "top", "highest", "lowest", "average", "avg", "performance")) {
      const groups = [...new Set(all.map(s => s.department))].map(d => { const a=all.filter(s=>s.department===d); return {d,score:average(a,"score"),cgpa:average(a,"cgpa"),attendance:average(a,"attendance"),count:a.length}; });
      const byAttendance = hasAny("attendance");
      const byCgpa = hasAny("cgpa", "gpa");
      const key = byAttendance ? "attendance" : byCgpa ? "cgpa" : "score";
      groups.sort((a,b)=>hasAny("lowest") ? a[key]-b[key] : b[key]-a[key]);
      return `Departments ranked by average ${key === "score" ? "success score" : key}:\n` + groups.map((g,i)=>`${i+1}. ${g.d} — ${key} ${g[key].toFixed(1)}, CGPA ${g.cgpa.toFixed(2)}, attendance ${g.attendance.toFixed(1)}%, ${g.count} students`).join("\n");
    }
    if (hasAny("top", "highest", "best", "toppers", "rank", "lowest", "worst", "poor", "least")) {
      const key = hasAny("cgpa", "gpa", "grade") ? "cgpa" : hasAny("attendance") ? "attendance" : hasAny("coding") ? "coding" : hasAny("aptitude") ? "aptitude" : hasAny("interview") ? "interview" : hasAny("technical skill", "technical score") ? "technical" : hasAny("communication") ? "communication" : hasAny("assignment") ? "assignments" : hasAny("lms", "login") ? "lms" : hasAny("backlog") ? "backlogs" : hasAny("internal mark") ? "internal" : "score";
      const low = hasAny("lowest", "worst", "poor", "least");
      const label = ({cgpa:"CGPA",attendance:"attendance",coding:"coding score",aptitude:"aptitude score",interview:"interview score",technical:"technical skill score",communication:"communication score",assignments:"assignment completion",lms:"LMS logins",backlogs:"backlogs",internal:"internal marks",score:"success score"})[key];
      const countToShow = Math.min(requestedCount, filtered.length);
      return `${low ? "Lowest" : "Top"} ${countToShow} students by ${label}${yearMatch ? ` — year ${filtered[0]?.year || ""}` : ""}${dept ? ` — ${dept}` : ""}:\n${show(sorted(filtered,key,!low),key,label,countToShow)}`;
    }
    if (hasAny("average", "avg", "mean")) {
      const key = hasAny("cgpa", "gpa") ? "cgpa" : hasAny("attendance") ? "attendance" : hasAny("coding") ? "coding" : hasAny("aptitude") ? "aptitude" : hasAny("interview") ? "interview" : hasAny("backlog") ? "backlogs" : hasAny("assignment") ? "assignments" : hasAny("internal") ? "internal" : "score";
      const label = ({cgpa:"CGPA",attendance:"attendance",coding:"coding score",aptitude:"aptitude score",interview:"interview score",backlogs:"backlogs",assignments:"assignment completion",internal:"internal marks",score:"success score"})[key];
      return `Average ${label} for ${dept || (yearMatch ? `Year ${filtered[0]?.year}` : "all students")}: ${num(average(filtered,key)).toFixed(2)} across ${filtered.length} students.`;
    }
    if (hasAny("summary", "overview", "dataset", "how many students", "total students", "overall", "college strength", "student count", "number of students")) {
      return `Student dataset summary\nTotal students: ${all.length}\nDepartments: ${new Set(all.map(s=>s.department)).size}\nAverage CGPA: ${averageCgpa.toFixed(2)}\nAverage attendance: ${pct(avgAttendance)}\nAverage success score: ${avgSuccess.toFixed(1)}\nStudents with backlogs: ${all.filter(s=>s.backlogs>0).length}\nHigh academic risk: ${all.filter(s=>s.academicRisk==="High").length}\nHigh placement risk: ${all.filter(s=>s.placementRisk==="High").length}\n\nNote: pass percentage can only be estimated from CGPA because the loaded CSV does not include official pass/fail results. Year is estimated from semester (1–2 = Year 1, 3–4 = Year 2, 5–6 = Year 3, 7–8 = Year 4).`;
    }
    // Broad fallback: answer a general question with the closest measurable data summary instead of rejecting it.
    return `I couldn't identify the exact metric in that wording, but I can still summarize the relevant loaded data.\nStudents in selected scope: ${filtered.length}\nAverage CGPA: ${average(filtered,"cgpa").toFixed(2)}\nAverage attendance: ${pct(average(filtered,"attendance"))}\nAverage success score: ${average(filtered,"score").toFixed(1)}\nStudents with backlogs: ${filtered.filter(s=>s.backlogs>0).length}\nHigh academic risk: ${filtered.filter(s=>s.academicRisk==="High").length}\n\nTry asking about pass percentage, toppers, average CGPA, attendance, backlogs, academic/placement risk, department comparisons, or a student ID.`;
  }

  async function send(e) {
    e?.preventDefault();
    const text = q.trim();
    if (!text || sending) return;

    const lower = text.toLowerCase();
    const previousMessages = messages;
    setMessages(m => [...m, { role: "user", text }]);
    setQ("");

    // Resolve conversational follow-ups from the previous attendance result.
    const asksForList = /\b(list|show|give|display|details|data|records)\b/.test(lower)
      && (/\b(those|that|them|these|319|students|list)\b/.test(lower));
    const previousMentionsAttendanceThreshold = previousMessages.some(
      m => m.role === "assistant" && /attendance below\s*75%|students have attendance below\s*75%/i.test(m.text || "")
    );

    if (asksForList && previousMentionsAttendanceThreshold) {
      const records = (data || [])
        .filter(student => num(student.attendance) < 75)
        .sort((a, b) => num(a.attendance) - num(b.attendance));
      setMessages(m => [...m, {
        role: "assistant",
        text: `Here are all ${records.length} students in the loaded dataset with attendance below 75%.`,
        records
      }]);
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Request failed (${response.status})`);
      }

      const answer = payload.answer || "I couldn't generate an answer. Please try again.";
      const apiRecords = Array.isArray(payload.data) ? payload.data : [];

      // Convert backend records into the same format used by the dashboard.
      const normalizeApiRecord = (student) => normalizeRow({
        ...student,
        student_id: student.student_id ?? student.id,
        attendance_pct: student.attendance_pct ?? student.attendance,
        student_success_score: student.student_success_score ?? student.score,
        academic_risk: student.academic_risk ?? student.academicRisk,
        placement_risk: student.placement_risk ?? student.placementRisk,
        assignment_completion_pct: student.assignment_completion_pct ?? student.assignments,
        internal_marks: student.internal_marks ?? student.internal,
        lms_logins_week: student.lms_logins_week ?? student.lms,
        mock_interview_score: student.mock_interview_score ?? student.interview,
        technical_skill_score: student.technical_skill_score ?? student.technical,
        communication_score: student.communication_score ?? student.communication
      });

      const records = apiRecords.map(normalizeApiRecord);

      // Open the full dashboard profile when the backend returns one student.
      if (records.length === 1 && /student record|student profile|details for|information for/i.test(text)) {
        setSelected(records[0]);
        setPage("Student profile");
      }

      setMessages(m => [...m, {
        role: "assistant",
        text: records.length && payload.source === "calculated_from_csv"
          ? `${answer}\n\nStudent records returned: ${records.length}`
          : answer,
        ...(records.length ? { records } : {})
      }]);
    } catch (error) {
      setMessages(m => [...m, {
        role: "assistant",
        text: `I couldn't reach the EduPulse AI backend. Make sure chatbot_api.py is running at http://127.0.0.1:5001. ${error.message || ""}`
      }]);
    } finally {
      setSending(false);
    }
  }

  return <>
    <button onClick={() => setOpen(v => !v)} aria-label="Open EduPulse AI assistant" style={ui.chatButton}>
      {open ? <X size={19}/> : <BrainCircuit size={20}/>} {open ? "Close assistant" : "Ask EduPulse AI"}
    </button>
    {open && <section style={ui.chatPanel}>
      <header style={ui.chatHeader}><div style={{display:"flex",gap:10,alignItems:"center"}}><div style={ui.botIcon}><Sparkles size={18}/></div><div><strong>EduPulse AI</strong><div style={{fontSize:11,fontWeight:500,opacity:.75,marginTop:3}}>Student analytics assistant · Free</div></div></div><button onClick={()=>setOpen(false)} style={ui.iconButton}><X size={18}/></button></header>
      <div style={ui.chatMessages}>{messages.map((m,i)=><div key={i} style={{display:"flex",gap:8,justifyContent:m.role==="user"?"flex-end":"flex-start"}}>{m.role==="assistant"&&<div style={ui.miniBot}><Bot size={15}/></div>}<div style={{...ui.bubble,...(m.role==="user"?ui.userBubble:{}), ...(m.records ? ui.recordsBubble : {})}}>
        <div>{m.text}</div>
        {m.records && <div style={ui.recordsWrap}>
          <div style={ui.recordsToolbar}>{m.records.length} matching students · sorted by lowest attendance</div>
          <table style={ui.recordsTable}>
            <thead><tr>{["Student ID","Department","Sem","Attendance","CGPA","Backlogs","Academic risk"].map(h=><th key={h} style={ui.recordsTh}>{h}</th>)}</tr></thead>
            <tbody>{m.records.map((student, ri)=><tr key={student.id || ri}>
              <td style={ui.recordsTd}>{student.id}</td>
              <td style={ui.recordsTd}>{student.department}</td>
              <td style={ui.recordsTd}>{student.semester}</td>
              <td style={ui.recordsTd}>{num(student.attendance).toFixed(1)}%</td>
              <td style={ui.recordsTd}>{num(student.cgpa).toFixed(2)}</td>
              <td style={ui.recordsTd}>{num(student.backlogs)}</td>
              <td style={ui.recordsTd}>{student.academicRisk || "Unknown"}</td>
            </tr>)}</tbody>
          </table>
          <button type="button" style={ui.exportButton} onClick={() => {
            const headers = ["student_id","department","semester","attendance_pct","cgpa","backlogs","academic_risk"];
            const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
            const csv = [headers.join(","), ...m.records.map(student => [
              student.id, student.department, student.semester, student.attendance,
              student.cgpa, student.backlogs, student.academicRisk
            ].map(csvCell).join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "students_attendance_below_75.csv"; a.click();
            URL.revokeObjectURL(url);
          }}>Export CSV</button>
        </div>}
      </div>{m.role==="user"&&<div style={ui.miniUser}><UserRound size={15}/></div>}</div>)}{sending && <div style={{color:COLORS.muted,fontSize:12,paddingLeft:34}}>EduPulse AI is thinking…</div>}</div>
      <div style={ui.suggestions}>{["Top scorers in year 2","Attendance below 75%","Compare departments"].map(s=><button key={s} style={ui.suggestion} onClick={()=>{setQ(s)}}>{s}</button>)}</div>
      <form onSubmit={send} style={ui.chatForm}><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask about student data…" style={ui.chatInput}/><button type="submit" style={{...ui.sendButton,opacity:sending?0.6:1}} aria-label="Send question" disabled={sending}><Send size={17}/></button></form>
    </section>}
  </>;
}

const ui = {
  app:{display:"flex",minHeight:"100vh",background:COLORS.bg,color:COLORS.ink,fontFamily:"Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"},
  sidebar:{width:232,background:"#1c3152",color:"#fff",padding:"25px 15px",display:"flex",flexDirection:"column",gap:8,flexShrink:0},
  logo:{display:"flex",alignItems:"center",gap:10,padding:"0 10px 28px",fontSize:19,fontWeight:850,letterSpacing:"-.5px"},
  nav:{display:"flex",alignItems:"center",gap:12,padding:"12px 13px",border:0,borderRadius:11,color:"#d3dced",background:"transparent",textAlign:"left",fontSize:13,fontWeight:650,cursor:"pointer",width:"100%"},
  navActive:{background:"#2b496e",color:"#fff",boxShadow:"inset 3px 0 #4dd3c3"},
  main:{flex:1,minWidth:0,padding:"28px clamp(16px, 3vw, 38px) 42px"},
  topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:28},
  button:{border:0,borderRadius:10,padding:"10px 14px",background:COLORS.teal,color:"#fff",fontWeight:750,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:8},
  chatButton:{position:"fixed",right:24,bottom:22,zIndex:50,border:0,borderRadius:30,padding:"14px 18px",background:"#7056cf",color:"#fff",fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:9,boxShadow:"0 10px 28px #7056cf44"},
  chatPanel:{position:"fixed",right:24,bottom:84,zIndex:50,width:"min(430px,calc(100vw - 32px))",height:"min(600px,calc(100vh - 120px))",background:"#fff",border:`1px solid ${COLORS.border}`,borderRadius:19,boxShadow:"0 24px 70px #172b4d2a",display:"flex",flexDirection:"column",overflow:"hidden"},
  chatHeader:{background:"#f0edff",padding:"15px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",color:COLORS.ink},
  botIcon:{width:35,height:35,display:"grid",placeItems:"center",background:"#dfd7ff",color:"#7056cf",borderRadius:12},
  iconButton:{border:0,background:"transparent",color:COLORS.ink,cursor:"pointer"},
  chatMessages:{padding:14,display:"flex",flexDirection:"column",gap:13,overflowY:"auto",flex:1,background:"#fafbfe"},
  bubble:{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxWidth:"84%",background:"#fff",border:`1px solid ${COLORS.border}`,padding:"10px 12px",borderRadius:"4px 13px 13px 13px",fontSize:12.5,lineHeight:1.55,color:COLORS.ink},
  userBubble:{background:"#e8f8f5",borderColor:"#d3eee8",borderRadius:"13px 4px 13px 13px"},
  miniBot:{width:25,height:25,flexShrink:0,borderRadius:9,display:"grid",placeItems:"center",background:"#e9e3ff",color:"#7056cf"},
  miniUser:{width:25,height:25,flexShrink:0,borderRadius:9,display:"grid",placeItems:"center",background:"#dff4f0",color:COLORS.teal},
  suggestions:{display:"flex",gap:6,flexWrap:"wrap",padding:"0 12px 10px",background:"#fafbfe"},
  suggestion:{border:`1px solid ${COLORS.border}`,background:"#fff",color:COLORS.muted,borderRadius:20,padding:"6px 9px",fontSize:10.5,cursor:"pointer"},
  chatForm:{display:"flex",gap:8,padding:12,borderTop:`1px solid ${COLORS.border}`,background:"#fff"},
  recordsBubble:{maxWidth:"96%", width:"96%"},
  recordsWrap:{marginTop:10, maxWidth:"100%", overflowX:"auto", border:`1px solid ${COLORS.border}`, borderRadius:10, background:"#fff"},
  recordsToolbar:{padding:"9px 10px",fontSize:11,fontWeight:700,color:COLORS.muted,background:"#f7f9fc",whiteSpace:"nowrap"},
  recordsTable:{borderCollapse:"collapse",fontSize:11,width:"100%",whiteSpace:"nowrap"},
  recordsTh:{position:"sticky",top:0,textAlign:"left",padding:"8px 9px",background:"#edf2f8",color:COLORS.ink,borderBottom:`1px solid ${COLORS.border}`},
  recordsTd:{padding:"7px 9px",borderBottom:`1px solid ${COLORS.border}`,color:COLORS.ink},
  exportButton:{margin:9,padding:"7px 10px",border:0,borderRadius:8,background:COLORS.teal,color:"#fff",fontWeight:700,cursor:"pointer"},
  chatInput:{flex:1,minWidth:0,border:`1px solid ${COLORS.border}`,borderRadius:11,padding:"11px 12px",fontSize:13,outline:"none"},
  sendButton:{width:42,border:0,borderRadius:11,background:"#7056cf",color:"#fff",display:"grid",placeItems:"center",cursor:"pointer"}
};


function StudentRecommendations({ student }) {
  const [recommendations, setRecommendations] = useState("");
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");

  useEffect(() => {
    if (!student?.id) return;

    const controller = new AbortController();
    let active = true;

    async function loadRecommendations() {
      setLoadingRecommendations(true);
      setRecommendations("");
      setRecommendationError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/recommendations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: student.id }),
          signal: controller.signal
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Could not generate recommendations.");
        }

        if (active) setRecommendations(payload.recommendations || "");
      } catch (error) {
        if (error.name !== "AbortError" && active) {
          setRecommendationError(error.message || "Unable to load recommendations.");
        }
      } finally {
        if (active) setLoadingRecommendations(false);
      }
    }

    loadRecommendations();

    return () => {
      active = false;
      controller.abort();
    };
  }, [student?.id]);

  return (
    <section style={{
      marginTop: 20,
      padding: 22,
      border: "1px solid #dfe7f1",
      borderRadius: 16,
      background: "#ffffff",
      color: "#172b4d",
      boxShadow: "0 5px 18px rgba(23,43,77,0.06)"
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 8
      }}>
        <span style={{
          display: "grid",
          placeItems: "center",
          width: 38,
          height: 38,
          borderRadius: 12,
          background: "#e9e3ff",
          color: "#7056cf"
        }}><Sparkles size={20} /></span>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, color: "#172b4d" }}>
            Personalized AI Recommendations
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#65758b" }}>
            Gemini analysis for {student.id}
          </p>
        </div>
      </div>

      {loadingRecommendations && (
        <p style={{ color: "#52657d", lineHeight: 1.7 }}>
          ✨ Gemini is analysing this student's performance and preparing personalized recommendations…
        </p>
      )}

      {recommendationError && (
        <div style={{
          marginTop: 14,
          padding: 13,
          borderRadius: 10,
          background: "#fff3f0",
          color: "#9b2c1f",
          fontSize: 13,
          lineHeight: 1.6
        }}>
          {recommendationError}
          <p style={{ marginBottom: 0 }}>
            Check that the backend is running and the Gemini API is available.
          </p>
        </div>
      )}

      {recommendations && (
        <div style={{
          marginTop: 15,
          padding: 17,
          borderRadius: 12,
          background: "#f6f8fc",
          color: "#24364b",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          fontSize: 13,
          lineHeight: 1.85
        }}>{recommendations}</div>
      )}
    </section>
  );
}



function FeedbackPage({ students }) {
  const [role, setRole] = useState("Student");
  const [studentId, setStudentId] = useState("");
  const [category, setCategory] = useState("Student Satisfaction");
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [allFeedback, setAllFeedback] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterRole, setFilterRole] = useState("All");
  const [filterDepartment, setFilterDepartment] = useState("All");
  const [filterRating, setFilterRating] = useState("All");
  const [feedbackSearch, setFeedbackSearch] = useState("");

  const categories = [
    "Student Satisfaction",
    "Teaching Quality",
    "Learning Resources",
    "Course Curriculum",
    "Faculty Feedback",
    "Student Performance",
    "Attendance and Participation",
    "Suggestions"
  ];

  const panel = {
    background: COLORS.white,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 16,
    padding: 22,
    boxShadow: "0 5px 18px rgba(23,43,77,0.04)",
    minWidth: 0
  };

  const field = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 9,
    border: `1px solid ${COLORS.border}`,
    font: "inherit",
    boxSizing: "border-box",
    background: COLORS.white,
    color: COLORS.ink,
    minWidth: 0
  };

  const label = {
    display: "grid",
    gap: 7,
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.ink
  };

  async function loadSummary() {
    const response = await fetch(
      `${API_BASE_URL}/api/engagement-feedback/summary`
    );
    if (!response.ok) throw new Error("Could not load feedback summary.");
    setSummary(await response.json());
  }

  async function loadAllFeedback() {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/engagement-feedback/all`
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Could not load feedback analytics.");
      }
      setAllFeedback(Array.isArray(payload.feedback) ? payload.feedback : []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadHistory(id) {
    if (!id.trim()) {
      setHistory([]);
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/engagement-feedback/${encodeURIComponent(id.trim())}`
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not load history.");
      setHistory(payload.feedback || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function refreshAnalytics() {
    try {
      await Promise.all([loadSummary(), loadAllFeedback()]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  useEffect(() => {
    refreshAnalytics();
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          submitter_role: role,
          category,
          rating,
          comments
        })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Feedback submission failed.");
      setMessage("Feedback submitted successfully.");
      setComments("");
      await refreshAnalytics();
      await loadHistory(studentId);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const departments = [...new Set(allFeedback.map(item => item.department).filter(Boolean))].sort();
  const filteredFeedback = allFeedback.filter(item => {
    const matchesCategory = filterCategory === "All" || item.category === filterCategory;
    const matchesRole = filterRole === "All" || item.submitter_role === filterRole;
    const matchesDepartment = filterDepartment === "All" || item.department === filterDepartment;
    const matchesRating = filterRating === "All" || String(item.rating) === filterRating;
    const searchable = `${item.student_id || ""} ${item.department || ""} ${item.category || ""} ${item.comments || ""} ${item.submitter_role || ""}`.toLowerCase();
    return matchesCategory && matchesRole && matchesDepartment && matchesRating &&
      searchable.includes(feedbackSearch.toLowerCase().trim());
  });

  const ratingDistribution = [1, 2, 3, 4, 5].map(star => ({
    rating: `${star} star${star === 1 ? "" : "s"}`,
    responses: filteredFeedback.filter(item => Number(item.rating) === star).length
  }));

  const categoryRatings = categories.map(name => {
    const entries = filteredFeedback.filter(item => item.category === name);
    return {
      category: name.length > 19 ? `${name.slice(0, 17)}…` : name,
      fullCategory: name,
      average: entries.length
        ? Number((entries.reduce((sum, item) => sum + Number(item.rating || 0), 0) / entries.length).toFixed(2))
        : 0,
      responses: entries.length
    };
  });

  const roleComparison = ["Student", "Faculty"].map(name => {
    const entries = filteredFeedback.filter(item => item.submitter_role === name);
    return {
      role: name,
      responses: entries.length,
      average: entries.length
        ? Number((entries.reduce((sum, item) => sum + Number(item.rating || 0), 0) / entries.length).toFixed(2))
        : 0
    };
  });

  const trendMap = {};
  filteredFeedback.forEach(item => {
    const day = String(item.created_at || "").slice(0, 10);
    if (!day) return;
    trendMap[day] = (trendMap[day] || 0) + 1;
  });
  const trendData = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([date, submissions]) => ({ date: date.slice(5), submissions }));

  const filteredAverage = filteredFeedback.length
    ? (filteredFeedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / filteredFeedback.length).toFixed(2)
    : "—";

  function exportCSV() {
    const columns = ["student_id", "department", "submitter_role", "category", "rating", "comments", "created_at"];
    const escapeCSV = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      columns.join(","),
      ...filteredFeedback.map(item => columns.map(column => escapeCSV(item[column])).join(","))
    ];
    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edupulse_feedback_analytics.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const chartTooltip = {
    background: COLORS.white,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ ...panel, background: "linear-gradient(120deg,#123b52,#167d83)", color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.5, opacity: 0.8, fontWeight: 800 }}>EDUPULSE AI · CATEGORY 7</div>
            <h1 style={{ margin: "8px 0", fontSize: 27 }}>Feedback Analytics Dashboard</h1>
            <p style={{ margin: 0, opacity: 0.85, fontSize: 13 }}>Understand satisfaction, compare feedback, and track trends.</p>
          </div>
          <button type="button" onClick={refreshAnalytics} style={{ ...ui.button, background: "#fff", color: "#123b52" }}>
            ↻ Refresh analytics
          </button>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 14 }}>
        {[
          ["Total feedback", summary?.total_feedback ?? "—"],
          ["Overall average", summary?.total_feedback ? `${summary.average_rating}/5` : "—"],
          ["Student responses", summary?.student_feedback ?? "—"],
          ["Faculty responses", summary?.faculty_feedback ?? "—"],
          ["Filtered responses", filteredFeedback.length],
          ["Filtered average", filteredAverage === "—" ? "—" : `${filteredAverage}/5`]
        ].map(([title, value]) => (
          <div key={title} style={panel}>
            <div style={{ color: COLORS.muted, fontSize: 12, marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 27, fontWeight: 800, color: COLORS.ink }}>{value}</div>
          </div>
        ))}
      </div>

      <section style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>Explore feedback</h2>
            <p style={{ margin: 0, color: COLORS.muted, fontSize: 13 }}>Filters apply to the charts, summary, and records below.</p>
          </div>
          <button type="button" onClick={exportCSV} disabled={!filteredFeedback.length} style={{ ...ui.button, opacity: filteredFeedback.length ? 1 : 0.5 }}>
            ↓ Export CSV ({filteredFeedback.length})
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))", gap: 12, marginTop: 18 }}>
          <label style={label}>Search
            <input style={field} value={feedbackSearch} onChange={e => setFeedbackSearch(e.target.value)} placeholder="Student ID or comment" />
          </label>
          <label style={label}>Department
            <select style={field} value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
              <option value="All">All departments</option>
              {departments.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={label}>Category
            <select style={field} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="All">All categories</option>
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label style={label}>Submitted by
            <select style={field} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="All">All roles</option>
              <option value="Student">Student</option>
              <option value="Faculty">Faculty</option>
            </select>
          </label>
          <label style={label}>Rating
            <select style={field} value={filterRating} onChange={e => setFilterRating(e.target.value)}>
              <option value="All">All ratings</option>
              {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} star{value === 1 ? "" : "s"}</option>)}
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" style={{ ...ui.button, width: "100%", justifyContent: "center" }} onClick={() => {
              setFilterCategory("All");
              setFilterRole("All");
              setFilterDepartment("All");
              setFilterRating("All");
              setFeedbackSearch("");
            }}>Clear filters</button>
          </div>
        </div>
        {analyticsLoading && <p style={{ color: COLORS.muted, fontSize: 13 }}>Loading feedback analytics…</p>}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        <section style={panel}>
          <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>Rating distribution</h2>
          <p style={{ margin: "0 0 14px", color: COLORS.muted, fontSize: 12 }}>Number of responses for each star rating.</p>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ratingDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="responses" name="Responses" fill={COLORS.teal} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section style={panel}>
          <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>Student vs Faculty</h2>
          <p style={{ margin: "0 0 14px", color: COLORS.muted, fontSize: 12 }}>Submission volume and average rating.</p>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis allowDecimals={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="responses" name="Responses" fill="#6b8afd" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {roleComparison.map(item => (
            <div key={item.role} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13 }}>
              <span>{item.role} average rating</span><b>{item.responses ? `${item.average}/5` : "—"}</b>
            </div>
          ))}
        </section>
      </div>

      <section style={panel}>
        <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>Category-wise satisfaction</h2>
        <p style={{ margin: "0 0 14px", color: COLORS.muted, fontSize: 12 }}>Average rating out of 5. Categories with no matching feedback show zero.</p>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryRatings} margin={{ bottom: 25, left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-18} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 5]} />
              <Tooltip contentStyle={chartTooltip} formatter={(value, name) => [value, name]} labelFormatter={labelText => categoryRatings.find(item => item.category === labelText)?.fullCategory || labelText} />
              <Bar dataKey="average" name="Average rating" fill="#d98735" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section style={panel}>
        <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>Feedback submission trend</h2>
        <p style={{ margin: "0 0 14px", color: COLORS.muted, fontSize: 12 }}>Daily submissions for the latest 30 dates with matching feedback.</p>
        {trendData.length ? (
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="submissions" name="Submissions" fill="#7c65c1" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p style={{ color: COLORS.muted, fontSize: 13 }}>No dated feedback records match the current filters.</p>}
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 20, alignItems: "start" }}>
        <section style={panel}>
          <h2 style={{ margin: "0 0 7px", fontSize: 19 }}>Submit feedback</h2>
          <p style={{ color: COLORS.muted, fontSize: 13, marginTop: 0 }}>Share a satisfaction rating or feedback about a student's learning.</p>
          <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
            <label style={label}>Feedback submitted by
              <select style={field} value={role} onChange={e => setRole(e.target.value)}>
                <option value="Student">Student</option>
                <option value="Faculty">Faculty</option>
              </select>
            </label>
            <label style={label}>Student ID
              <input style={field} value={studentId} onChange={e => setStudentId(e.target.value.toUpperCase())} placeholder="e.g. STU0001" required />
            </label>
            <label style={label}>Feedback category
              <select style={field} value={category} onChange={e => setCategory(e.target.value)}>
                {categories.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <div style={label}>Rating
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {[1, 2, 3, 4, 5].map(value => (
                  <button key={value} type="button" aria-label={`Rate ${value} out of 5`} onClick={() => setRating(value)} style={{
                    border: `1px solid ${rating >= value ? "#d98735" : COLORS.border}`,
                    background: rating >= value ? "#fff3e5" : COLORS.white,
                    borderRadius: 9, padding: "9px 12px", cursor: "pointer",
                    color: rating >= value ? "#d98735" : COLORS.muted, fontSize: 19
                  }}>★</button>
                ))}
                <span style={{ color: COLORS.muted, fontSize: 13 }}>{rating}/5</span>
              </div>
            </div>
            <label style={label}>Comments or suggestions
              <textarea style={{ ...field, minHeight: 110, resize: "vertical" }} value={comments} onChange={e => setComments(e.target.value)} maxLength={2000} placeholder="Share feedback or suggestions..." />
            </label>
            <button type="submit" disabled={saving} style={{ ...ui.button, justifyContent: "center", background: COLORS.teal, color: "#fff", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Submitting..." : "Submit feedback"}
            </button>
          </form>
          {message && <p role="status" style={{ fontSize: 13, color: message.toLowerCase().includes("success") ? COLORS.teal : COLORS.red }}>{message}</p>}
        </section>

        <div style={{ display: "grid", gap: 20 }}>
          <section style={panel}>
            <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>Department-wise feedback</h2>
            {!summary?.by_department?.length ? (
              <p style={{ color: COLORS.muted, fontSize: 13 }}>No feedback has been submitted yet.</p>
            ) : summary.by_department.map(item => (
              <div key={item.department} style={{ padding: "12px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                  <b>{item.department || "Unspecified"}</b>
                  <span>{item.average_rating ?? 0}/5 · {item.responses} responses</span>
                </div>
              </div>
            ))}
          </section>

          <section style={panel}>
            <h2 style={{ margin: "0 0 7px", fontSize: 19 }}>Student feedback history</h2>
            <p style={{ color: COLORS.muted, fontSize: 13 }}>Enter a student ID to review submitted feedback.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={field} value={studentId} onChange={e => setStudentId(e.target.value.toUpperCase())} placeholder="Student ID" />
              <button type="button" style={ui.button} onClick={() => loadHistory(studentId)}>Search</button>
            </div>
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              {history.map(item => (
                <article key={item.id} style={{ padding: 12, borderRadius: 10, background: COLORS.bg }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                    <b>{item.category}</b><b>{item.rating}/5 ★</b>
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{item.submitter_role} · {new Date(item.created_at).toLocaleString()}</div>
                  {item.comments && <p style={{ fontSize: 13, marginBottom: 0, whiteSpace: "pre-wrap" }}>{item.comments}</p>}
                </article>
              ))}
              {history.length === 0 && <p style={{ color: COLORS.muted, fontSize: 13 }}>No feedback loaded for this student.</p>}
            </div>
          </section>
        </div>
      </div>

      <section style={panel}>
        <h2 style={{ margin: "0 0 7px", fontSize: 19 }}>Feedback records</h2>
        <p style={{ margin: "0 0 12px", color: COLORS.muted, fontSize: 12 }}>Showing {filteredFeedback.length} matching records, from up to 5,000 recent submissions.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
            <thead><tr>
              {["Date", "Student ID", "Department", "Role", "Category", "Rating", "Comments"].map(name => (
                <th key={name} style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, whiteSpace: "nowrap" }}>{name}</th>
              ))}
            </tr></thead>
            <tbody>
              {filteredFeedback.slice(0, 100).map(item => (
                <tr key={item.id}>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap" }}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{item.student_id || "—"}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{item.department || "—"}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{item.submitter_role}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}` }}>{item.category}</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap" }}>{item.rating}/5 ★</td>
                  <td style={{ padding: 10, borderBottom: `1px solid ${COLORS.border}`, maxWidth: 260 }}>{item.comments || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredFeedback.length > 100 && <p style={{ color: COLORS.muted, fontSize: 12 }}>For readability, the table shows the first 100 matches. CSV export includes all filtered matches.</p>}
        {!filteredFeedback.length && <p style={{ color: COLORS.muted, fontSize: 13 }}>No feedback records match these filters.</p>}
      </section>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [riskFilter, setRiskFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStudentData() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/students`);

        if (!response.ok) {
          throw new Error(`Student API returned HTTP ${response.status}`);
        }

        const result = await response.json();

        const students = result.students ?? result.data;

if (!Array.isArray(students)) {
  throw new Error("Student API did not return a valid student list.");
}

const rows = students.map(normalizeRow);
        if (!cancelled) {
          setData(rows);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            `${e.message}. Make sure the Flask backend is running on port 5001.`
          );
          setLoading(false);
        }
      }
    }

    loadStudentData();

    return () => {
      cancelled = true;
    };
  }, []);

  const departments = useMemo(() => ["All departments", ...new Set(data.map(s => s.department).filter(Boolean)).values()].sort((a,b)=>a==="All departments"?-1:a.localeCompare(b)), [data]);
  const visible = useMemo(() => data.filter(s => (department === "All departments" || s.department === department) && (riskFilter === "All" || s.academicRisk === riskFilter) && `${s.id} ${s.department} ${s.semester}`.toLowerCase().includes(search.toLowerCase())), [data, department, riskFilter, search]);
  const avgCgpa = average(data, "cgpa");
  const avgAttendance = average(data, "attendance");
  const avgScore = average(data, "score");
  const highRisk = data.filter(s => s.academicRisk === "High").length;
  const riskData = ["Low","Medium","High"].map(name => ({ name, value:data.filter(s=>s.academicRisk===name).length }));
  const deptData = [...new Set(data.map(s=>s.department))].map(name=>{const a=data.filter(s=>s.department===name);return{name,CGPA:Number(average(a,"cgpa").toFixed(2)),Attendance:Number(average(a,"attendance").toFixed(1)),Students:a.length};}).sort((a,b)=>b.CGPA-a.CGPA);
  const semesterData = [...new Set(data.map(s=>s.semester))].sort((a,b)=>a-b).map(semester=>{const a=data.filter(s=>s.semester===semester);return{semester:`Sem ${semester}`,CGPA:Number(average(a,"cgpa").toFixed(2)),Attendance:Number(average(a,"attendance").toFixed(1)),Success:Number(average(a,"score").toFixed(1))};});
  const topStudents = [...data].sort((a,b)=>b.score-a.score).slice(0,5);

  const navItems = [
    ["Overview", LayoutDashboard], ["Students", Users], ["Academic Risk", ShieldAlert],
    ["Academic Analytics", BookOpen],
    ["Attendance Analytics", CalendarCheck],
    ["LMS Analytics", Activity],
    ["Student Engagement", Award],
    ["Skills Analytics", BookOpen],
    ["Placement Readiness", BriefcaseBusiness], ["Insights", Activity],
    ["Feedback", MessageCircle]
  ];
  const heading = {
    Overview:["Student success overview","A clear picture of academic performance, engagement, and student outcomes."],
    Students:["Student directory","Search and inspect individual student records."],
    "Academic Risk":["Academic risk monitor","Find students who may need academic support."],
    "Academic Analytics":["Academic analytics","Explore internal marks, backlog patterns, and academic risk details."],
    "Attendance Analytics":["Attendance analytics","Monitor attendance levels, identify students needing support, and compare departments."],
    "LMS Analytics":["LMS analytics","Explore weekly learning platform activity, assignment completion, and student support needs."],
    "Student Engagement":["Student engagement analytics","Explore participation, certifications, and students who may need engagement support."],
    "Skills Analytics":["Skills analytics","Explore technical and communication skills, skill gaps, and student development opportunities."],
    "Placement Readiness":["Placement readiness","Review success scores and placement-related indicators."],
    Insights:["Performance insights","Compare departments and semester-level patterns."],
    Feedback:["Student satisfaction and faculty feedback","Collect feedback and review satisfaction ratings."]
  }[page] || ["Student profile","Individual student overview"];

  if (loading) return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",background:COLORS.bg,color:COLORS.ink,fontFamily:"system-ui"}}><div style={{textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,marginBottom:8}}>EduPulse AI</div>Loading student analytics…</div></div>;
  if (error) return <div style={{padding:35,fontFamily:"system-ui",color:COLORS.ink}}><h2>Unable to load student data</h2><p>{error}</p><p>Expected file: <code>frontend/public/data/student_analytics_1000.csv</code></p></div>;

  return <div style={ui.app}>
    <aside style={ui.sidebar}>
      <div style={ui.logo}><div style={{width:34,height:34,borderRadius:11,background:"#4dd3c3",color:"#17344e",display:"grid",placeItems:"center"}}><GraduationCap size={22}/></div><span>EduPulse<span style={{color:"#55d8c7"}}> AI</span></span></div>
      <div style={{fontSize:10,fontWeight:800,color:"#8fa5c2",letterSpacing:1.4,padding:"0 13px 7px"}}>WORKSPACE</div>
      {navItems.map(([label,Icon])=><button key={label} style={{...ui.nav,...(page===label?ui.navActive:{})}} onClick={()=>{setPage(label);setSelected(null)}}><Icon size={18}/>{label}</button>)}
      <div style={{marginTop:"auto",padding:"15px 12px",borderRadius:14,background:"#263f62",fontSize:12,color:"#c7d5e8",lineHeight:1.6}}><Sparkles size={17} color="#55d8c7"/><div style={{fontWeight:800,color:"#fff",marginTop:8}}>AI-powered insights</div>Explore student trends and ask questions using the assistant.</div>
    </aside>
    <main style={ui.main}>
      <div style={ui.topbar}><div><div style={{fontSize:12,color:COLORS.muted,marginBottom:7}}>EDUPULSE AI / {page.toUpperCase()}</div><h1 style={{fontSize:28,letterSpacing:"-.8px",margin:0,color:COLORS.ink}}>{heading[0]}</h1><p style={{margin:"8px 0 0",fontSize:13,color:COLORS.muted}}>{heading[1]}</p></div><button style={ui.button} onClick={()=>document.querySelector("input[placeholder='Search student ID or department']")?.focus()}><Search size={16}/> Find a student</button></div>
      {selected && page==="Student profile" ? <><button style={{...ui.button,marginBottom:18,background:"#e7edf5",color:COLORS.ink}} onClick={()=>{setSelected(null);setPage("Students")}}>← Back to students</button><Card><h2>{selected.id}</h2><p>{selected.department} · Semester {selected.semester} · Year {selected.year}</p><div style={grid4}><Metric label="CGPA" value={selected.cgpa.toFixed(2)} note="Academic performance" icon={GraduationCap}/><Metric label="Attendance" value={pct(selected.attendance)} note="Class attendance" icon={CalendarCheck}/><Metric label="Success score" value={selected.score.toFixed(1)} note="Overall indicator" icon={Target}/><Metric label="Backlogs" value={selected.backlogs} note="Pending subjects" icon={BookOpen}/></div><div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:20}}>Academic risk: <RiskBadge value={selected.academicRisk}/> Placement risk: <RiskBadge value={selected.placementRisk}/></div><p style={{marginTop:18}}>Coding score: {selected.coding} · Aptitude: {selected.aptitude} · Mock interview: {selected.interview} · Assignments: {pct(selected.assignments)}</p></Card><StudentRecommendations student={selected} /></> :
      <>
      <div style={grid4}>
        <Metric label="Total students" value={data.length.toLocaleString("en-IN")} note={`${new Set(data.map(s=>s.department)).size} departments`} icon={Users}/>
        <Metric label="Average CGPA" value={avgCgpa.toFixed(2)} note="Across loaded dataset" icon={GraduationCap} tint={COLORS.blueLight} accent={COLORS.blue}/>
        <Metric label="Average attendance" value={pct(avgAttendance)} note="Attendance percentage" icon={CalendarCheck} tint={COLORS.purpleLight} accent={COLORS.purple}/>
        <Metric label="High academic risk" value={highRisk} note={`${data.length ? (highRisk/data.length*100).toFixed(1):0}% of students`} icon={AlertTriangle} tint={COLORS.redLight} accent={COLORS.red}/>
      </div>
      {page==="Overview" && <>
        <div style={grid2}>
          <Card><SectionTitle title="Semester performance" subtitle="Average CGPA and attendance by semester"/><div style={{height:280}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={semesterData}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/><XAxis dataKey="semester" tick={{fontSize:11}}/><YAxis yAxisId="left" tick={{fontSize:11}}/><YAxis yAxisId="right" orientation="right" domain={[0,100]} tick={{fontSize:11}}/><Tooltip/><Area yAxisId="left" type="monotone" dataKey="CGPA" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.12} strokeWidth={2}/><Area yAxisId="right" type="monotone" dataKey="Attendance" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.08} strokeWidth={2}/></AreaChart></ResponsiveContainer></div></Card>
          <Card><SectionTitle title="Academic risk distribution" subtitle="Students grouped by current risk level"/><div style={{height:230}}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={riskData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={4}>{riskData.map((d,i)=><Cell key={d.name} fill={[COLORS.teal,COLORS.orange,COLORS.red][i]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer></div><div style={{display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>{riskData.map((r,i)=><div key={r.name} style={{fontSize:12,color:COLORS.muted}}><span style={{display:"inline-block",width:8,height:8,borderRadius:8,background:[COLORS.teal,COLORS.orange,COLORS.red][i],marginRight:6}}/>{r.name}: <b style={{color:COLORS.ink}}>{r.value}</b></div>)}</div></Card>
        </div>
        <Card style={{marginTop:20}}><SectionTitle title="Top student success scores" subtitle="Students with the highest overall success score" right={<button style={{...ui.button,background:COLORS.tealLight,color:COLORS.teal}} onClick={()=>setPage("Students")}>View directory →</button>}/><StudentTable students={topStudents} onSelect={s=>{setSelected(s);setPage("Student profile")}}/></Card>
        <Card style={{marginTop:20}}><SectionTitle title="Department snapshot" subtitle="Average CGPA across departments"/><div style={{height:270}}><ResponsiveContainer width="100%" height="100%"><BarChart data={deptData} margin={{bottom:10}}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis domain={[0,10]} tick={{fontSize:11}}/><Tooltip/><Bar dataKey="CGPA" fill={COLORS.teal} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></Card>
      </>}
      {page==="Students" && <Card><SectionTitle title="Student directory" subtitle={`${visible.length} records shown`}/><div style={filterRow}><div style={searchBox}><Search size={16} color={COLORS.muted}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student ID or department" style={searchInput}/></div><select value={department} onChange={e=>setDepartment(e.target.value)} style={selectStyle}>{departments.map(d=><option key={d}>{d}</option>)}</select></div><StudentTable students={visible.slice(0,200)} onSelect={s=>{setSelected(s);setPage("Student profile")}}/></Card>}
      {page==="Academic Risk" && <Card><SectionTitle title="Academic risk monitor" subtitle="Filter students by academic risk level"/><div style={filterRow}><select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)} style={selectStyle}>{["All","High","Medium","Low"].map(x=><option key={x} value={x}>{x} risk</option>)}</select><select value={department} onChange={e=>setDepartment(e.target.value)} style={selectStyle}>{departments.map(d=><option key={d}>{d}</option>)}</select><span style={{fontSize:12,color:COLORS.muted}}>{visible.length} matching students</span></div><StudentTable students={[...visible].sort((a,b)=>({High:0,Medium:1,Low:2}[a.academicRisk]-({High:0,Medium:1,Low:2}[b.academicRisk]))).slice(0,250)} onSelect={s=>{setSelected(s);setPage("Student profile")}}/></Card>}
      {page==="Academic Analytics" && <AcademicAnalyticsPage data={data} onSelectStudent={s=>{setSelected(s);setPage("Student profile")}} />}
      {page==="Attendance Analytics" && <AttendanceAnalyticsPage data={data} onSelectStudent={s=>{setSelected(s);setPage("Student profile")}} />}
      {page==="LMS Analytics" && <LMSAnalyticsPage data={data} onSelectStudent={s=>{setSelected(s);setPage("Student profile")}} />}
      {page==="Student Engagement" && <EngagementAnalyticsPage data={data} onSelectStudent={s=>{setSelected(s);setPage("Student profile")}} />}
      {page==="Skills Analytics" && <SkillsAnalyticsPage data={data} onSelectStudent={s=>{setSelected(s);setPage("Student profile")}} />}
      {page==="Placement Readiness" && <PlacementAnalyticsPage data={data} onSelectStudent={s=>{setSelected(s);setPage("Student profile")}} />}

      {page==="Feedback" && <FeedbackPage students={data} />}
      {page==="Insights" && <><div style={grid2}><Card><SectionTitle title="CGPA by department" subtitle="Compare academic performance"/><div style={{height:300}}><ResponsiveContainer width="100%" height="100%"><BarChart data={deptData}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis domain={[0,10]}/><Tooltip/><Bar dataKey="CGPA" fill={COLORS.blue} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></Card><Card><SectionTitle title="Attendance by department" subtitle="Average attendance percentage"/><div style={{height:300}}><ResponsiveContainer width="100%" height="100%"><BarChart data={deptData}><CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis domain={[0,100]}/><Tooltip/><Bar dataKey="Attendance" fill={COLORS.teal} radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div></Card></div><Card style={{marginTop:20}}><SectionTitle title="Department metrics" subtitle="Averages computed from the loaded CSV"/><div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr>{["Department","Students","Average CGPA","Attendance","Success score"].map(x=><th key={x} style={thStyle}>{x}</th>)}</tr></thead><tbody>{deptData.map(d=><tr key={d.name}><td style={tdStyle}>{d.name}</td><td style={tdStyle}>{d.Students}</td><td style={tdStyle}>{d.CGPA.toFixed(2)}</td><td style={tdStyle}>{pct(d.Attendance)}</td><td style={tdStyle}>{average(data.filter(s=>s.department===d.name),"score").toFixed(1)}</td></tr>)}</tbody></table></div></Card></>}
      </>}
      <footer style={{fontSize:11,color:"#8b98aa",marginTop:25}}>EduPulse AI · Insights are computed from the loaded student analytics CSV. Risk labels reflect dataset fields or transparent fallback rules.</footer>
    </main>
    <Assistant data={data} onSelectStudent={s=>{setSelected(s);setPage("Student profile")}}/>
  </div>;
}


function AcademicAnalyticsPage({ data, onSelectStudent }) {
  const [dept, setDept] = useState("All departments");
  const [risk, setRisk] = useState("All");
  const [query, setQuery] = useState("");

  const departments = [
    "All departments",
    ...new Set(data.map(s => s.department).filter(Boolean))
  ].sort((a, b) =>
    a === "All departments" ? -1 :
    b === "All departments" ? 1 : a.localeCompare(b)
  );

  const students = data.filter(s =>
    (dept === "All departments" || s.department === dept) &&
    (risk === "All" || s.academicRisk === risk) &&
    `${s.id} ${s.department} ${s.semester} ${s.academicReasons}`
      .toLowerCase().includes(query.toLowerCase())
  );

  const withBacklogs = students.filter(s => num(s.backlogs) > 0);
  const totalBacklogs = students.reduce((sum, s) => sum + num(s.backlogs), 0);
  const highRisk = students.filter(s => s.academicRisk === "High").length;
  const avgInternal = average(students, "internal");

  const bands = [
    { label: "Below 40", min: 0, max: 40, color: COLORS.red },
    { label: "40–59", min: 40, max: 60, color: COLORS.orange },
    { label: "60–79", min: 60, max: 80, color: COLORS.blue },
    { label: "80–100", min: 80, max: Infinity, color: COLORS.teal }
  ].map(b => ({
    ...b,
    count: students.filter(s =>
      s.internal >= b.min && s.internal < b.max
    ).length
  }));

  const deptStats = departments
    .filter(d => d !== "All departments")
    .filter(d => dept === "All departments" || d === dept)
    .map(name => {
      const group = students.filter(s => s.department === name);
      return {
        name,
        count: group.length,
        cgpa: average(group, "cgpa"),
        internal: average(group, "internal"),
        backlogStudents: group.filter(s => num(s.backlogs) > 0).length,
        backlogs: group.reduce((sum, s) => sum + num(s.backlogs), 0),
        highRisk: group.filter(s => s.academicRisk === "High").length
      };
    });

  function exportReport() {
    const headers = [
      "Student ID", "Department", "Semester", "CGPA",
      "Internal Marks", "Backlogs", "Academic Risk", "Academic Risk Reasons"
    ];

    const escapeCSV = value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const rows = students.map(s => [
      s.id, s.department, s.semester, s.cgpa,
      s.internal, s.backlogs, s.academicRisk, s.academicReasons
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edupulse_academic_report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <>
    <div style={filterRow}>
      <div style={searchBox}>
        <Search size={16} color={COLORS.muted}/>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search ID, department or risk reason"
          style={searchInput}
        />
      </div>

      <select value={dept} onChange={e => setDept(e.target.value)} style={selectStyle}>
        {departments.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <select value={risk} onChange={e => setRisk(e.target.value)} style={selectStyle}>
        {["All", "High", "Medium", "Low"].map(r =>
          <option key={r} value={r}>
            {r === "All" ? "All risk levels" : `${r} risk`}
          </option>
        )}
      </select>

      <button style={ui.button} onClick={exportReport}>
        Export CSV ({students.length})
      </button>
    </div>

    <div style={grid4}>
      <Metric
        label="Average internal marks"
        value={avgInternal.toFixed(1)}
        note="Out of 100, based on the loaded dataset"
        icon={BookOpen}
      />
      <Metric
        label="Students with backlogs"
        value={withBacklogs.length}
        note="Students with one or more recorded backlogs"
        icon={AlertTriangle}
        tint={COLORS.orangeLight}
        accent={COLORS.orange}
      />
      <Metric
        label="Total recorded backlogs"
        value={totalBacklogs}
        note="Sum of backlog counts"
        icon={GraduationCap}
        tint={COLORS.blueLight}
        accent={COLORS.blue}
      />
      <Metric
        label="High academic risk"
        value={highRisk}
        note="Students classified as high risk"
        icon={ShieldAlert}
        tint={COLORS.redLight}
        accent={COLORS.red}
      />
    </div>

    <div style={grid2}>
      <Card>
        <SectionTitle
          title="Internal marks distribution"
          subtitle={`Marks grouped into ranges · ${students.length} students`}
        />

        {bands.map(b => (
          <div key={b.label} style={{ marginBottom: 19 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 7
            }}>
              <span>{b.label}</span>
              <b>{b.count} students</b>
            </div>
            <div style={{
              height: 10,
              borderRadius: 10,
              background: "#edf1f7",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                width: `${students.length ? b.count / students.length * 100 : 0}%`,
                background: b.color,
                borderRadius: 10
              }}/>
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <SectionTitle
          title="Academic risk summary"
          subtitle="Risk classification for the filtered students"
        />

        {["High", "Medium", "Low"].map(level => {
          const count = students.filter(s => s.academicRisk === level).length;
          const color = level === "High" ? COLORS.red :
            level === "Medium" ? COLORS.orange : COLORS.teal;

          return <div key={level} style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "15px 0",
            borderBottom: `1px solid ${COLORS.border}`
          }}>
            <RiskBadge value={level}/>
            <div style={{ textAlign: "right" }}>
              <b style={{ fontSize: 20, color }}>{count}</b>
              <div style={{ fontSize: 11, color: COLORS.muted }}>
                {students.length ? (count / students.length * 100).toFixed(1) : "0.0"}%
              </div>
            </div>
          </div>;
        })}

        <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
          Risk labels come from the dataset or the dashboard's existing fallback
          rules. They indicate records that may need review, not a final academic decision.
        </p>
      </Card>
    </div>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="Department academic comparison"
        subtitle="CGPA, internal marks and backlog counts for the selected students"
      />

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {[
                "Department", "Students", "Average CGPA", "Avg. Internal",
                "Students with Backlogs", "Total Backlogs", "High Risk"
              ].map(label =>
                <th key={label} style={thStyle}>{label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {deptStats.map(d => (
              <tr key={d.name}>
                <td style={tdStyle}><b>{d.name}</b></td>
                <td style={tdStyle}>{d.count}</td>
                <td style={tdStyle}>{d.cgpa.toFixed(2)}</td>
                <td style={tdStyle}>{d.internal.toFixed(1)}</td>
                <td style={tdStyle}>{d.backlogStudents}</td>
                <td style={tdStyle}>{d.backlogs}</td>
                <td style={tdStyle}>{d.highRisk}</td>
              </tr>
            ))}
            {!deptStats.length && (
              <tr><td style={tdStyle} colSpan={7}>No matching records.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="Students requiring academic review"
        subtitle={`${students.length} matching records · Select a student to open their profile`}
      />

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {[
                "Student ID", "Department", "Semester", "CGPA",
                "Internal Marks", "Backlogs", "Risk", "Recorded reasons", ""
              ].map(label =>
                <th key={label} style={thStyle}>{label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {[...students]
              .sort((a, b) =>
                ({ High: 0, Medium: 1, Low: 2 }[a.academicRisk] -
                 { High: 0, Medium: 1, Low: 2 }[b.academicRisk]) ||
                num(b.backlogs) - num(a.backlogs)
              )
              .slice(0, 250)
              .map(s => (
                <tr key={s.id}>
                  <td style={tdStyle}><b>{s.id}</b></td>
                  <td style={tdStyle}>{s.department}</td>
                  <td style={tdStyle}>{s.semester}</td>
                  <td style={tdStyle}>{s.cgpa.toFixed(2)}</td>
                  <td style={tdStyle}>{s.internal.toFixed(1)}</td>
                  <td style={tdStyle}>{s.backlogs}</td>
                  <td style={tdStyle}><RiskBadge value={s.academicRisk}/></td>
                  <td style={{ ...tdStyle, whiteSpace: "normal", minWidth: 180 }}>
                    {s.academicReasons || "No reason recorded"}
                  </td>
                  <td style={tdStyle}>
                    <button
                      style={{ ...ui.button, padding: "7px 10px" }}
                      onClick={() => onSelectStudent(s)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            {!students.length && (
              <tr><td style={tdStyle} colSpan={9}>No students match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {students.length > 250 && (
        <p style={{ color: COLORS.muted, fontSize: 12 }}>
          Showing the first 250 matching students. Export CSV to download all {students.length} matching records.
        </p>
      )}
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle title="Data coverage note" subtitle="Limitations of the current student dataset"/>
      <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.8, margin: 0 }}>
        This page analyzes the recorded CGPA, internal marks, backlog counts,
        departments and academic risk fields. The current CSV does not contain
        subject-level marks, so subject-wise performance cannot yet be calculated.
        The figures describe the loaded dataset and should be verified against
        official college records before making academic decisions.
      </p>
    </Card>
  </>;
}


function AttendanceAnalyticsPage({ data, onSelectStudent }) {
  const [dept, setDept] = useState("All departments");
  const [semester, setSemester] = useState("All semesters");
  const [threshold, setThreshold] = useState("75");
  const [query, setQuery] = useState("");

  const departments = [
    "All departments",
    ...new Set(data.map(s => s.department).filter(Boolean))
  ].sort((a, b) =>
    a === "All departments" ? -1 :
    b === "All departments" ? 1 : a.localeCompare(b)
  );

  const semesters = [
    "All semesters",
    ...new Set(data.map(s => s.semester)).values()
  ].sort((a, b) =>
    a === "All semesters" ? -1 :
    b === "All semesters" ? 1 : Number(a) - Number(b)
  );

  const attendanceThreshold = Number(threshold);

  const students = data.filter(s =>
    (dept === "All departments" || s.department === dept) &&
    (semester === "All semesters" || s.semester === Number(semester)) &&
    `${s.id} ${s.department} ${s.semester}`.toLowerCase().includes(query.toLowerCase())
  );

  const avgAttendance = average(students, "attendance");
  const belowThreshold = students.filter(s => s.attendance < attendanceThreshold);
  const atOrAboveThreshold = students.filter(s => s.attendance >= attendanceThreshold);
  const excellent = students.filter(s => s.attendance >= 90).length;

  const departmentStats = departments
    .filter(d => d !== "All departments")
    .filter(d => dept === "All departments" || d === dept)
    .map(name => {
      const group = students.filter(s => s.department === name);
      return {
        name,
        count: group.length,
        attendance: average(group, "attendance"),
        below: group.filter(s => s.attendance < attendanceThreshold).length,
        cgpa: average(group, "cgpa")
      };
    });

  const semesterStats = [...new Set(students.map(s => s.semester))]
    .sort((a, b) => a - b)
    .map(sem => {
      const group = students.filter(s => s.semester === sem);
      return {
        semester: `Sem ${sem}`,
        attendance: Number(average(group, "attendance").toFixed(1)),
        students: group.length,
        below: group.filter(s => s.attendance < attendanceThreshold).length
      };
    });

  const distribution = [
    { label: "Below 50%", min: -Infinity, max: 50, color: COLORS.red },
    { label: "50–64%", min: 50, max: 65, color: COLORS.orange },
    { label: "65–74%", min: 65, max: 75, color: COLORS.purple },
    { label: "75–89%", min: 75, max: 90, color: COLORS.blue },
    { label: "90–100%", min: 90, max: Infinity, color: COLORS.teal }
  ].map(b => ({
    ...b,
    count: students.filter(s => s.attendance >= b.min && s.attendance < b.max).length
  }));

  function exportReport() {
    const headers = [
      "Student ID", "Department", "Semester", "Attendance Percentage",
      "CGPA", "Backlogs", "Academic Risk", "Below Selected Threshold"
    ];

    const escapeCSV = value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const rows = students.map(s => [
      s.id, s.department, s.semester, s.attendance,
      s.cgpa, s.backlogs, s.academicRisk,
      s.attendance < attendanceThreshold ? "Yes" : "No"
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edupulse_attendance_report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <>
    <div style={filterRow}>
      <div style={searchBox}>
        <Search size={16} color={COLORS.muted}/>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search student ID or department"
          style={searchInput}
        />
      </div>

      <select value={dept} onChange={e => setDept(e.target.value)} style={selectStyle}>
        {departments.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <select value={semester} onChange={e => setSemester(e.target.value)} style={selectStyle}>
        {semesters.map(s => (
          <option key={s} value={s}>{s === "All semesters" ? s : `Semester ${s}`}</option>
        ))}
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.muted }}>
        Alert threshold
        <select value={threshold} onChange={e => setThreshold(e.target.value)} style={selectStyle}>
          {[60, 65, 70, 75, 80, 85].map(n => (
            <option key={n} value={n}>{n}%</option>
          ))}
        </select>
      </label>

      <button style={ui.button} onClick={exportReport}>
        Export CSV ({students.length})
      </button>
    </div>

    <div style={grid4}>
      <Metric
        label="Average attendance"
        value={pct(avgAttendance)}
        note="Across filtered students"
        icon={CalendarCheck}
        tint={COLORS.blueLight}
        accent={COLORS.blue}
      />
      <Metric
        label="Below threshold"
        value={belowThreshold.length}
        note={`Attendance below ${attendanceThreshold}%`}
        icon={AlertTriangle}
        tint={COLORS.redLight}
        accent={COLORS.red}
      />
      <Metric
        label="At or above threshold"
        value={atOrAboveThreshold.length}
        note={`Attendance at least ${attendanceThreshold}%`}
        icon={CheckCircle2}
        tint={COLORS.tealLight}
        accent={COLORS.teal}
      />
      <Metric
        label="90% or higher"
        value={excellent}
        note="Students with high recorded attendance"
        icon={Award}
        tint={COLORS.purpleLight}
        accent={COLORS.purple}
      />
    </div>

    <div style={grid2}>
      <Card>
        <SectionTitle
          title="Attendance distribution"
          subtitle={`Students grouped by overall attendance · ${students.length} records`}
        />

        {distribution.map(b => (
          <div key={b.label} style={{ marginBottom: 17 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 7
            }}>
              <span>{b.label}</span>
              <b>{b.count}</b>
            </div>
            <div style={{
              height: 9,
              borderRadius: 10,
              background: "#edf1f7",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                width: `${students.length ? b.count / students.length * 100 : 0}%`,
                background: b.color,
                borderRadius: 10
              }}/>
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <SectionTitle
          title="Attendance alerts"
          subtitle={`Students below the selected ${attendanceThreshold}% threshold`}
        />

        <div style={{ fontSize: 30, fontWeight: 800, color: COLORS.red }}>
          {belowThreshold.length}
        </div>
        <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.7 }}>
          Students may need follow-up or support. Check official attendance
          records and your institution's attendance policy before taking action.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            padding: "7px 10px",
            borderRadius: 9,
            background: COLORS.redLight,
            color: COLORS.red,
            fontSize: 12,
            fontWeight: 700
          }}>
            Below threshold
          </span>
          <span style={{
            padding: "7px 10px",
            borderRadius: 9,
            background: COLORS.tealLight,
            color: COLORS.teal,
            fontSize: 12,
            fontWeight: 700
          }}>
            {atOrAboveThreshold.length} meeting threshold
          </span>
        </div>
      </Card>
    </div>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="Department attendance comparison"
        subtitle="Average attendance and students below the selected threshold"
      />

      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={departmentStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/>
            <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
            <YAxis domain={[0, 100]}/>
            <Tooltip/>
            <Bar dataKey="attendance" name="Average attendance %" fill={COLORS.teal} radius={[6, 6, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Department", "Students", "Average Attendance", "Below Threshold", "Average CGPA"].map(label =>
                <th key={label} style={thStyle}>{label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {departmentStats.map(d => (
              <tr key={d.name}>
                <td style={tdStyle}><b>{d.name}</b></td>
                <td style={tdStyle}>{d.count}</td>
                <td style={tdStyle}>{pct(d.attendance)}</td>
                <td style={tdStyle}>{d.below}</td>
                <td style={tdStyle}>{d.cgpa.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="Semester attendance comparison"
        subtitle="Average recorded attendance grouped by semester"
      />

      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={semesterStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/>
            <XAxis dataKey="semester"/>
            <YAxis domain={[0, 100]}/>
            <Tooltip/>
            <Bar dataKey="attendance" name="Average attendance %" fill={COLORS.blue} radius={[6, 6, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="Students needing attendance review"
        subtitle={`${belowThreshold.length} students below the selected threshold`}
      />

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Student ID", "Department", "Semester", "Attendance", "CGPA", "Backlogs", "Academic Risk", ""].map(label =>
                <th key={label} style={thStyle}>{label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {[...belowThreshold]
              .sort((a, b) => a.attendance - b.attendance)
              .slice(0, 250)
              .map(s => (
                <tr key={s.id}>
                  <td style={tdStyle}><b>{s.id}</b></td>
                  <td style={tdStyle}>{s.department}</td>
                  <td style={tdStyle}>{s.semester}</td>
                  <td style={{ ...tdStyle, color: COLORS.red, fontWeight: 800 }}>{pct(s.attendance)}</td>
                  <td style={tdStyle}>{s.cgpa.toFixed(2)}</td>
                  <td style={tdStyle}>{s.backlogs}</td>
                  <td style={tdStyle}><RiskBadge value={s.academicRisk}/></td>
                  <td style={tdStyle}>
                    <button
                      style={{ ...ui.button, padding: "7px 10px" }}
                      onClick={() => onSelectStudent(s)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            {!belowThreshold.length && (
              <tr><td style={tdStyle} colSpan={8}>No students fall below the selected threshold.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {belowThreshold.length > 250 && (
        <p style={{ fontSize: 12, color: COLORS.muted }}>
          Showing the first 250 students. Export CSV to download all filtered attendance records.
        </p>
      )}
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle title="Attendance data coverage" subtitle="What the current dataset supports"/>
      <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.8, margin: 0 }}>
        This page uses the overall attendance percentage recorded for each student.
        The current CSV does not contain subject-wise attendance, class dates,
        present/absent registers, or attendance history over time. Consequently,
        the charts compare students, departments, and semesters in the loaded
        dataset; they do not represent class-by-class records or historical trends.
      </p>
    </Card>
  </>;
}


function LMSAnalyticsPage({ data, onSelectStudent }) {
  const [dept, setDept] = useState("All departments");
  const [semester, setSemester] = useState("All semesters");
  const [loginLimit, setLoginLimit] = useState("3");
  const [assignmentLimit, setAssignmentLimit] = useState("60");
  const [query, setQuery] = useState("");

  const departments = [
    "All departments",
    ...new Set(data.map(s => s.department).filter(Boolean))
  ].sort((a, b) =>
    a === "All departments" ? -1 :
    b === "All departments" ? 1 : a.localeCompare(b)
  );

  const semesters = [
    "All semesters",
    ...new Set(data.map(s => s.semester)).values()
  ].sort((a, b) =>
    a === "All semesters" ? -1 :
    b === "All semesters" ? 1 : Number(a) - Number(b)
  );

  const filtered = data.filter(s =>
    (dept === "All departments" || s.department === dept) &&
    (semester === "All semesters" || s.semester === Number(semester)) &&
    `${s.id} ${s.department} ${s.semester}`.toLowerCase().includes(query.toLowerCase())
  );

  const avgLogins = average(filtered, "lms");
  const avgAssignments = average(filtered, "assignments");
  const lowActivity = filtered.filter(s => s.lms <= Number(loginLimit));
  const lowAssignments = filtered.filter(s => s.assignments < Number(assignmentLimit));

  const departmentStats = departments
    .filter(d => d !== "All departments")
    .filter(d => dept === "All departments" || d === dept)
    .map(name => {
      const group = filtered.filter(s => s.department === name);
      return {
        name,
        students: group.length,
        logins: average(group, "lms"),
        assignments: average(group, "assignments"),
        lowActivity: group.filter(s => s.lms <= Number(loginLimit)).length,
        lowAssignments: group.filter(s => s.assignments < Number(assignmentLimit)).length
      };
    });

  const semesterStats = [...new Set(filtered.map(s => s.semester))]
    .sort((a, b) => a - b)
    .map(sem => {
      const group = filtered.filter(s => s.semester === sem);
      return {
        semester: `Sem ${sem}`,
        logins: Number(average(group, "lms").toFixed(1)),
        assignments: Number(average(group, "assignments").toFixed(1)),
        students: group.length
      };
    });

  const loginBands = [
    { label: "0–1 logins/week", min: 0, max: 2, color: COLORS.red },
    { label: "2–3 logins/week", min: 2, max: 4, color: COLORS.orange },
    { label: "4–6 logins/week", min: 4, max: 7, color: COLORS.blue },
    { label: "7+ logins/week", min: 7, max: Infinity, color: COLORS.teal }
  ].map(b => ({
    ...b,
    count: filtered.filter(s => s.lms >= b.min && s.lms < b.max).length
  }));

  function exportReport() {
    const headers = [
      "Student ID", "Department", "Semester",
      "LMS Logins Per Week", "Assignment Completion Percentage",
      "CGPA", "Attendance Percentage", "Low LMS Activity", "Low Assignment Completion"
    ];

    const escapeCSV = value =>
      '"' + String(value ?? "").replace(/"/g, '""') + '"';

    const rows = filtered.map(s => [
      s.id, s.department, s.semester, s.lms, s.assignments,
      s.cgpa, s.attendance,
      s.lms <= Number(loginLimit) ? "Yes" : "No",
      s.assignments < Number(assignmentLimit) ? "Yes" : "No"
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edupulse_lms_report.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return <>
    <div style={filterRow}>
      <div style={searchBox}>
        <Search size={16} color={COLORS.muted}/>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search student ID or department"
          style={searchInput}
        />
      </div>

      <select value={dept} onChange={e => setDept(e.target.value)} style={selectStyle}>
        {departments.map(d => <option key={d} value={d}>{d}</option>)}
      </select>

      <select value={semester} onChange={e => setSemester(e.target.value)} style={selectStyle}>
        {semesters.map(s => (
          <option key={s} value={s}>{s === "All semesters" ? s : `Semester ${s}`}</option>
        ))}
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: COLORS.muted }}>
        Low-activity limit
        <select value={loginLimit} onChange={e => setLoginLimit(e.target.value)} style={selectStyle}>
          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} logins/week</option>)}
        </select>
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: COLORS.muted }}>
        Assignment alert
        <select value={assignmentLimit} onChange={e => setAssignmentLimit(e.target.value)} style={selectStyle}>
          {[40, 50, 60, 70, 75, 80].map(n => <option key={n} value={n}>{n}%</option>)}
        </select>
      </label>

      <button style={ui.button} onClick={exportReport}>
        Export CSV ({filtered.length})
      </button>
    </div>

    <div style={grid4}>
      <Metric
        label="Average LMS logins"
        value={avgLogins.toFixed(1)}
        note="Recorded logins per week"
        icon={Activity}
        tint={COLORS.blueLight}
        accent={COLORS.blue}
      />
      <Metric
        label="Average assignment completion"
        value={pct(avgAssignments)}
        note="Across filtered students"
        icon={CheckCircle2}
        tint={COLORS.tealLight}
        accent={COLORS.teal}
      />
      <Metric
        label="Low LMS activity"
        value={lowActivity.length}
        note={`At or below ${loginLimit} logins/week`}
        icon={AlertTriangle}
        tint={COLORS.redLight}
        accent={COLORS.red}
      />
      <Metric
        label="Low assignment completion"
        value={lowAssignments.length}
        note={`Below ${assignmentLimit}% completion`}
        icon={BookOpen}
        tint={COLORS.orangeLight}
        accent={COLORS.orange}
      />
    </div>

    <div style={grid2}>
      <Card>
        <SectionTitle
          title="Weekly LMS login distribution"
          subtitle="Students grouped by recorded weekly logins"
        />
        {loginBands.map(b => (
          <div key={b.label} style={{ marginBottom: 17 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 7
            }}>
              <span>{b.label}</span>
              <b>{b.count} students</b>
            </div>
            <div style={{
              height: 9,
              borderRadius: 10,
              background: "#edf1f7",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                width: `${filtered.length ? b.count / filtered.length * 100 : 0}%`,
                background: b.color,
                borderRadius: 10
              }}/>
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <SectionTitle
          title="Assignment completion"
          subtitle="Students grouped by completion percentage"
        />
        {[
          { label: "Below 40%", min: 0, max: 40, color: COLORS.red },
          { label: "40–59%", min: 40, max: 60, color: COLORS.orange },
          { label: "60–79%", min: 60, max: 80, color: COLORS.blue },
          { label: "80–100%", min: 80, max: Infinity, color: COLORS.teal }
        ].map(b => {
          const count = filtered.filter(s => s.assignments >= b.min && s.assignments < b.max).length;
          return <div key={b.label} style={{ marginBottom: 17 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              marginBottom: 7
            }}>
              <span>{b.label}</span><b>{count} students</b>
            </div>
            <div style={{
              height: 9,
              borderRadius: 10,
              background: "#edf1f7",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                width: `${filtered.length ? count / filtered.length * 100 : 0}%`,
                background: b.color,
                borderRadius: 10
              }}/>
            </div>
          </div>;
        })}
      </Card>
    </div>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="LMS activity and assignments by department"
        subtitle="Average weekly logins compared with assignment completion"
      />
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={departmentStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/>
            <XAxis dataKey="name" tick={{ fontSize: 10 }}/>
            <YAxis domain={[0, 100]}/>
            <Tooltip/>
            <Bar dataKey="logins" name="Average logins/week" fill={COLORS.blue} radius={[6, 6, 0, 0]}/>
            <Bar dataKey="assignments" name="Assignment completion %" fill={COLORS.teal} radius={[6, 6, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Department", "Students", "Avg. Logins/Week", "Avg. Assignment Completion", "Low Activity", "Low Assignments"].map(label =>
                <th key={label} style={thStyle}>{label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {departmentStats.map(d => (
              <tr key={d.name}>
                <td style={tdStyle}><b>{d.name}</b></td>
                <td style={tdStyle}>{d.students}</td>
                <td style={tdStyle}>{d.logins.toFixed(1)}</td>
                <td style={tdStyle}>{pct(d.assignments)}</td>
                <td style={tdStyle}>{d.lowActivity}</td>
                <td style={tdStyle}>{d.lowAssignments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="Semester LMS comparison"
        subtitle="Recorded login frequency and assignment completion"
      />
      <div style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={semesterStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4"/>
            <XAxis dataKey="semester"/>
            <YAxis/>
            <Tooltip/>
            <Bar dataKey="logins" name="Average logins/week" fill={COLORS.blue} radius={[6, 6, 0, 0]}/>
            <Bar dataKey="assignments" name="Assignment completion %" fill={COLORS.teal} radius={[6, 6, 0, 0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle
        title="Students needing LMS support"
        subtitle={`${filtered.filter(s => s.lms <= Number(loginLimit) || s.assignments < Number(assignmentLimit)).length} students meet at least one selected alert condition`}
      />
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {["Student ID", "Department", "Semester", "Logins/Week", "Assignment Completion", "CGPA", "Attendance", "Alert", ""].map(label =>
                <th key={label} style={thStyle}>{label}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered
              .filter(s => s.lms <= Number(loginLimit) || s.assignments < Number(assignmentLimit))
              .sort((a, b) => a.lms - b.lms || a.assignments - b.assignments)
              .slice(0, 250)
              .map(s => {
                const lowLogin = s.lms <= Number(loginLimit);
                const lowAssignment = s.assignments < Number(assignmentLimit);
                return <tr key={s.id}>
                  <td style={tdStyle}><b>{s.id}</b></td>
                  <td style={tdStyle}>{s.department}</td>
                  <td style={tdStyle}>{s.semester}</td>
                  <td style={tdStyle}>{s.lms}</td>
                  <td style={tdStyle}>{pct(s.assignments)}</td>
                  <td style={tdStyle}>{s.cgpa.toFixed(2)}</td>
                  <td style={tdStyle}>{pct(s.attendance)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {lowLogin && <RiskBadge value="High"/>}
                      {lowAssignment && <span style={{
                        padding: "5px 9px", borderRadius: 20,
                        fontSize: 11, fontWeight: 800,
                        background: COLORS.orangeLight, color: COLORS.orange
                      }}>Assignment</span>}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <button
                      style={{ ...ui.button, padding: "7px 10px" }}
                      onClick={() => onSelectStudent(s)}
                    >View</button>
                  </td>
                </tr>;
              })}
            {!filtered.some(s => s.lms <= Number(loginLimit) || s.assignments < Number(assignmentLimit)) && (
              <tr><td style={tdStyle} colSpan={9}>No students match the selected alert thresholds.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>

    <Card style={{ marginTop: 20 }}>
      <SectionTitle title="LMS data coverage" subtitle="What the current dataset supports"/>
      <p style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.8, margin: 0 }}>
        This page uses the recorded weekly LMS login count and assignment completion
        percentage. The dataset does not provide individual login timestamps,
        session duration, assignment-level records, or historical weekly activity.
        Low login frequency is a signal for review, not proof that a student is
        disengaged or struggling.
      </p>
    </Card>
  </>;
}


function EngagementAnalyticsPage({ data, onSelectStudent }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [engagement, setEngagement] = useState("All");
  const [eventLimit, setEventLimit] = useState(1);
  const [certLimit, setCertLimit] = useState(0);

  const departments = [...new Set(data.map(s => s.department).filter(Boolean))].sort();

  const rows = data.map(s => ({
    ...s,
    eventCount: Math.max(0, num(s.events)),
    certificationCount: Math.max(0, num(s.certifications)),
  }));

  const lowEvents = rows.filter(s => s.eventCount <= eventLimit).length;
  const lowCerts = rows.filter(s => s.certificationCount <= certLimit).length;
  const avgEvents = average(rows, "eventCount");
  const avgCerts = average(rows, "certificationCount");

  const filtered = rows.filter(s => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      String(s.id ?? "").toLowerCase().includes(query) ||
      String(s.department ?? "").toLowerCase().includes(query);
    const matchesDepartment =
      department === "All" || s.department === department;
    const matchesEngagement =
      engagement === "All" ||
      (engagement === "Low event participation" && s.eventCount <= eventLimit) ||
      (engagement === "No certifications" && s.certificationCount <= certLimit) ||
      (engagement === "Both concerns" &&
        s.eventCount <= eventLimit &&
        s.certificationCount <= certLimit);

    return matchesSearch && matchesDepartment && matchesEngagement;
  });

  const departmentData = departments.map(name => {
    const group = rows.filter(s => s.department === name);
    return {
      name,
      "Average events": Number(average(group, "eventCount").toFixed(2)),
      "Average certifications": Number(average(group, "certificationCount").toFixed(2)),
    };
  });

  const semesterData = [...new Set(rows.map(s => num(s.semester)))]
    .filter(n => n > 0)
    .sort((a, b) => a - b)
    .map(semester => {
      const group = rows.filter(s => num(s.semester) === semester);
      return {
        semester: `Sem ${semester}`,
        "Average events": Number(average(group, "eventCount").toFixed(2)),
        "Average certifications": Number(average(group, "certificationCount").toFixed(2)),
      };
    });

  const exportCSV = () => {
    const headers = ["Student ID", "Department", "Semester", "Events Participated", "Certifications"];
    const csvRows = filtered.map(s => [
      s.id, s.department, s.semester, s.eventCount, s.certificationCount
    ]);
    const escapeCSV = value =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...csvRows]
      .map(row => row.map(escapeCSV).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_engagement_report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const metricStyle = {
    background: "#fff",
    border: "1px solid #e5eaf2",
    borderRadius: 14,
    padding: 18,
    minWidth: 0,
  };
  const inputStyle = {
    padding: "10px 12px",
    border: "1px solid #dce3ed",
    borderRadius: 8,
    background: "#fff",
    minWidth: 0,
    width: "100%",
    boxSizing: "border-box",
  };
  const chartCard = {
    background: "#fff",
    border: "1px solid #e5eaf2",
    borderRadius: 14,
    padding: 18,
    minWidth: 0,
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Student Engagement Analytics</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          Understand recorded event participation and certification activity.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
        <div style={metricStyle}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Students analysed</div>
          <div style={{ fontSize: 29, fontWeight: 750, marginTop: 8 }}>{rows.length}</div>
        </div>
        <div style={metricStyle}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Average events participated</div>
          <div style={{ fontSize: 29, fontWeight: 750, marginTop: 8 }}>{avgEvents.toFixed(2)}</div>
        </div>
        <div style={metricStyle}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Average certifications</div>
          <div style={{ fontSize: 29, fontWeight: 750, marginTop: 8 }}>{avgCerts.toFixed(2)}</div>
        </div>
        <div style={metricStyle}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Students with low event participation</div>
          <div style={{ fontSize: 29, fontWeight: 750, marginTop: 8 }}>{lowEvents}</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>At or below {eventLimit} recorded event(s)</div>
        </div>
        <div style={metricStyle}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Students with few certifications</div>
          <div style={{ fontSize: 29, fontWeight: 750, marginTop: 8 }}>{lowCerts}</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>At or below {certLimit}</div>
        </div>
      </div>

      <div style={chartCard}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Engagement alert thresholds</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16 }}>
          <label style={{ fontSize: 13, color: "#475569" }}>
            Flag students with event participation at or below
            <select value={eventLimit} onChange={e => setEventLimit(Number(e.target.value))} style={{ ...inputStyle, display: "block", marginTop: 7 }}>
              {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} event(s)</option>)}
            </select>
          </label>
          <label style={{ fontSize: 13, color: "#475569" }}>
            Flag students with certifications at or below
            <select value={certLimit} onChange={e => setCertLimit(Number(e.target.value))} style={{ ...inputStyle, display: "block", marginTop: 7 }}>
              {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n} certification(s)</option>)}
            </select>
          </label>
        </div>
        <p style={{ color: "#64748b", fontSize: 12, margin: "12px 0 0" }}>
          These thresholds are configurable screening rules, not proof that a student is disengaged.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
        <div style={chartCard}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Average events by department</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} margin={{ top: 5, right: 8, left: -18, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Average events" fill={COLORS.blue} radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={chartCard}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Average certifications by department</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentData} margin={{ top: 5, right: 8, left: -18, bottom: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Average certifications" fill={COLORS.purple} radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={chartCard}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Engagement by semester</h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={semesterData} margin={{ top: 5, right: 8, left: -18, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
                <XAxis dataKey="semester" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Average events" fill={COLORS.blue} radius={[5,5,0,0]} />
                <Bar dataKey="Average certifications" fill={COLORS.purple} radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ color: "#64748b", fontSize: 12, marginBottom: 0 }}>Blue: events · Purple: certifications</p>
        </div>
      </div>

      <div style={chartCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: "0 0 5px", fontSize: 16 }}>Student engagement review</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{filtered.length} students match your filters</p>
          </div>
          <button onClick={exportCSV} style={{ padding: "10px 14px", border: 0, borderRadius: 8, background: COLORS.blue, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            Export CSV
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student ID or department" style={inputStyle} />
          <select value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle}>
            <option value="All">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={engagement} onChange={e => setEngagement(e.target.value)} style={inputStyle}>
            <option value="All">All engagement levels</option>
            <option value="Low event participation">Low event participation</option>
            <option value="No certifications">Few certifications</option>
            <option value="Both concerns">Both concerns</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 650 }}>
            <thead>
              <tr style={{ background: "#f5f7fb", textAlign: "left" }}>
                {["Student ID","Department","Semester","Events","Certifications","Review","Profile"].map(h =>
                  <th key={h} style={{ padding: "11px 10px", borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 250).map((s, index) => {
                const lowEvent = s.eventCount <= eventLimit;
                const lowCert = s.certificationCount <= certLimit;
                return (
                  <tr key={`${s.id}-${index}`}>
                    <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.id}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.department}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.semester || "—"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.eventCount}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.certificationCount}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>
                      {lowEvent && lowCert ? "Review both" : lowEvent ? "Review events" : lowCert ? "Review certifications" : "No threshold alert"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>
                      <button onClick={() => onSelectStudent(s)} style={{ border: "1px solid #dce3ed", borderRadius: 7, padding: "6px 9px", background: "#fff", cursor: "pointer" }}>View</button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 250 && <p style={{ fontSize: 12, color: "#64748b" }}>Showing the first 250 matching students. Export CSV to download all matching records.</p>}
      </div>

      <div style={{ background: "#f5f8ff", border: "1px solid #dce7fb", borderRadius: 12, padding: 15 }}>
        <h3 style={{ margin: "0 0 7px", fontSize: 14 }}>Data coverage and interpretation</h3>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "#475569" }}>
          This page uses recorded event participation and certification counts in the dataset.
          It does not contain detailed club membership, hackathon participation, event dates,
          attendance at individual events, or a historical engagement timeline. Low counts are
          prompts for supportive follow-up, not definitive evidence of disengagement.
        </p>
      </div>
    </div>
  );
}


function PlacementAnalyticsPage({ data, onSelectStudent }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [readiness, setReadiness] = useState("All");
  const [skillThreshold, setSkillThreshold] = useState(50);

  const departments = [...new Set(data.map(s => s.department).filter(Boolean))].sort();

  const skills = [
    { key: "coding", label: "Coding" },
    { key: "aptitude", label: "Aptitude" },
    { key: "interview", label: "Mock interview" },
    { key: "technical", label: "Technical skills" },
    { key: "communication", label: "Communication" },
  ];

  const scoreOf = (student, key) => Math.max(0, Math.min(100, num(student[key])));

  const classify = student => {
    const score = num(student.score);
    const coding = num(student.coding);
    if (score >= 70 && coding >= 50) return "High";
    if (score >= 45 && coding >= 30) return "Medium";
    return "Low";
  };

  const recommendations = student => {
    const weak = skills
      .filter(skill => scoreOf(student, skill.key) < skillThreshold)
      .map(skill => skill.label);

    if (!weak.length) {
      return "Maintain practice and complete regular mock assessments.";
    }

    return weak.map(skill => {
      const advice = {
        "Coding": "Practise coding problems and data structures.",
        "Aptitude": "Practise quantitative, logical, and verbal aptitude.",
        "Mock interview": "Complete mock interviews and practise explaining solutions.",
        "Technical skills": "Revise core technical concepts and complete practical projects.",
        "Communication": "Practise speaking, group discussions, and interview responses.",
      };
      return `${skill}: ${advice[skill]}`;
    }).join(" ");
  };

  const rows = data.map(student => ({
    ...student,
    placementReadiness: classify(student),
    skillGaps: skills.filter(skill => scoreOf(student, skill.key) < skillThreshold),
  }));

  const averageScore = key => average(rows, key);
  const highCount = rows.filter(s => s.placementReadiness === "High").length;
  const mediumCount = rows.filter(s => s.placementReadiness === "Medium").length;
  const lowCount = rows.filter(s => s.placementReadiness === "Low").length;
  const belowThreshold = rows.filter(s => s.skillGaps.length > 0).length;

  const filtered = rows.filter(s => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      String(s.id ?? "").toLowerCase().includes(query) ||
      String(s.department ?? "").toLowerCase().includes(query);
    const matchesDepartment = department === "All" || s.department === department;
    const matchesReadiness = readiness === "All" || s.placementReadiness === readiness;
    return matchesSearch && matchesDepartment && matchesReadiness;
  }).sort((a, b) => a.score - b.score);

  const departmentData = departments.map(name => {
    const group = rows.filter(s => s.department === name);
    return {
      name,
      Students: group.length,
      Coding: Number(average(group, "coding").toFixed(1)),
      Aptitude: Number(average(group, "aptitude").toFixed(1)),
      Interview: Number(average(group, "interview").toFixed(1)),
      Technical: Number(average(group, "technical").toFixed(1)),
      Communication: Number(average(group, "communication").toFixed(1)),
      "Success score": Number(average(group, "score").toFixed(1)),
    };
  });

  const skillData = skills.map(skill => ({
    name: skill.label,
    Average: Number(average(rows, skill.key).toFixed(1)),
    "Below threshold": rows.filter(s => scoreOf(s, skill.key) < skillThreshold).length,
  }));

  const exportCSV = () => {
    const headers = [
      "Student ID", "Department", "Semester", "Readiness",
      "Success Score", "Coding", "Aptitude", "Mock Interview",
      "Technical Skills", "Communication", "Skill Gaps", "Recommendations",
    ];
    const records = filtered.map(s => [
      s.id, s.department, s.semester, s.placementReadiness, s.score,
      s.coding, s.aptitude, s.interview, s.technical, s.communication,
      s.skillGaps.map(g => g.label).join("; "),
      recommendations(s),
    ]);
    const escape = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...records].map(row => row.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edupulse_placement_analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const card = {
    background: "#fff",
    border: "1px solid #e5eaf2",
    borderRadius: 14,
    padding: 18,
    minWidth: 0,
  };
  const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #dce3ed",
    borderRadius: 8,
    background: "#fff",
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Placement Analytics</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          Review recorded placement indicators, identify skill gaps, and plan student support.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 14 }}>
        {[
          ["Students analysed", rows.length, "#2563eb"],
          ["High readiness", highCount, "#15803d"],
          ["Medium readiness", mediumCount, "#b45309"],
          ["Low readiness", lowCount, "#dc2626"],
          ["Students with skill gaps", belowThreshold, "#7c3aed"],
        ].map(([label, value, color]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
            <div style={{ fontSize: 29, fontWeight: 750, color, marginTop: 8 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Placement indicator averages</h3>
        <div style={{ display: "grid", gap: 16 }}>
          {[
            ["Overall success score", averageScore("score")],
            ["Coding score", averageScore("coding")],
            ["Aptitude score", averageScore("aptitude")],
            ["Mock interview score", averageScore("interview")],
            ["Technical skill score", averageScore("technical")],
            ["Communication score", averageScore("communication")],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, marginBottom: 7 }}>
                <span>{label}</span><b>{num(value).toFixed(1)} / 100</b>
              </div>
              <div style={{ height: 9, background: "#edf1f7", borderRadius: 20, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, num(value)))}%`, background: COLORS.purple, borderRadius: 20 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Skill gap analysis</h3>
        <p style={{ margin: "0 0 14px", color: "#64748b", fontSize: 12 }}>
          Adjust the threshold to find students whose recorded scores are below your chosen target.
        </p>
        <label style={{ display: "block", maxWidth: 320, fontSize: 13, color: "#475569", marginBottom: 18 }}>
          Skill target: {skillThreshold}/100
          <input type="range" min="30" max="80" step="5" value={skillThreshold}
            onChange={e => setSkillThreshold(Number(e.target.value))}
            style={{ display: "block", width: "100%", marginTop: 10 }} />
        </label>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skillData} margin={{ top: 8, right: 10, left: -12, bottom: 15 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Below threshold" fill={COLORS.blue} radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 0 }}>
          The chart counts students below the selected target for each skill.
        </p>
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Department comparison</h3>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentData} margin={{ top: 8, right: 8, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="Coding" fill={COLORS.blue} />
              <Bar dataKey="Aptitude" fill={COLORS.purple} />
              <Bar dataKey="Interview" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p style={{ color: "#64748b", fontSize: 12, marginBottom: 0 }}>
          Compare average coding, aptitude, and mock interview scores across departments.
        </p>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: "0 0 5px", fontSize: 16 }}>Student placement review</h3>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{filtered.length} students match the selected filters</p>
          </div>
          <button onClick={exportCSV} style={{ border: 0, borderRadius: 8, padding: "10px 14px", background: COLORS.blue, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            Export CSV
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 15 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student ID or department" style={input} />
          <select value={department} onChange={e => setDepartment(e.target.value)} style={input}>
            <option value="All">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={readiness} onChange={e => setReadiness(e.target.value)} style={input}>
            <option value="All">All readiness levels</option>
            <option value="High">High readiness</option>
            <option value="Medium">Medium readiness</option>
            <option value="Low">Low readiness</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f5f7fb" }}>
                {["Student ID", "Department", "Readiness", "Success", "Coding", "Aptitude", "Interview", "Skill gaps", "Recommendations", "Profile"].map(h =>
                  <th key={h} style={{ padding: 10, borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s, i) => (
                <tr key={`${s.id}-${i}`}>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.department}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>
                    <span style={{
                      padding: "4px 7px", borderRadius: 6, fontWeight: 600,
                      color: s.placementReadiness === "High" ? "#166534" : s.placementReadiness === "Medium" ? "#92400e" : "#991b1b",
                      background: s.placementReadiness === "High" ? "#dcfce7" : s.placementReadiness === "Medium" ? "#fef3c7" : "#fee2e2"
                    }}>{s.placementReadiness}</span>
                  </td>
                  {[s.score, s.coding, s.aptitude, s.interview].map((v, j) =>
                    <td key={j} style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{num(v).toFixed(1)}</td>
                  )}
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7", minWidth: 150 }}>
                    {s.skillGaps.length ? s.skillGaps.map(g => g.label).join(", ") : "No gaps at current target"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7", minWidth: 250 }}>
                    {recommendations(s)}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>
                    <button onClick={() => onSelectStudent(s)} style={{ border: "1px solid #dce3ed", borderRadius: 7, padding: "6px 9px", background: "#fff", cursor: "pointer" }}>View</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>No students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && <p style={{ color: "#64748b", fontSize: 12 }}>Showing 200 students. Export CSV to download all filtered results.</p>}
      </div>

      <div style={{ background: "#f5f8ff", border: "1px solid #dce7fb", borderRadius: 12, padding: 15 }}>
        <h3 style={{ margin: "0 0 7px", fontSize: 14 }}>How to interpret readiness</h3>
        <p style={{ margin: 0, color: "#475569", fontSize: 12, lineHeight: 1.7 }}>
          This page uses a screening rule based on the dataset's overall success score and coding score:
          High means success score at least 70 and coding at least 50; Medium means success score at least
          45 and coding at least 30 when the High rule is not met; otherwise Low. This is a configurable
          project-level heuristic, not a validated prediction of hiring outcomes. Recommendations are
          suggestions for practice, not guarantees of placement. Actual placement outcomes are not present
          in the current dataset.
        </p>
      </div>
    </div>
  );
}


function SkillsAnalyticsPage({ data, onSelectStudent }) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [skillLevel, setSkillLevel] = useState("All");
  const [threshold, setThreshold] = useState(50);

  const skills = [
    { key: "technical", label: "Technical skills" },
    { key: "communication", label: "Communication" },
    { key: "coding", label: "Coding" },
    { key: "aptitude", label: "Aptitude" },
    { key: "interview", label: "Mock interview" },
  ];

  const departments = [...new Set(data.map(s => s.department).filter(Boolean))].sort();
  const scoreOf = (s, key) => Math.max(0, Math.min(100, num(s[key])));

  const rows = data.map(s => {
    const gaps = skills.filter(skill => scoreOf(s, skill.key) < threshold);
    return {
      ...s,
      gaps,
      skillAverage: skills.reduce((sum, skill) => sum + scoreOf(s, skill.key), 0) / skills.length,
      skillLevel: gaps.length === 0 ? "Strong" : gaps.length <= 2 ? "Developing" : "Needs support",
    };
  });

  const averageSkill = key => average(rows, key);
  const strongCount = rows.filter(s => s.skillLevel === "Strong").length;
  const developingCount = rows.filter(s => s.skillLevel === "Developing").length;
  const supportCount = rows.filter(s => s.skillLevel === "Needs support").length;

  const departmentData = departments.map(name => {
    const group = rows.filter(s => s.department === name);
    const item = { name, Students: group.length };
    skills.forEach(skill => {
      item[skill.label] = Number(average(group, skill.key).toFixed(1));
    });
    return item;
  });

  const skillData = skills.map(skill => ({
    name: skill.label,
    Average: Number(averageSkill(skill.key).toFixed(1)),
    "Below target": rows.filter(s => scoreOf(s, skill.key) < threshold).length,
  }));

  const filtered = rows.filter(s => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      String(s.id ?? "").toLowerCase().includes(q) ||
      String(s.department ?? "").toLowerCase().includes(q);
    const matchesDepartment = department === "All" || s.department === department;
    const matchesLevel = skillLevel === "All" || s.skillLevel === skillLevel;
    return matchesSearch && matchesDepartment && matchesLevel;
  }).sort((a, b) => a.skillAverage - b.skillAverage);

  const suggestion = s => {
    const gaps = s.gaps.map(g => g.label);
    if (!gaps.length) return "Maintain current practice and review progress regularly.";
    return gaps.map(g => ({
      "Technical skills": "Practise core concepts and build a practical project.",
      "Communication": "Practise presentations, group discussions, and interview responses.",
      "Coding": "Solve coding problems regularly and revise data structures.",
      "Aptitude": "Practise quantitative, logical, and verbal reasoning.",
      "Mock interview": "Complete mock interviews and practise explaining solutions.",
    }[g])).join(" ");
  };

  const exportCSV = () => {
    const headers = [
      "Student ID", "Department", "Semester", "Skill Level",
      "Technical", "Communication", "Coding", "Aptitude",
      "Mock Interview", "Skill Gaps", "Suggested Development",
    ];
    const records = filtered.map(s => [
      s.id, s.department, s.semester, s.skillLevel,
      s.technical, s.communication, s.coding, s.aptitude, s.interview,
      s.gaps.map(g => g.label).join("; "), suggestion(s),
    ]);
    const escape = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers, ...records].map(r => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "edupulse_skills_analytics.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const card = {
    background: "#fff",
    border: "1px solid #e5eaf2",
    borderRadius: 14,
    padding: 18,
    minWidth: 0,
  };
  const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    border: "1px solid #dce3ed",
    borderRadius: 8,
    background: "#fff",
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Skills Analytics</h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
          Review recorded skills, compare departments, and identify development opportunities.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 14 }}>
        {[
          ["Students analysed", rows.length, "#2563eb"],
          ["Average technical score", averageSkill("technical").toFixed(1), "#7c3aed"],
          ["Average communication", averageSkill("communication").toFixed(1), "#0f766e"],
          ["Strong at current target", strongCount, "#15803d"],
          ["May need support", supportCount, "#dc2626"],
        ].map(([label, value, color]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: 13, color: "#64748b" }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 750, color, marginTop: 8 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Skill target</h3>
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 0 }}>
          Scores below the selected target are flagged for review.
        </p>
        <label style={{ display: "block", maxWidth: 350, fontSize: 13 }}>
          Target score: <b>{threshold}/100</b>
          <input
            type="range" min="30" max="80" step="5" value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            style={{ display: "block", width: "100%", marginTop: 10 }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 18 }}>
        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Average score by skill</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillData} margin={{ top: 5, right: 8, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="Average" fill={COLORS.blue} radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={card}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Students below skill target</h3>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillData} margin={{ top: 5, right: 8, left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Below target" fill={COLORS.purple} radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={card}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16 }}>Department skill comparison</h3>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departmentData} margin={{ top: 5, right: 8, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8edf4" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="Technical skills" fill={COLORS.blue} />
              <Bar dataKey="Communication" fill={COLORS.teal} />
              <Bar dataKey="Coding" fill={COLORS.purple} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: "0 0 5px", fontSize: 16 }}>Student skill profiles</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>{filtered.length} matching students</p>
          </div>
          <button onClick={exportCSV} style={{ border: 0, borderRadius: 8, padding: "10px 14px", background: COLORS.blue, color: "#fff", cursor: "pointer" }}>
            Export CSV
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, margin: "15px 0" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student ID or department" style={input} />
          <select value={department} onChange={e => setDepartment(e.target.value)} style={input}>
            <option value="All">All departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={skillLevel} onChange={e => setSkillLevel(e.target.value)} style={input}>
            <option value="All">All skill levels</option>
            <option value="Strong">Strong</option>
            <option value="Developing">Developing</option>
            <option value="Needs support">Needs support</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 850, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#f5f7fb" }}>
                {["Student ID", "Department", "Technical", "Communication", "Coding", "Aptitude", "Level", "Skill gaps", "Suggestions", "Profile"].map(h =>
                  <th key={h} style={{ padding: 10, borderBottom: "1px solid #e5eaf2", whiteSpace: "nowrap" }}>{h}</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s, i) => (
                <tr key={`${s.id}-${i}`}>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.id}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.department}</td>
                  {[s.technical, s.communication, s.coding, s.aptitude].map((v, j) =>
                    <td key={j} style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{num(v).toFixed(1)}</td>
                  )}
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>{s.skillLevel}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7", minWidth: 150 }}>
                    {s.gaps.length ? s.gaps.map(g => g.label).join(", ") : "None at target"}
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7", minWidth: 220 }}>{suggestion(s)}</td>
                  <td style={{ padding: 10, borderBottom: "1px solid #edf1f7" }}>
                    <button onClick={() => onSelectStudent(s)} style={{ border: "1px solid #dce3ed", borderRadius: 7, padding: "6px 9px", background: "#fff", cursor: "pointer" }}>View</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={10} style={{ padding: 20, textAlign: "center" }}>No students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && <p style={{ color: "#64748b", fontSize: 12 }}>Showing the first 200 rows. Export CSV for all matching students.</p>}
      </div>

      <div style={{ background: "#f5f8ff", border: "1px solid #dce7fb", borderRadius: 12, padding: 15 }}>
        <h3 style={{ margin: "0 0 7px", fontSize: 14 }}>How to interpret this page</h3>
        <p style={{ margin: 0, color: "#475569", fontSize: 12, lineHeight: 1.7 }}>
          Skill levels are screening labels based on the selected score target and the five available
          skill indicators. “Strong” means all five scores meet the target; “Developing” means one or
          two fall below it; “Needs support” means three or more fall below it. These are project-level
          rules, not validated psychological or employment assessments. Use them to guide supportive
          conversations rather than as definitive judgments about students.
        </p>
      </div>
    </div>
  );
}

function StudentTable({ students, onSelect }) {
  return <div style={{overflowX:"auto"}}><table style={tableStyle}><thead><tr>{["Student","Department","Semester","CGPA","Attendance","Backlogs","Success score","Academic risk",""].map(x=><th key={x} style={thStyle}>{x}</th>)}</tr></thead><tbody>{students.length ? students.map(s=><tr key={s.id} onClick={()=>onSelect?.(s)} style={{cursor:"pointer"}}><td style={tdStyle}><b>{s.id}</b></td><td style={tdStyle}>{s.department}</td><td style={tdStyle}>{s.semester}</td><td style={tdStyle}>{s.cgpa.toFixed(2)}</td><td style={tdStyle}>{pct(s.attendance)}</td><td style={tdStyle}>{s.backlogs}</td><td style={tdStyle}><b>{s.score.toFixed(1)}</b></td><td style={tdStyle}><RiskBadge value={s.academicRisk}/></td><td style={tdStyle}><span style={{color:COLORS.teal,fontWeight:800}}>View →</span></td></tr>) : <tr><td style={tdStyle} colSpan={9}>No students match these filters.</td></tr>}</tbody></table></div>;
}
const grid4={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:15,marginBottom:20};
const grid2={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,390px),1fr))",gap:20,marginTop:20};
const filterRow={display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:16};
const searchBox={display:"flex",alignItems:"center",gap:8,border:`1px solid ${COLORS.border}`,borderRadius:10,padding:"0 11px",background:"#fff",minWidth:220,flex:1};
const searchInput={border:0,outline:"none",padding:"11px 0",fontSize:13,width:"100%",background:"transparent"};
const selectStyle={border:`1px solid ${COLORS.border}`,borderRadius:10,padding:"11px 12px",fontSize:12,background:"#fff",color:COLORS.ink};
const tableStyle={width:"100%",borderCollapse:"collapse",fontSize:12,textAlign:"left",whiteSpace:"nowrap"};
const thStyle={padding:"12px 11px",background:"#f7f9fc",color:COLORS.muted,fontWeight:750,borderBottom:`1px solid ${COLORS.border}`};
const tdStyle={padding:"13px 11px",borderBottom:`1px solid #edf0f5`,color:COLORS.ink};
