# 🎯 AutoOMR

AI Smart OMR is a premium web-based application that automatically analyzes exam answer keys and generates an interactive OMR sheet. Leveraging **Google Gemini**, it provides an intelligent, seamless experience for grading and practice.

![Main UI](static/images/AutoOMR.svg)
*(Note: Please ensure you have the screenshots in the images folder)*

---

## 🚀 Core Features

### 1. Dual-Mode Analysis
- **🤖 AI Auto-Analysis**: Upload a PDF answer key. The system uses Gemini (gemini-2.5-flash) to intelligently extract question numbers, types, and correct answers.
- **📝 Manual AI-Assisted**: Prefer using ChatGPT or Claude? Copy our optimized prompt, get the JSON result from your favorite AI, and upload the `.json` file directly.

### 2. Advanced Interactive OMR
- **Smart OMR Sheet**: Automatically generated based on analysis. supports 5-choice selection.
- **Deselecting Answers**: Click a selected bubble again to deselect—just like a real digital test.
- **Pagination**: Adjustable items per page (5, 10, 20, or All) for a focused grading experience.

### 3. Real-Time Grading & Feedback
- **⚡ Intermediate Check**: Check your progress while solving. Correct answers are marked with 'O', wrong ones with 'X'.
- **👁️ Show Answer**: After a wrong attempt, click "정답 보기" (Show Answer) to reveal the correct choice without resetting your session.
- **🏆 Total Grading**: Submit for a final score with a percentage breakdown.

### 4. Smart History & Backup
- **Client-Side History**: All analyzed files are saved to your browser's local storage.
- **Duplicate Prevention**: Detects and highlights existing files in your history before re-uploading, saving API token costs.
- **💾 Optimized Backup**: Export your entire history and work-in-progress to a minified JSON file. Import it anytime to restore your session.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11+, FastAPI
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Premium CSS3 (Glassmorphism, Parallax)
- **AI**: Google Gemini API (`gemini-2.5-flash`)
- **PDF Processing**: `pdfplumber`

---

## 📦 Setup & Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd G01_AutoOMR
   ```

2. **Install dependencies**
   ```bash
   pip install fastapi uvicorn pdfplumber google-genai
   ```

3. **Configure API Key**
   - Create a `.env` file in the root directory.
   - Add your Google Gemini API key:
     ```env
     GOOGLE_API_KEY=YOUR_API_KEY
     ```
   - *Note: Check `.env.example` for reference.*

4. **Run the server**
   ```bash
   python main.py
   ```
   The server starts at `http://localhost:8000`.

---

## 📂 Project Structure

```
AutoOMR/
├── main.py                # FastAPI server & endpoints
├── find_the_answer.py     # Gemini API integration & PDF logic
├── static/                # Frontend assets (The heart of the UI)
│   ├── index.html         # Main Application UI
│   ├── script.js          # Complex App Logic & State Management
│   ├── style.css          # Premium Design & Animations
│   └── images/            # Assets & Icons
└── README.md              # Project Documentation
```

---

## 📝 API Endpoints

- `POST /api/analyze`: Upload and process PDF to extract answers using AI.
- `GET /`: Serves the interactive OMR application.
