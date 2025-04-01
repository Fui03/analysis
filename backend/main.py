import os
import re
import io
import base64
import numpy as np
import pandas as pd
import shutil

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List

import openai
import pandasai as pai
from pandasai_openai import OpenAI
from pandasai import SmartDataframe

from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("Missing OPENAI_API_KEY in .env file.")

openai.api_key = OPENAI_API_KEY

llm = OpenAI(api_token=openai.api_key)
pai.config.set({"llm": llm})

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directory for saving uploaded files
DATA_FOLDER = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_FOLDER, exist_ok=True)

# Allowed file extensions
ALLOWED_EXTENSIONS = {"csv", "xls", "xlsx"}

def allowed_file_ext(ext: str) -> bool:
    return ext.lower() in ALLOWED_EXTENSIONS

def sanitize_basename(filename: str) -> str:
    base, ext = os.path.splitext(filename)
    base = base.lower()
    base = re.sub(r"[^a-z0-9-]", "", base)
    if not base:
        raise ValueError("Sanitized base name is empty after removing invalid chars.")
    return base

def find_file_for_base(base_name: str) -> str:
    all_files = os.listdir(DATA_FOLDER)
    for f in all_files:
        path = os.path.join(DATA_FOLDER, f)
        if os.path.isfile(path):
            _, ext = os.path.splitext(f)
            if allowed_file_ext(ext[1:]):
                if sanitize_basename(f) == base_name:
                    return f
    raise FileNotFoundError(f"No matching file in 'data' folder for base '{base_name}'.")

def ensure_dataset(base_name: str) -> str:
    dataset_dir = os.path.join("datasets", "mem", base_name)
    if not os.path.exists(dataset_dir):

        actual_filename = find_file_for_base(base_name)
        file_path = os.path.join(DATA_FOLDER, actual_filename)

        if actual_filename.lower().endswith(".csv"):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)

        df = df.replace([np.inf, -np.inf], None)
        df = df.where(pd.notnull(df), None)
        df_smart = SmartDataframe(df)
        pai.create(path=f"mem/{base_name}", df=df_smart.dataframe)
    return f"mem/{base_name}"

@app.delete("/remove")
def remove_dataset(name: str):
    try:
        actual_filename = find_file_for_base(name)
        file_path = os.path.join(DATA_FOLDER, actual_filename)
        
        os.remove(file_path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found on disk.")

    dataset_dir = os.path.join("datasets", "mem", name)
    if os.path.exists(dataset_dir):
        shutil.rmtree(dataset_dir, ignore_errors=True)

    return {"message": f"Dataset '{name}' removed successfully."}

@app.get("/list")
def list_bases() -> List[str]:
    result = set()
    all_files = os.listdir(DATA_FOLDER)
    for f in all_files:
        path = os.path.join(DATA_FOLDER, f)
        if os.path.isfile(path):
            _, ext = os.path.splitext(f)
            if allowed_file_ext(ext[1:]):
                try:
                    base = sanitize_basename(f)
                    result.add(base)
                except ValueError:
                    pass
    return sorted(result)

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    os.makedirs(DATA_FOLDER, exist_ok=True)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    original_ext = os.path.splitext(file.filename)[1].lower().lstrip(".")

    if not allowed_file_ext(original_ext):
        raise HTTPException(status_code=400, detail="File type not allowed.")

    try:
        base_name = sanitize_basename(file.filename)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    final_filename = f"{base_name}.{original_ext}"
    file_path = os.path.join(DATA_FOLDER, final_filename)

    with open(file_path, "wb") as f_out:
        f_out.write(await file.read())


    if file_path.endswith(".csv"):
        df = pai.read_csv(file_path)
    else:
        df = pd.read_excel(file_path)

    df.columns = df.columns.str.strip()
    smart_df = SmartDataframe(df)
    
    dataset_dir = os.path.join("datasets", "mem", base_name)
    if os.path.exists(dataset_dir):
        raise HTTPException(
            status_code=409,
            detail=f"Dataset '{base_name}' already exists. Please remove it first or rename your file."
        )
    
    pai.create(path=f"mem/{base_name}", df=smart_df.dataframe)

    return {"message": f"File '{final_filename}' uploaded successfully!"}

@app.get("/data")
def get_top_rows(name: str, top: int = 5):
    try:
        dataset_path = ensure_dataset(name)
        df = pai.load(dataset_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=e)
    
    df = df.fillna('-')
    rows = df.head(top).to_dict(orient="records")
    return {"rows": rows}

@app.post("/query")
def query_data(name: str, question: str):
    try:
        dataset_path = ensure_dataset(name)
        df_smart = pai.load(dataset_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    try:
        answer = pai.chat(question, df_smart)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    answer = str(answer)

    if isinstance(answer, str) and answer.endswith(".png"):
        with open(answer, "rb") as response_file:
            result = base64.b64encode(response_file.read()).decode("utf-8")
            return {"answer": result, "isGraph": True}

    return {"answer": answer, "isGraph": False}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=5000, reload=True)
