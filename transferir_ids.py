import pandas as pd
import json
import os
from datetime import datetime

def limpiar_tipo(texto):
    """
    Limpia y normaliza el campo 'tipo' según reglas específicas.
    Se espera que el texto ya esté en mayúsculas y sin espacios al inicio/final.
    """
    if not texto:
        return texto
    
    # Reemplazos exactos (después de .upper())
    reemplazos = {
        'MENCIÓN': 'MENCION',
        'I. AMBIENTAL': 'I.AMBIENTAL',
        'I. ACTIVA': 'I.ACTIVA',
        'ACCIÓN ESPECIAL': 'ACCION ESPECIAL'
    }
    
    for original, reemplazo in reemplazos.items():
        texto = texto.replace(original, reemplazo)
    
    return texto

def transferir_datos_excel_a_json():
    """
    Transfiere datos desde un archivo Excel a un archivo JSON existente,
    mapeando columnas específicas y evitando duplicados por código.
    """
    
    # Rutas de los archivos
    excel_path = "id_partido.xlsx"
    json_path = "db.json"
    output_path = "db_actualizado.json"
    
    # Verificar que el archivo Excel existe
    if not os.path.exists(excel_path):
        print(f"Error: No se encontró el archivo {excel_path}")
        return
    
    # Verificar que el archivo JSON existe
    if not os.path.exists(json_path):
        print(f"Error: No se encontró el archivo {json_path}")
        return
    
    try:
        # 1. Leer el archivo Excel
        print("Leyendo archivo Excel...")
        df = pd.read_excel(excel_path, sheet_name='Hoja1')
        
        # Mostrar información del Excel
        print(f"Columnas encontradas en Excel: {list(df.columns)}")
        print(f"Total de filas en Excel: {len(df)}")
        
        # 2. Leer el archivo JSON existente
        print("\nLeyendo archivo JSON existente...")
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        codigos_existentes = data.get('codigos', [])
        propietarios = data.get('propietarios', [])
        meta = data.get('meta', {})
        
        print(f"Total de códigos existentes en JSON: {len(codigos_existentes)}")
        
        # 3. Crear un conjunto de códigos existentes para búsqueda rápida
        codigos_existentes_set = {str(codigo['codigo']) for codigo in codigos_existentes}
        print(f"Códigos únicos existentes: {len(codigos_existentes_set)}")
        
        # 4. Encontrar el último ID usado
        if codigos_existentes:
            ultimo_id = max(codigo.get('id', 0) for codigo in codigos_existentes)
        else:
            ultimo_id = 0
        
        print(f"Último ID usado: {ultimo_id}")
        
        # 5. Procesar los datos del Excel
        print("\nProcesando datos del Excel...")
        nuevos_codigos = []
        codigos_omitidos = 0
        codigos_agregados = 0
        
        for index, row in df.iterrows():
            codigo = str(row.get('ID Deteccion', '')).strip()
            
            # Verificar que el código no esté vacío
            if not codigo or codigo == 'nan':
                continue
            
            # Verificar si el código ya existe
            if codigo in codigos_existentes_set:
                codigos_omitidos += 1
                continue
            
            # Obtener el tipo crudo, limpiarlo y normalizarlo
            tipo_crudo = str(row.get('SUB Tipo de Spot', '')).strip().upper() if pd.notna(row.get('SUB Tipo de Spot')) else ""
            tipo_limpio = limpiar_tipo(tipo_crudo)
            
            # Mapear las columnas según las especificaciones
            nuevo_registro = {
                "id": ultimo_id + len(nuevos_codigos) + 1,
                "codigo": codigo,
                "tipo": tipo_limpio,   # <-- Aquí se usa el valor ya limpiado
                "propietarios_ids": [],
                "version": str(row.get('VersiOn', '')).strip() if pd.notna(row.get('VersiOn')) else "",
                "marca": str(row.get('Marca', '')).strip() if pd.notna(row.get('Marca')) else "",
                "submarca": str(row.get('Submarca', '')).strip() if pd.notna(row.get('Submarca')) else "",
                "producto": str(row.get('Producto', '')).strip() if pd.notna(row.get('Producto')) else ""
            }
            
            nuevos_codigos.append(nuevo_registro)
            codigos_existentes_set.add(codigo)
            codigos_agregados += 1
            
            if codigos_agregados % 100 == 0:
                print(f"Procesados {codigos_agregados} nuevos códigos...")
        
        print(f"\nResumen del procesamiento:")
        print(f"- Códigos agregados: {codigos_agregados}")
        print(f"- Códigos omitidos (ya existían): {codigos_omitidos}")
        print(f"- Total de códigos en JSON actualizado: {len(codigos_existentes) + codigos_agregados}")
        
        # 6. Combinar códigos existentes con nuevos
        todos_codigos = codigos_existentes + nuevos_codigos
        
        # 7. Actualizar el meta
        nuevo_total = len(todos_codigos)
        meta_actualizado = {
            "total": nuevo_total,
            "ultima_actualizacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # 8. Crear el nuevo JSON
        nuevo_json = {
            "codigos": todos_codigos,
            "meta": meta_actualizado,
            "propietarios": propietarios
        }
        
        # 9. Guardar el nuevo JSON
        print(f"\nGuardando nuevo archivo JSON en: {output_path}")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(nuevo_json, f, ensure_ascii=False, indent=2)
        
        print("✅ Proceso completado exitosamente!")
        
        if nuevos_codigos:
            print(f"\nEjemplos de nuevos códigos agregados:")
            for i, codigo in enumerate(nuevos_codigos[:5]):
                print(f"  {i+1}. ID: {codigo['id']}, Código: {codigo['codigo']}, Tipo: {codigo['tipo']}, Versión: {codigo['version'][:50]}...")
        
        return nuevo_json
        
    except Exception as e:
        print(f"❌ Error durante el proceso: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def verificar_estructura():
    """
    Función opcional para verificar la estructura del Excel antes de procesar
    """
    try:
        df = pd.read_excel("id_partido.xlsx", sheet_name='Hoja1')
        print("Estructura del archivo Excel:")
        print(f"Número de filas: {len(df)}")
        print(f"Número de columnas: {len(df.columns)}")
        print(f"\nColumnas: {list(df.columns)}")
        print(f"\nPrimeras 5 filas:")
        print(df.head())
        
        columnas_requeridas = ['Marca', 'Submarca', 'Producto', 'VersiOn', 'SUB Tipo de Spot', 'ID Deteccion']
        columnas_faltantes = [col for col in columnas_requeridas if col not in df.columns]
        
        if columnas_faltantes:
            print(f"\n⚠️ Columnas faltantes: {columnas_faltantes}")
        else:
            print("\n✅ Todas las columnas requeridas están presentes")
            
    except Exception as e:
        print(f"Error al verificar estructura: {str(e)}")

if __name__ == "__main__":
    print("=" * 60)
    print("TRANSFERENCIA DE DATOS EXCEL A JSON")
    print("=" * 60)
    
    print("\n1. Verificando estructura del Excel...")
    verificar_estructura()
    
    print("\n2. Iniciando transferencia de datos...")
    resultado = transferir_datos_excel_a_json()
    
    if resultado:
        print("\n3. El archivo se ha guardado como 'db_actualizado.json'")
        print("   Puedes renombrarlo a 'db.json' si deseas reemplazar el original.")