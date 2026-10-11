# 🎓 EduPulse AI

### AI-Powered Student Analytics and Placement Support Platform

EduPulse AI is a student analytics platform designed to help educational institutions
understand student performance, identify students who may need academic support,
and provide data-driven recommendations for placement preparation.

The platform combines academic analytics, attendance monitoring, engagement insights,
skill assessment, and an AI-powered chatbot in a unified dashboard.

---

## 🚀 Features

### 📊 Student Analytics Dashboard
- Centralized dashboard for student performance insights.
- Analytics based on academic and engagement indicators.
- Student statistics and performance categories.

### 👨‍🎓 Student Management
- Student directory with search and filtering.
- Individual student performance information.
- Support for analyzing a dataset of 1,000 student records.

### 🎯 Placement Support
- Identifies academically strong students who may benefit from placement preparation.
- Uses coding, aptitude, and mock interview scores to identify potential support needs.
- Helps educators prioritize targeted interventions.

### 📚 Academic and Attendance Analytics
- CGPA and internal assessment insights.
- Attendance monitoring.
- Academic risk indicators and supporting reasons.

### 💻 Skills and Engagement Analytics
- Coding and aptitude performance.
- Technical and communication skill indicators.
- Assignment completion and LMS activity.
- Student engagement insights.

### 🤖 AI Chatbot
- AI-powered conversational assistance using Google's Gemini API.
- Designed to answer questions related to the student analytics platform.

### 💬 Feedback and Recommendations
- Feedback collection and analysis.
- Student engagement feedback summaries.
- Data-driven recommendations to support student improvement.

### 📥 Data Export
- Export student records and analytics for further analysis.

---

## 🛠️ Technology Stack

### Frontend
- React
- Vite
- JavaScript
- Recharts
- Lucide React

### Backend
- Python
- Flask
- Flask-CORS
- Pandas
- NumPy

### AI Integration
- Google Gemini API

### Data Storage
- CSV datasets
- SQLite for engagement feedback

---

## 📁 Project Structure

```text
Edupulse/
├── chatbot_api.py
├── chatbot.py
├── app.py
├── requirements.txt
├── .env
├── data/
│   ├── student_analytics_1000.csv
│   └── students_1000.csv
├── src/
│   ├── recommendations.py
│   ├── risk_analysis.py
│   ├── student_segmentation.py
│   └── success_score.py
└── frontend/
    ├── package.json
    ├── index.html
    └── src/
        ├── App.jsx
        └── api.js
        