import pandas as pd
import json
import os
import re
import sys
import urllib.error
import urllib.request

os.chdir(os.path.dirname(os.path.abspath(__file__)))

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

SERVER_URL = 'http://localhost:3030'
SHEET = 'Calidad Dedicado'
COLUMNS = ['ID Deteccion', 'VersiOn', 'SUB Tipo de Spot', 'Marca', 'Submarca', 'Producto']

VALORES_PERMITIDOS = [
    'CORTINILLA COMERCIAL', 'MENCIÓN', 'BLOQUE PATROCINADO',
    'I. AMBIENTAL', 'SUPERIMPOSICION', 'I. ACTIVA', 'INFOMERCIAL',
    'ACCIÓN ESPECIAL', 'PATROCINIO', 'VIRTUAL', 'FESTEJO DE GOL'
]

REEMPLAZOS_TIPO = {
    'MENCIÓN': 'MENCION',
    'I. AMBIENTAL': 'I.AMBIENTAL',
    'I. ACTIVA': 'I.ACTIVA',
    'ACCIÓN ESPECIAL': 'ACCION ESPECIAL'
}


def limpiar_tipo(texto):
    """Normaliza el campo 'tipo' según las reglas del servidor (limpiarTipo)."""
    if not texto:
        return texto
    t = str(texto).strip().upper()
    for original, reemplazo in REEMPLAZOS_TIPO.items():
        t = t.replace(original, reemplazo)
    return t


def buscar_archivos(pattern):
    candidatos = {}
    for base in ('.', os.path.join('.', 'importID')):
        if not os.path.isdir(base):
            continue
        for f in os.listdir(base):
            m = re.search(pattern, f)
            if m:
                candidatos[int(m.group(1))] = os.path.join(base, f)
    return candidatos[max(candidatos)] if candidatos else None


def encontrar_filtrado():
    """Usa el último RevQA_*_filtrado.xlsx (datos limpios de ejecutar.bat)."""
    return buscar_archivos(r'RevQA_(\d+)_filtrado\.xlsx$')


def encontrar_revqa():
    """Fallback: último RevQA_*.xlsx crudo."""
    return buscar_archivos(r'RevQA_(\d+)\.xlsx$')


def filtrar_y_deduplicar(df):
    """Mantiene solo tipos permitidos y un código por spot (el ID más bajo)."""
    antes = len(df)
    df = df[df['SUB Tipo de Spot'].isin(VALORES_PERMITIDOS)]
    df = df.dropna(subset=['ID Deteccion'])
    df = df.loc[df.groupby(['VersiOn', 'SUB Tipo de Spot', 'Marca', 'Submarca', 'Producto'])['ID Deteccion'].idxmin()]
    df = df.reset_index(drop=True)
    return df, antes


def cargar_datos():
    """Prioriza el último _filtrado.xlsx (datos limpios de ejecutar.bat)."""
    filtrado = encontrar_filtrado()
    if filtrado:
        df = pd.read_excel(filtrado, usecols=COLUMNS)
        return df, f'archivo filtrado: {os.path.basename(filtrado)}'
    filepath = encontrar_revqa()
    if not filepath:
        print("No se encontró archivo RevQA_*_filtrado.xlsx ni RevQA_*.xlsx")
        sys.exit(1)
    df, antes = filtrar_y_deduplicar(pd.read_excel(filepath, sheet_name=SHEET, usecols=COLUMNS))
    return df, f'archivo raw filtrado ({antes} → {len(df)})'


def a_codigos(df):
    codigos = []
    for _, row in df.iterrows():
        id_raw = row['ID Deteccion']
        try:
            codigo = str(int(float(id_raw))).strip()
        except (ValueError, TypeError):
            codigo = str(id_raw).strip()
        if not codigo or codigo == 'nan':
            continue
        codigos.append({
            "codigo": codigo,
            "version": str(row['VersiOn']).strip(),
            "tipo": limpiar_tipo(row['SUB Tipo de Spot']),
            "marca": str(row['Marca']).strip(),
            "submarca": str(row['Submarca']).strip(),
            "producto": str(row['Producto']).strip()
        })
    return codigos


def enviar_lote(codigos):
    body = json.dumps({"codigos": codigos}).encode('utf-8')
    req = urllib.request.Request(
        SERVER_URL + '/api/codigos/batch',
        data=body,
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            print(f"OK — agregados: {data.get('agregados')}, actualizados: {data.get('actualizados')}, sin cambios: {data.get('sinCambios', 0)}, total DB: {data.get('total')}")
            return True
    except urllib.error.HTTPError as e:
        print(f"ERROR HTTP {e.code}: {e.read().decode('utf-8', 'replace')}")
        return False
    except Exception as e:
        print(f"No se pudo conectar al servidor en {SERVER_URL}: {e}")
        print("Asegúrate de que el servidor esté corriendo (INICIAR_CODIGOS.bat).")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("IMPORTACION EXCEL -> DB EN VIVO (lote atomico)")
    print("=" * 60)

    df, fuente = cargar_datos()
    print(f"Fuente: {fuente} — filas: {len(df)}")

    codigos = a_codigos(df)
    print(f"Códigos a enviar: {len(codigos)}")

    if not codigos:
        print("No hay códigos para importar.")
        sys.exit(1)

    print(f"Enviando lote a {SERVER_URL}/api/codigos/batch ...")
    if enviar_lote(codigos):
        print("Importacion atomica completada (con rollback automatico si falla).")
    else:
        sys.exit(1)
