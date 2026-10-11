import os
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

try:
    from google import genai
    GENAI_AVAILABLE = True
except ImportError:
    genai = None
    GENAI_AVAILABLE = False


app = Flask(__name__)

# Allow your Netlify frontend to call this API.
CORS(
    app,
    origins=[
        "https://b4a.netlify.app",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ]
)

# Use a relative path so this works on your Mac and on Render.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, "data", "student_analytics_1000.csv")

# Read the Gemini API key from the environment.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")

# Create the Gemini client only if the SDK and API key are available.
gemini_client = None

if GENAI_AVAILABLE and GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)


def load_student_data():
    """Read the CSV and return a list of dictionaries."""
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"CSV file not found. Expected location: {CSV_PATH}"
        )

    df = pd.read_csv(CSV_PATH)

    # Replace NaN values with None so Flask can convert them to JSON null.
    df = df.where(pd.notnull(df), None)

    return df.to_dict(orient="records")


@app.route("/")
def home():
    return jsonify({
        "status": "ok",
        "message": "Edupulse Flask backend is running"
    })


@app.route("/api/health")
def health():
    return jsonify({
        "ai_provider": "Gemini" if gemini_client else "Not configured",
        "api_key_configured": bool(GEMINI_API_KEY),
        "dataset": CSV_PATH,
        "model": GEMINI_MODEL,
        "status": "ok"
    })


@app.route("/api/students")
def get_students():
    try:
        students = load_student_data()

        return jsonify({
            "status": "success",
            "count": len(students),
            "data": students
        })

    except FileNotFoundError as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": f"Failed to load student data: {str(error)}"
        }), 500


@app.route("/api/students/search")
def search_students():
    try:
        query = request.args.get("q", "").strip().lower()

        if not query:
            return jsonify({
                "status": "error",
                "message": "Add a search term, for example: /api/students/search?q=ramesh"
            }), 400

        students = load_student_data()

        results = []

        for student in students:
            for value in student.values():
                if value is not None and query in str(value).lower():
                    results.append(student)
                    break

        return jsonify({
            "status": "success",
            "count": len(results),
            "data": results
        })

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": str(error)
        }), 500


@app.route("/api/ai", methods=["POST"])
def ask_ai():
    try:
        if not gemini_client:
            return jsonify({
                "status": "error",
                "message": "Gemini API key is not configured"
            }), 500

        body = request.get_json(silent=True) or {}
        question = body.get("question", "").strip()

        if not question:
            return jsonify({
                "status": "error",
                "message": "Please send JSON like: {\"question\": \"Your question\"}"
            }), 400

        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=question
        )

        return jsonify({
            "status": "success",
            "question": question,
            "answer": response.text
        })

    except Exception as error:
        return jsonify({
            "status": "error",
            "message": f"Gemini request failed: {str(error)}"
        }), 500


if __name__ == "__main__":
    import os

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5001))
    )
    