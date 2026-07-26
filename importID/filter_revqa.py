import pandas as pd
import glob
import os
import re
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))

pattern = r'RevQA_(\d+)\.xlsx$'
files = [(f, re.search(pattern, f)) for f in os.listdir('.')]
files = [(f, m) for f, m in files if m]

if not files:
    print("No se encontró archivo RevQA_*.xlsx")
    exit(1)

filepath, _ = max(files, key=lambda x: int(x[1].group(1)))

columns = ['ID Deteccion', 'VersiOn', 'SUB Tipo de Spot', 'Marca', 'Submarca', 'Producto']

df = pd.read_excel(filepath, sheet_name='Calidad Dedicado', usecols=columns)

valores_permitidos = [
    'CORTINILLA COMERCIAL', 'MENCIÓN', 'BLOQUE PATROCINADO',
    'I. AMBIENTAL', 'SUPERIMPOSICION', 'I. ACTIVA', 'INFOMERCIAL',
    'ACCIÓN ESPECIAL', 'PATROCINIO', 'VIRTUAL', 'FESTEJO DE GOL'
]

antes = len(df)
df = df[df['SUB Tipo de Spot'].isin(valores_permitidos)]
df = df.loc[df.groupby(['VersiOn', 'SUB Tipo de Spot', 'Marca', 'Submarca', 'Producto'])['ID Deteccion'].idxmin()]
df = df[columns]
despues = len(df)

output = filepath.replace('.xlsx', '_filtrado.xlsx')
df.to_excel(output, index=False)

print(f"Archivo generado: {output} ({despues} de {antes} filas)")
