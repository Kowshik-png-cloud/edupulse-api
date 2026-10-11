import pandas as pd


def segment_students(df):
    """
    Segment students using academic performance,
    placement readiness, and overall success scores.

    A CGPA >= 8 with any placement score < 70 identifies
    students who may benefit from additional placement support.
    """
    result = df.copy()

    required_columns = [
        "student_success_score",
        "cgpa",
        "coding_score",
        "aptitude_score",
        "mock_interview_score",
    ]

    for column in required_columns:
        if column in result.columns:
            result[column] = pd.to_numeric(
                result[column], errors="coerce"
            )

    def get_category(row):
        score = row.get("student_success_score")
        cgpa = row.get("cgpa")

        if pd.isna(score):
            return "Insufficient Data"

        placement_scores = [
            row.get("coding_score"),
            row.get("aptitude_score"),
            row.get("mock_interview_score"),
        ]

        weak_placement = any(
            pd.notna(value) and value < 70
            for value in placement_scores
        )

        if pd.notna(cgpa) and cgpa >= 8 and weak_placement:
            return "Academically Strong, Placement Support Needed"

        if score >= 80:
            return "High Performer"
        elif score >= 60:
            return "On Track"
        elif score >= 40:
            return "Needs Improvement"
        else:
            return "Needs Immediate Support"

    result["student_category"] = result.apply(get_category, axis=1)

    return result
