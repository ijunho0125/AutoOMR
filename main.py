from fastapi import FastAPI, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import shutil
import os
import json
import asyncio
from typing import List
from find_the_answer import extract_text_from_pdf, get_answers_via_gemini

app = FastAPI()

# History management moved to client-side (localStorage)

@app.post("/api/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    # 0. Validate File Type
    if file.content_type != "application/pdf":
        return JSONResponse(status_code=400, content={"status": "error", "message": "PDF 파일만 업로드 가능합니다."})

    try:
        # 1. Extract Text
        text = await asyncio.to_thread(extract_text_from_pdf, file.file)
        print("Text extracted successfully.")

        # 2. Analyze with Gemini
        answers = await asyncio.to_thread(get_answers_via_gemini, text)
        
        # 3. Validate Answers
        if not answers:
             return JSONResponse(status_code=400, content={"status": "error", "message": "정답을 찾을 수 없습니다. 올바른 정답지 PDF인지 확인해주세요."})
             
        print("Analysis complete.")
        
        return JSONResponse(content={"status": "success", "answers": answers})

    except ValueError as ve:
        # Known validation errors (Page limit, Empty text)
        return JSONResponse(status_code=400, content={"status": "error", "message": str(ve)})
    except Exception as e:
        print(f"Error processing file: {e}")
        return JSONResponse(content={"status": "error", "message": str(e)}, status_code=500)

# Serve static files (HTML, CSS, JS)
# Mount static files to root "/" so index.html is served at http://localhost:8000/
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
