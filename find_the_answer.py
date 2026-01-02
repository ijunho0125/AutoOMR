import pdfplumber
from google import genai
from google.genai import types
import json
import os
import sys
import os
from dotenv import load_dotenv

load_dotenv()

sys.stdout.reconfigure(encoding='utf-8')

# 1. Gemini API 설정
# .env 파일 혹은 시스템 환경변수로 GOOGLE_API_KEY를 설정하세요.
api_key = os.environ.get("GOOGLE_API_KEY")

if not api_key:
    print("Warning: GOOGLE_API_KEY environment variable is not set.")
    # You might want to allow it to be empty for manual JSON upload mode
    # But for AI processing, it will fail later.

client = genai.Client(api_key=api_key)

# 2. PDF에서 텍스트 추출 (2단 편집 고려)
def extract_text_from_pdf(pdf_path):
    full_text = ""
    # pdf_path가 파일 경로(str)일 수도 있고, 파일 객체일 수도 있음
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            width = page.width
            height = page.height
            
            # 2단 분리
            left_bbox = (0, 0, width * 0.5, height)
            right_bbox = (width * 0.5, 0, width, height)
            
            # 텍스트 추출
            left_text = page.crop(left_bbox).extract_text() or ""
            right_text = page.crop(right_bbox).extract_text() or ""
            
            full_text += left_text + "\n" + right_text + "\n"
            
    if not full_text.strip():
        raise ValueError("PDF에서 텍스트를 추출할 수 없습니다. (Scanned PDF or Empty)")
        
    return full_text

# 3. Gemini에게 정답 추출 요청
def get_answers_via_gemini(raw_text):
    # 텍스트 압축 (불필요한 공백 제거)
    compressed_text = " ".join(raw_text.split())

    prompt = f"""
    Extract exam answers from text as JSON list.
    Schema: [{{"no": int, "answer": str (convert ①->1), "type": "multiple_choice"|"descriptive"}}]
    For descriptive, set answer to "" and type to "descriptive".

    Text:
    {compressed_text}
    """
    
    # API 호출
    # 모델 버전은 사용자가 지정한 'gemini-2.5-flash' 유지
    response = client.models.generate_content(
        model="gemini-2.5-flash", 
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    
    # 텍스트 결과를 JSON 객체로 변환해서 반환
    try:
        return json.loads(response.text)
    except Exception:
        # 혹시나 마크다운 코드 블록이 포함되어 있을 경우 제거 시도
        text = response.text.replace("```json", "").replace("```", "")
        return json.loads(text)

# --- 실행 테스트 ---
if __name__ == "__main__":
    pdf_file_path = "answer.pdf" 

    if os.path.exists(pdf_file_path):
        print("PDF 텍스트 추출 중...")
        extracted_text = extract_text_from_pdf(pdf_file_path)
        
        print("Gemini 분석 중...")
        try:
            answers = get_answers_via_gemini(extracted_text)
            print("\n--- 분석 결과 ---")
            for item in answers:
                q_type = "객관식" if item.get('type') == 'multiple_choice' else "서술형"
                print(f"문제 {item['no']} ({q_type}) => 정답: {item.get('answer', '-')}")
                
        except Exception as e:
            print(f"오류: {e}")
    else:
        print(f"파일을 찾을 수 없습니다: {pdf_file_path}")