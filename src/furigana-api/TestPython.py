import json

try :
    with open(r"C:\Users\romai\FirstBareBonesProject\src\furigana-api\jmdict_all_eng.json", encoding="utf-8") as file:
        contentDictionary = json.load(file)
except FileNotFoundError:
    print("Error: The file 'jmdict_all_eng.json' was not found.")
    exit()
#print(contentDictionary["words"][30]["sense"][0]["gloss"][2]["text"])
anoHitoNoTranslation = contentDictionary["words"][30]["sense"][0]["gloss"][2]["text"]
print(anoHitoNoTranslation)
