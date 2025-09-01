import os
from flask import Flask, request, jsonify
from sudachipy import dictionary, tokenizer
import re
import json
from flask_cors import CORS
from PyPDF2 import PdfReader
import docx

app = Flask(__name__)
cors = CORS(app, origins='*')

base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(base_dir, '..', '..'))
jmdict_path = os.path.join(project_root, 'src', 'furigana-api', 'jmdict_all_eng.json')
with open(jmdict_path, encoding="utf-8") as f:
    jmdict = json.load(f).get("words", [])

mode = tokenizer.Tokenizer.SplitMode.C

def kata_to_hira(katakana):
    return ''.join(
        chr(ord(c) - 0x60) if 'ァ' <= c <= 'ン' else c
        for c in katakana
    )

def lookup_translation(lemma, reading_hira, jmdict_entries):
    for entry in jmdict_entries:
        if not isinstance(entry, dict):
            continue
        for kanji_form in entry.get("kanji", []):
            if lemma == kanji_form.get("text"):
                gloss_texts = [
                    gloss.get("text", "")
                    for sense in entry.get("sense", [])
                    for gloss in sense.get("gloss", [])
                    if gloss.get("lang") == "eng"
                ]
                return "/".join(gloss_texts[:3])
        for kana_form in entry.get("kana", []):
            if reading_hira == kana_form.get("text"):
                gloss_texts = [
                    gloss.get("text", "")
                    for sense in entry.get("sense", [])
                    for gloss in sense.get("gloss", [])
                    if gloss.get("lang") == "eng"
                ]
                return "/".join(gloss_texts[:3])
    return ""

def read_txt(file_content):
    encodings_to_try = ['utf-8', 'cp932', 'shift_jis', 'euc-jp']
    for encoding in encodings_to_try:
        try:
            return file_content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ValueError("Failed to decode text file with common encodings.")

def read_pdf(file_stream):
    try:
        pdf_reader = PdfReader(file_stream)
        text_content = ""
        for page in pdf_reader.pages:
            text_content += page.extract_text()
        return text_content
    except Exception as e:
        raise ValueError(f"Error reading PDF: {e}")

def read_docx(file_stream):
    try:
        doc = docx.Document(file_stream)
        text_content = ""
        for para in doc.paragraphs:
            text_content += para.text + "\n"
        return text_content
    except Exception as e:
        raise ValueError(f"Error reading DOCX: {e}")

@app.route("/analyze", methods=["POST"])
def analyze():
    tokenizer_obj = dictionary.Dictionary().create()
    
    start_position = 0
    page_size = 1000
    total_length = 0
    page_text = None
    
    # Check if a file was uploaded
    if 'file' in request.files and request.files['file'].filename != '':
        file = request.files['file']
        start_position = int(request.form.get("start_position", 0))
        page_size = int(request.form.get("page_size", 1000))
        filename = file.filename
        file_ext = os.path.splitext(filename)[1].lower()
        
        try:
            # ✅ Try reading as a text file
            try:
                file_content_binary = file.read()
                decoded_text = read_txt(file_content_binary)
                page_text = decoded_text
                print(f"Uploaded file successfully decoded as a text file.")
            except ValueError:
                # ✅ If TXT fails, try as a PDF or DOCX
                file.seek(0)
                if file_ext == '.pdf':
                    decoded_text = read_pdf(file)
                    if not decoded_text.strip():
                        # The PDF has no readable content (likely image-only)
                        return jsonify({"error": "The PDF has no readable content. It may be an image or scanned document."}), 400
                    page_text = decoded_text
                    print(f"Uploaded file successfully read as a PDF.")
                elif file_ext in ['.docx', '.doc']:
                    decoded_text = read_docx(file)
                    page_text = decoded_text
                    print(f"Uploaded file successfully read as a DOCX.")
                else:
                    return jsonify({"error": f"File type '{file_ext}' is not supported."}), 415

            total_length = len(decoded_text)
            page_text = decoded_text[start_position : start_position + page_size]
                
        except Exception as e:
            print(f"An unexpected error occurred with the uploaded file: {e}")
            return jsonify({"error": "An unexpected error occurred with the uploaded file."}), 500

    else:
        # ✅ Fallback logic for hardcoded file path (for debugging)
        data = request.get_json()
        filepath = data.get("filepath", "Texts.txt")
        start_position = int(data.get("start_position", 0))
        page_size = int(data.get("page_size", 1000))
        text_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', filepath)
        
        try:
            with open(text_path, 'rb') as f:
                file_content_binary = f.read()
                page_text = read_txt(file_content_binary)
            
            total_length = len(page_text)
            page_text = page_text[start_position : start_position + page_size]
            print(f"Local file successfully read from '{filepath}'.")
        except FileNotFoundError:
            print(f"Local file not found at: {text_path}")
            return jsonify({"error": "File not found"}), 404
        except ValueError as ve:
            print(f"ValueError reading local file: {ve}")
            return jsonify({"error": "Failed to decode local text file with common encodings."}), 500
        
    if not page_text:
        return jsonify({"data": [], "totalLength": 0})

    paragraphs = page_text.split("\n")
    output = []
    id_counter = 1

    for para in paragraphs:
        para_output = []
        for morpheme in tokenizer_obj.tokenize(para, mode):
            surface = morpheme.surface()
            reading_kata = morpheme.reading_form()
            reading_hira = kata_to_hira(reading_kata)
            lemma = morpheme.dictionary_form()

            if re.search(r'[\u4E00-\u9FFF]', surface):
                translation = lookup_translation(lemma, reading_hira, jmdict)
                para_output.append({
                    "type": "word",
                    "kanji": surface,
                    "furigana": reading_hira,
                    "translation": translation,
                    "id": id_counter,
                    "showFurigana": False,
                    "showTranslation": False
                })
                id_counter += 1
            else:
                para_output.append({
                    "type": "text",
                    "value": surface
                })
        output.append(para_output)
    
    return jsonify({"data": output, "totalLength": total_length})

if __name__ == "__main__":
    app.run(debug=True, port=8080)
else:
    print("hello")  