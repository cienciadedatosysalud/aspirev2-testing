import hashlib
from typing import List
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile, Request,APIRouter
from fastapi.middleware.cors import CORSMiddleware
import glob
import json
import os
import time
import subprocess
from pathlib import Path
from starlette.responses import FileResponse, JSONResponse
import shutil
import duckdb
# from starlette.staticfiles import StaticFiles # <- Comentado, ya no servimos estáticos desde aquí
from fastapi.responses import StreamingResponse, PlainTextResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
import psutil
import zipfile
import io
from io import BytesIO
import re
import asyncio
from fastapi.responses import StreamingResponse
import httpx
import signal
from datetime import datetime

SCRIPTS_REL_PATH = "src/analysis-scripts"

app = FastAPI()

# Configuración ultra-permisiva (Solo para desarrollo)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite cualquier origen
    allow_credentials=False, # Importante: si usas "*", esto debe ser False
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_project_path_by_uuid(uuid: str):
    project_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "projects")
    conf_files_path = glob.glob(project_path + "/**/docs/CDM/cdmb_config.json", recursive=True)
    response = None
    for conf_file_path in conf_files_path:
        with open(conf_file_path, 'r') as config_file:
            file_contents = json.load(config_file)
            if 'uuid' in file_contents:
                if uuid == file_contents['uuid']:
                    response = conf_file_path.split('/docs')[0]
    return response


def get_hashed_files_list(ts, path, process):
    # Ensure path has a trailing slash for correct string replacement
    base_path = os.path.join(path, "")
    output_path = os.path.join(base_path, 'outputs', 'logs')
    
    # Ensure the logs/output directory exists before writing the JSON
    if not os.path.exists(output_path):
        os.makedirs(output_path)

    # Search for all files recursively
    files_to_hash = glob.glob(os.path.join(base_path, '**'), recursive=True)
    hash_file = {"files": []}
    
    for filename in files_to_hash:
        if os.path.isfile(filename):
            # Check modification time (st_mtime) against the provided timestamp
            if ts <= os.stat(filename).st_mtime:
                # SHA-256 matches JavaScript's crypto.subtle implementation
                sha256_hash = hashlib.sha256()
                
                try:
                    with open(filename, "rb") as f:
                        # Read and update hash in chunks of 4K for memory efficiency
                        for byte_block in iter(lambda: f.read(4096), b""):
                            sha256_hash.update(byte_block)
                    
                    # Store relative path and the hex digest
                    hash_file['files'].append({
                        "filename": filename.replace(base_path, ''),
                        "hash": sha256_hash.hexdigest()
                    })
                except Exception as e:
                    print(f"Could not hash file {filename}: {e}")

    # Write the resulting JSON to the output path
    json_name = f'hashed_files_list_{process}_process.json'
    with open(os.path.join(output_path, json_name), 'w') as outfile:
        json.dump(hash_file, outfile, indent=4)

    return hash_file


def delete_input_directory(file_paths_):
    log = "The information from the files has been loaded into the embedded database in case of success of the check process.\n" \
          "Proceeding to delete the csv files uploaded by the user.\n"
    files_to_delete = glob.glob(file_paths_ + "/**")
    try:
        for file in files_to_delete:
            os.remove(file)
            log += f"\n {file} deleted!"
    except Exception as e:
        log += str(e)
        pass
    return log




def parse_validation_log(log_text: str):
    entities_data = {}
    
    # 1. Identificar tablas por SQL
    sql_tables = re.findall(r'CREATE TABLE IF NOT EXISTS\s+([\w_]+)\s*\(', log_text, re.IGNORECASE)
    
    # 2. Identificar Missing por Warning de cabecera
    missing_matches = re.findall(r'WARNING:: No file.*?configuration of the "([\w_]+)" entity', log_text)
    
    unique_entities = set(sql_tables + missing_matches)

    for ent in unique_entities:
        ent_name = ent.strip()
        
        # BUSCAR CONTEO: "tabla... 0 records"
        records_match = re.search(rf'{re.escape(ent_name)}.*?\s+(\d+)\s+records', log_text, re.IGNORECASE | re.DOTALL)
        total_regs = int(records_match.group(1)) if records_match else None
        
        is_missing = re.search(rf'WARNING:: No file.*?configuration of the "{re.escape(ent_name)}" entity', log_text)

        if is_missing:
            status = "missing"
            final_count = 0
        elif total_regs == 0:
            # REGLA ORO: Match con fichero pero 0 registros -> FATAL
            status = "fatal"
            final_count = 0
        elif total_regs is not None and total_regs > 0:
            status = "success"
            final_count = total_regs
        else:
            # Estado preventivo mientras el log termina o si no se encuentra línea
            status = "success"
            final_count = 0

        entities_data[ent_name] = {
            "entity": ent_name,
            "status": status,
            "totalRecords": final_count
        }

    return list(entities_data.values())


# =========================================================
# NUEVOS ENDPOINTS ADAPTADOS PARA EL FRONTEND REACT (ASTRO)
# =========================================================


@app.post("/api/system/process/kill/{pid}")
async def kill_process(pid: int):
    """
    Busca al proceso y a todos sus descendientes para matarlos en cadena.
    """
    try:
        parent = psutil.Process(pid)
        # Obtenemos todos los hijos recursivamente
        children = parent.children(recursive=True)
        
        # 1. Matamos a los hijos primero (de abajo hacia arriba)
        for child in children:
            child.kill() # Envía SIGKILL
            
        # 2. Matamos al proceso padre
        parent.kill()
        
        # Esperamos un momento para que el OS limpie la tabla de procesos
        psutil.wait_procs(children + [parent], timeout=3)
        
        return {"status": "success", "message": f"Killed process {pid} and {len(children)} children."}
    
    except psutil.NoSuchProcess:
        # Tal vez el padre ya murió pero los hijos siguen vivos
        # En este caso, el PID que tenemos ya no sirve. 
        # Por eso es vital que check_analysis_process devuelva el PID del hijo si el padre no existe.
        raise HTTPException(status_code=404, detail="Primary process not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/get-raw-log/{project_id}", response_class=PlainTextResponse)
async def get_raw_log(project_id: str, file: str):
    path = get_project_path_by_uuid(project_id)
    if not path:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Determinar carpeta según extensión o nombre
    subfolder = "logs" if file.endswith(".log") else "dqa"
    log_file_path = os.path.join(path, "outputs", subfolder, file)
    
    if not os.path.exists(log_file_path):
        return f"File {file} not found. The process might not have started yet."

    try:
        with open(log_file_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        return f"Error reading log: {str(e)}"


def get_entity_count_from_db(project_id: str, entity: str):
    """
    Consulta la tabla en la base de datos para obtener el número de filas actual.
    """
    try:
        # Ejemplo con DuckDB (ajusta a tu conexión real)
        db_path = os.path.join(get_project_path_by_uuid(project_id), "inputs", "data.duckdb")
        if not os.path.exists(db_path): return None
        
        import duckdb
        conn = duckdb.connect(db_path)
        # Importante: Asegúrate de que el nombre de la tabla sea seguro
        result = conn.execute(f'SELECT COUNT(*) FROM "{entity}"').fetchone()
        conn.close()
        return result[0] if result else 0
    except Exception as e:
        print(f"Error consultando DB para {entity}: {e}")
        return None

   
@app.get("/api/parse-logs/{project_id}")
async def get_current_logs(project_id: str):
    path = get_project_path_by_uuid(project_id)
    if not path: return {"info": []}
    
    log_path = os.path.join(path, "outputs", "logs", "checking_data_syntax.log")
    rules_path = os.path.join(path, "outputs", "dqa", "validator_output.json")
    
    entities_map = {}

    # 1. PARSEAR EL LOG DE SINTAXIS (Ficheros missing y conteo inicial)
    if os.path.exists(log_path):
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                # Usamos la función parse_validation_log que detecta SQL y WARNING
                syntax_results = parse_validation_log(f.read())
                for item in syntax_results:
                    entities_map[item["entity"]] = {
                        "entity": item["entity"],
                        "status": item["status"],
                        "totalRecords": item.get("totalRecords", 0),
                        "ruleFails": 0,
                        "catalogFails": 0,
                        "naCount": 0,
                        "rulesList": [],
                        "catalogList": [],
                        "naList": []
                    }
        except Exception as e:
            print(f"Error parseando checking_data_syntax.log: {e}")

    # 2. PARSEAR EL JSON DEL VALIDADOR (Enriquecimiento de métricas DQA)
    if os.path.exists(rules_path):
        try:
            with open(rules_path, "r", encoding="utf-8") as f:
                rules_data = json.load(f)
            
            for item in rules_data.get("info", []):
                ent = item.get("entity")
                if ent not in entities_map:
                    entities_map[ent] = {
                        "entity": ent, 
                        "status": "success", 
                        "totalRecords": 0
                    }
                
                rules_list = item.get("rules", [])
                catalog_list = item.get("catalog_checking", [])
                na_list = item.get("na_count_list", [])

                # Actualizamos métricas. El status 'fatal' del paso 1 se mantiene 
                # si total_registries sigue siendo 0.
                entities_map[ent].update({
                    "totalRecords": item.get("total_registries", 0),
                    "ruleFails": sum(int(r.get("total_wrong_lines", 0)) for r in rules_list),
                    "catalogFails": sum(int(c.get("total_wrong_lines", 0)) for c in catalog_list),
                    "naCount": sum(int(n.get("na_count", 0)) for n in na_list),
                    "rulesList": rules_list,
                    "catalogList": catalog_list,
                    "naList": na_list
                })
        except Exception as e:
            print(f"Error parseando validator_output.json: {e}")
    
    # 3. VERIFICACIÓN FINAL Y FALLBACK CON DB
    # Recorremos todas las entidades detectadas para validar el estado 'fatal'
    for ent_name in entities_map.keys():
        data = entities_map[ent_name]
        
        # Si el conteo es 0 y no es porque falte el fichero (missing)
        if data["totalRecords"] == 0 and data["status"] != "missing":
            # Consultamos la DB para desempatar
            db_count = get_entity_count_from_db(project_id, ent_name)
            
            if db_count and db_count > 0:
                # Si hay datos en DB, el log falló o estaba incompleto: es Success
                entities_map[ent_name].update({
                    "totalRecords": db_count,
                    "status": "success"
                })
            else:
                # Si en la DB también hay 0, confirmamos el Incumplimiento
                entities_map[ent_name]["status"] = "fatal"
                entities_map[ent_name]["totalRecords"] = 0

    return {"info": list(entities_map.values())}
    

@app.get("/api/projects")
def get_projects():
    project_path = os.path.join(os.path.dirname(os.path.realpath(__file__)), "projects")
    conf_files_path = glob.glob(project_path + "/**/docs/CDM/cdmb_config.json", recursive=True)
    response = []
    for conf_file_path in conf_files_path:
        with open(conf_file_path, 'r') as config_file:
            file_contents = json.load(config_file)
            if 'metadata' in file_contents and 'cohort' in file_contents and 'uuid' in file_contents:
                
                # Extraemos las entidades para la UI
                expected_entities = []
                if 'entities' in file_contents:
                    expected_entities = [ent['name'] for ent in file_contents['entities']]

                response.append({
                    "root_path": conf_file_path.split('/docs')[0],
                    'id': file_contents['uuid'], 
                    'name': file_contents['metadata'].get('project', 'Unknown Project'), 
                    'entities': expected_entities,
                    'data': {
                        'metadata': file_contents['metadata'],
                        'cohort': file_contents['cohort']
                    }
                })
    return response 


@app.get("/api/projects/dbinfo/{project_id}")
def get_projects_db(project_id: str):
    path = get_project_path_by_uuid(project_id)
    if not path:
        return []

    conf_files_path = os.path.join(path, "docs/CDM/cdmb_config.json")
    database_path = os.path.join(path, "inputs/data.duckdb")
    query = ""
    result = []
    
    with open(conf_files_path, 'r') as config_file:
        file_contents = json.load(config_file)
        if 'entities' in file_contents:
            entities = file_contents['entities']
            idx = 0
            for entity in entities:
                query = query + \
                        "select '{entity_name}' as entity ,count(*) as n_registries from {table_name} " \
                            .format(entity_name=entity['name'], table_name=entity['name'])
                if idx < len(entities) - 1:
                    query = query + "\nunion all \n"
                idx += 1
            try:
                con = duckdb.connect(database_path, read_only=True)
                df_count = con.query(query).to_df()
                # Adaptado para AnalysisPanel.jsx: { name: 'patients', count: 1200 }
                result = [{"name": row["entity"], "count": row["n_registries"]} for row in df_count.to_dict(orient="records")]
            except Exception:
                # Si la base de datos está vacía o purgada, devuelve cuenta 0
                result = [{"name": entity['name'], "count": 0} for entity in entities]
                return result
    return result

@app.delete("/api/projects/dbinfo/{project_id}")
async def purge_project_data(project_id: str):
    try:
        path = get_project_path_by_uuid(project_id)
        if not path:
            raise HTTPException(status_code=404, detail="Project path not found")
            
        db_path = os.path.join(path, "inputs/data.duckdb")
        
        # Conexión a la base de datos
        conn = duckdb.connect(db_path)
        
        # 1. Obtener nombres de todas las VISTAS
        views = conn.execute("SELECT view_name FROM duckdb_views WHERE schema_name = 'main'").fetchall()
        for (v_name,) in views:
            conn.execute(f'DROP VIEW IF EXISTS "{v_name}"')
            
        # 2. Obtener nombres de todas las TABLAS
        tables = conn.execute("SELECT table_name FROM duckdb_tables WHERE schema_name = 'main'").fetchall()
        for (t_name,) in tables:
            # Usamos CASCADE para que si hay algo dependiendo de la tabla también se limpie
            conn.execute(f'DROP TABLE IF EXISTS "{t_name}" CASCADE')
        
        conn.close()
        
        return {
            "status": "success", 
            "message": f"Cleaned {len(views)} views and {len(tables)} tables from project {project_id}."
        }
    
    except Exception as e:
        # Si el archivo no existe, el catálogo ya está limpio por defecto
        if "database file does not exist" in str(e).lower() or "No such file" in str(e):
            return {"status": "success", "message": "Database not found, assuming clean state."}
        
        raise HTTPException(status_code=500, detail=f"Purge error: {str(e)}")

@app.get("/api/system/status")
def get_system_status():
    try:
        mem_info = psutil.virtual_memory()
        ram_percentage = mem_info.percent
        return {
            "ram_percentage": ram_percentage,
            "versions": {
                "aspire": os.getenv("ASPIRE_VERSION", "v2.5.0"),
                "analysis": os.getenv("PIPELINE_VERSION", "v1.12.0"),
                "container": "Local Node"
            }
        }
    except Exception as e:
         return {"ram_percentage": 0, "versions": {"aspire": "error", "analysis": "error", "container": "error"}}



@app.get("/api/system/process/{project_id}")
async def check_analysis_process(project_id: str):
    """
    Checks if any process is running in analysis, check_load, dqa, or validation folders.
    """
    path = get_project_path_by_uuid(project_id)
    if not path:
        return {"isRunning": False, "scriptName": None}

    # Definimos las carpetas críticas
    folders = ["analysis-scripts", "check_load-scripts", "dqa-scripts", "validation-scripts"]
    folders_pattern = "|".join(folders)
    
    # El comando ahora busca: (ruta del proyecto) Y (cualquiera de las carpetas) Y (cualquiera de los intérpretes)
    cmd = (
        f'ps -ef | grep "{path}/src/" | '
        f'grep -E "{folders_pattern}" | '
        f'grep -E "python3|Rscript|quarto" | grep -v grep'
    )
    
    try:
        output = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT)
        output_str = output.decode('utf-8').strip()
        
        if not output_str:
            return {"isRunning": False, "scriptName": None}

        # Extraer el nombre del script (buscando por extensión)
        words = output_str.split()
        final_script_name = "Active Process"
        
        for word in words:
            if any(word.lower().endswith(ext) for ext in ['.py', '.r', '.qmd']):
                final_script_name = os.path.basename(word)
                break

        return {
            "isRunning": True, 
            "scriptName": final_script_name,
            "pid": words[1] if len(words) > 1 else None
        }
        
    except subprocess.CalledProcessError:
        return {"isRunning": False, "scriptName": None}

# =========================================================
# ENDPOINTS ORIGINALES DE EJECUCIÓN Y GESTIÓN DE ARCHIVOS
# =========================================================

@app.get("/api/results/{project_id}")
def get_results_by_project(project_id: str):
    # 1. Get Project Path
    path = get_project_path_by_uuid(project_id)
    if not path:
        raise HTTPException(status_code=404, detail="Project path not found")

    outputs_path = os.path.join(path, "outputs")
    config_file_path = os.path.join(path, "docs", "CDM", "cdmb_config.json")

    # 2. Load Metadata
    project_name = "Unknown"
    if os.path.exists(config_file_path):
        with open(config_file_path, 'r') as f:
            content = json.load(f)
            project_name = content.get('metadata', {}).get('project', 'Project')

    # 3. Scan Files recursively
    all_files = glob.glob(os.path.join(outputs_path, "**", "*"), recursive=True)
    response_files = []

    for file_path in all_files:
        if not os.path.isfile(file_path):
            continue

        filename = os.path.basename(file_path)
        rel_path = os.path.relpath(file_path, outputs_path)
        
        # Classification Logic
        category = "analysis" 
        if "logs" in rel_path:
            category = "logs"
        elif "dqa" in rel_path or "validator" in filename.lower():
            category = "dqa"
        elif filename.lower().endswith(('.log', '.txt')) and "logs" not in rel_path:
            category = "logs"

        # Calculate Size
        size_bytes = os.path.getsize(file_path)
        #size_str = f"{size_bytes / 1024:.1f} KB" if size_bytes < 1024**2 else f"{size_bytes / 1024**2:.1f} MB"
        
        # Get modification time
        mtime = os.path.getmtime(file_path)

        response_files.append({
            "name": filename,
            "category": category,
            "size": size_bytes,
            "mtime": mtime, # Keep numeric for sorting
            "date": time.strftime('%Y-%m-%d %H:%M', time.localtime(mtime)),
            "path": rel_path 
        })

    # --- ENHANCED SORTING ---
    # Primary: is_html (False/0 comes before True/1)
    # Secondary: mtime (Descending)
    response_files.sort(
        key=lambda x: (not x['name'].lower().endswith('.html'), -x['mtime'])
    )

    return {
        "project": project_name,
        "uuid": project_id,
        "files": response_files
    }


@app.get("/api/projects/outputs/{project_id}/preview/{category}/{filename:path}")
def preview_output_file(project_id: str, category: str, filename: str):
    path = get_project_path_by_uuid(project_id)
    if not path:
        raise HTTPException(status_code=404, detail="Project not found")

    # --- LÓGICA DE RUTAS DINÁMICA ---
    if category == "audit":
        # Los scripts de auditoría están en /src/analysis-scripts/
        base_folder = os.path.join(path, "src", "analysis-scripts")
    else:
        # Los resultados normales están en /outputs/
        subfolder = ""
        if category == "logs":
            subfolder = "logs"
        elif category == "dqa":
            subfolder = "dqa"
        base_folder = os.path.join(path, "outputs", subfolder)

    file_path = os.path.join(base_folder, filename)

    # Seguridad: Evitar Directory Traversal
    if not os.path.abspath(file_path).startswith(os.path.abspath(base_folder)):
        raise HTTPException(status_code=403, detail="Access denied")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")

    # --- DETERMINAR MEDIA TYPE ---
    media_type = "text/plain"
    if filename.lower().endswith(".html"):
        media_type = "text/html"
    elif filename.lower().endswith(".json"):
        media_type = "application/json"
    elif filename.lower().endswith((".png", ".jpg", ".jpeg")):
        media_type = "image/png"

    return FileResponse(file_path, media_type=media_type)

@app.get("/api/memoryusage")
def get_memory_usage():
    try:
        mem = psutil.virtual_memory()
        total_gb = mem.total / (1024 ** 3)
        available_gb = mem.available / (1024 ** 3)
        used_gb = total_gb - available_gb
        
        return {
            "percentage": mem.percent,
            "total_gb": round(total_gb, 2),
            "used_gb": round(used_gb, 2),
            "text": f"{round(used_gb, 2)} / {round(total_gb, 2)} GB",
            "status": "online"
        }
    except Exception as e:
        # Si algo falla, devolvemos valores neutros para no romper el front
        print(f"Error reading system memory: {e}")
        return {
            "percentage": 0,
            "total_gb": 0,
            "used_gb": 0,
            "text": "N/A",
            "status": "error"
        }


@app.get("/api/dqa/{project_id}")
def launch_dqa(project_id: str):
    path = get_project_path_by_uuid(project_id)
    dqa_path = os.path.join(path, 'src', 'dqa-scripts', 'dqa.py')
    
    if not os.path.exists(dqa_path):
        raise HTTPException(status_code=400, detail='Cannot find dqa.py in your project')
    
    # Definición de rutas
    outputs_base = os.path.join(path, 'outputs')
    logs_path = os.path.join(outputs_base, 'logs')
    dqa_results_path = os.path.join(outputs_base, 'dqa') # Nueva carpeta destino
    
    # Crear carpetas si no existen
    if not os.path.exists(logs_path):
        os.makedirs(logs_path)
    if not os.path.exists(dqa_results_path):
        os.makedirs(dqa_results_path)

    get_installed_libraries(logs_path, os.path.join(path, 'docs', 'CDM', 'cdmb_config.json'))
    
    ts_script = time.time()
    
    # Ejecución del proceso
    process = subprocess.Popen(
        ["python3", dqa_path],
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, 
        universal_newlines=True
    )
    
    output, error = process.communicate()
    process.wait()

    # Limpieza de caracteres ANSI
    clean_output = output
    for code in ["\x1b[39m", "\x1b[31m", "\x1b[1m", "\x1b[22m"]:
        clean_output = clean_output.replace(code, "")

    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"--- LOG GENERATED ON: {now} ---\n\n"
    log_file = os.path.join(logs_path, 'data_quality_assesment.log')
    if os.path.exists(log_file):
        os.remove(log_file)
    with open(log_file, 'w') as f:
        f.write(header)
        f.write(clean_output)

    # --- LÓGICA DE MOVIMIENTO DE FICHEROS DQA ---
    # Buscamos archivos que coincidan con dqa_*.html y dqa_*.json en la raíz de outputs
    # (Ajusta la ruta de búsqueda si dqa.py los genera en otro sitio)
    patterns = ["dqa_*.html", "dqa_*.json"]
    moved_files = []

    for pattern in patterns:
        # Buscamos archivos en la carpeta outputs base
        files_to_move = glob.glob(os.path.join(outputs_base, pattern))
        for file_path in files_to_move:
            file_name = os.path.basename(file_path)
            dest_path = os.path.join(dqa_results_path, file_name)
            
            # Mover archivo (sobrescribe si ya existe)
            shutil.move(file_path, dest_path)
            moved_files.append(file_name)

    get_hashed_files_list(ts_script, path, 'dqa')

    if process.returncode != 0:
        raise HTTPException(status_code=400, detail=clean_output)

    return {
        "status_code": process.returncode, 
        "output": clean_output,
        "moved_artifacts": moved_files # Informamos qué archivos se organizaron
    }




@app.get("/api/checking/{project_id}")
def launch_checking(project_id: str):
    path = get_project_path_by_uuid(project_id)
    if not path:
        raise HTTPException(status_code=404, detail="Project path not found")

    # --- 1. PURGA PREVENTIVA DE LA BASE DE DATOS ---
    db_path = os.path.join(path, "inputs/data.duckdb")
    try:
        # Abrimos conexión directa para limpiar el esquema 'main'
        conn = duckdb.connect(db_path)
        
        # Eliminar Vistas
        views = conn.execute("SELECT view_name FROM duckdb_views WHERE schema_name = 'main'").fetchall()
        for (v_name,) in views:
            conn.execute(f'DROP VIEW IF EXISTS "{v_name}"')
            
        # Eliminar Tablas
        tables = conn.execute("SELECT table_name FROM duckdb_tables WHERE schema_name = 'main'").fetchall()
        for (t_name,) in tables:
            conn.execute(f'DROP TABLE IF EXISTS "{t_name}" CASCADE')
        
        conn.close()
    except Exception as e:
        # Si la DB no existe o está corrupta, ignoramos y dejamos que check_load la cree de cero
        print(f"Pre-check purge skipped or failed: {str(e)}")

    # --- 2. CONFIGURACIÓN DE RUTAS ---
    checking_path = os.path.join(path, 'src', 'check_load-scripts', 'check_load.py')
    if not os.path.exists(checking_path):
        raise HTTPException(status_code=400, detail='Cannot find check_load.py in your project')

    output_path = os.path.join(path, 'outputs', 'logs')
    if not os.path.exists(output_path):
        os.makedirs(output_path)

    # --- 3. EJECUCIÓN DEL PROCESO ---
    get_installed_libraries(output_path, os.path.join(path, 'docs', 'CDM', 'cdmb_config.json'))
    ts_script = time.time()
    
    process = subprocess.Popen(["python3", checking_path],
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    output, error = process.communicate()
    process.wait()

    # Limpieza de caracteres de escape de color ANSI
    for code in ["\x1b[39m", "\x1b[31m", "\x1b[1m", "\x1b[22m"]:
        output = output.replace(code, "")

    # --- 4. LIMPIEZA DE FICHEROS Y LOGS ---
    input_directory = os.path.join(path, 'src', 'check_load-scripts', 'inputs')
    log_files_deletion = delete_input_directory(input_directory)
    output += log_files_deletion
    
    log_path = os.path.join(output_path, 'checking_data_syntax.log')
    if os.path.exists(log_path):
        os.remove(log_path)

    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"--- LOG GENERATED ON: {now} ---\n\n"    
    with open(log_path, 'w') as f:
        f.write(header)
        f.write(output)

    get_hashed_files_list(ts_script, path, 'check_load')

    if process.returncode != 0:
        raise HTTPException(status_code=400, detail=output)
        
    return {"status_code": process.returncode, "output": output}


@app.get("/api/validator/{project_id}")
def launch_validator(project_id: str):
    path = get_project_path_by_uuid(project_id)
    validator_path = os.path.join(path, 'src', 'validation-scripts', 'validator.py')
    
    if not os.path.exists(validator_path):
        raise HTTPException(status_code=400, detail='Cannot find validator.py')
    
    # Rutas clave
    output_path_root = os.path.join(path, 'outputs')
    logs_path = os.path.join(output_path_root, 'logs')
    dqa_folder = os.path.join(output_path_root, 'dqa')
    
    # --- 1. LIMPIEZA PREVENTIVA (CRÍTICO) ---
    # Borramos archivos de resultados previos para que, si falla, 
    # el backend no encuentre nada "viejo" que devolver al frontal.
    files_to_clean = [
        os.path.join(logs_path, 'checking_data_compliance.log'),
        os.path.join(logs_path, 'report_validation_report.log'),
        os.path.join(output_path_root, 'validator_output.json'), # El origen
        os.path.join(dqa_folder, 'validator_output.json')        # El destino final
    ]
    
    for f_path in files_to_clean:
        if os.path.exists(f_path):
            os.remove(f_path)

    # Aseguramos carpetas
    os.makedirs(logs_path, exist_ok=True)
    os.makedirs(dqa_folder, exist_ok=True)

    get_installed_libraries(logs_path, os.path.join(path, 'docs', 'CDM', 'cdmb_config.json'))
    ts_script = time.time()

    # 2. Ejecutar el validador
    process = subprocess.Popen(["python3", validator_path],
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    output, _ = process.communicate()
    process.wait()

    # Limpieza de ANSI y guardado de log
    for code in ["\x1b[39m", "\x1b[31m", "\x1b[1m", "\x1b[22m"]:
        output = output.replace(code, "")
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"--- LOG GENERATED ON: {now} ---\n\n"
    log_path = os.path.join(logs_path, 'checking_data_compliance.log')
    with open(log_path, 'w') as f:
        f.write(header)
        f.write(output)

    # 3. Solo si el validador tuvo éxito total (returncode 0)
    if process.returncode == 0:
        validator_report_path = os.path.join(path, 'src', 'validation-scripts', 'validator_report.qmd')
        
        # Renderizado de Quarto
        process_report = subprocess.Popen(["quarto", "render", validator_report_path, "--output-dir", "../../outputs/dqa"],
                                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
        output_report, _ = process_report.communicate()
        process_report.wait()

        # Guardar log del reporte
        with open(os.path.join(logs_path, 'report_validation_report.log'), 'w') as f:
            f.write(output_report)

        # --- MOVIMIENTO SEGURO DEL JSON ---
        json_source = os.path.join(output_path_root, 'validator_output.json')
        json_dest = os.path.join(dqa_folder, 'validator_output.json')

        if os.path.exists(json_source):
            shutil.move(json_source, json_dest)
        
        output += "\n Launching report: \n\n" + output_report

    # 4. Finalización
    get_hashed_files_list(ts_script, path, 'validator')

    if process.returncode != 0:
        # Si falló, FastAPI devuelve 400 y los archivos viejos ya fueron borrados en el Paso 1
        raise HTTPException(status_code=400, detail=output)
    
    return {"status_code": process.returncode, "output": output}


def get_installed_libraries(output_path: str, cdmb_config_path: str):
    script_version = f"""
    #!/bin/bash
    cdmb_version=$(cat {cdmb_config_path} | grep -E 'cdmb_version' | tr -d ' ",' | cut -d ':' -f 2)
    echo "CDMB version: $cdmb_version" > "{output_path}/sys_info.log"
    echo "ASPIRE version: $ASPIRE_VERSION" >> "{output_path}/sys_info.log"
    echo "Pipeline version: $PIPELINE_VERSION \n" >> "{output_path}/sys_info.log"
    """
    process = subprocess.Popen(script_version, shell=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    output, error = process.communicate()
    process.wait()

    script_memory = f"""
    #!/bin/bash
    output=$(cat /proc/meminfo | grep -E 'MemTotal|MemFree|MemAvailable')
    echo "$output \n" >> "{output_path}/sys_info.log"
    """
    process = subprocess.Popen(script_memory, shell=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    output, error = process.communicate()
    process.wait()
    script_libraries = f"""
    #!/bin/bash
    output=$(micromamba -n aspire list)
    echo "$output" >> "{output_path}/sys_info.log"
    """
    process = subprocess.Popen(script_libraries, shell=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT, universal_newlines=True)
    output, error = process.communicate()
    process.wait()

@app.get("/api/analysis/results/log/{project_id}")
async def get_analysis_log(project_id: str):
    path = get_project_path_by_uuid(project_id)
    if not path:
        raise HTTPException(status_code=404, detail="Project not found")
    
    log_path = os.path.join(path, "outputs", "logs", "analysis_execution.log")
    
    if not os.path.exists(log_path):
        return PlainTextResponse("No execution log found.", status_code=200)

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return PlainTextResponse(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/analysis/version-manifest/{project_id}")
async def get_version_manifest(project_id: str):
    # 1. Obtener ruta del proyecto
    project_path = get_project_path_by_uuid(project_id)
    if not project_path:
        raise HTTPException(status_code=404, detail="Project not found")

    # 2. Leer versiones de variables de entorno
    aspire_v = os.getenv("ASPIRE_VERSION", "Non-versioned")
    pipeline_v = os.getenv("PIPELINE_VERSION", "Non-versioned")
    repo_link = os.getenv("GITHUB_REPO",None)

    # 3. Leer versión del CDM desde el JSON del proyecto
    cdm_v = "Not found"
    config_path = os.path.join(project_path, "docs/CDM/cdmb_config.json")
    
    try:
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config_data = json.load(f)
                cdm_v = config_data.get("cdmb_version", "Not found") # Usamos el valor del JSON o el default
    except Exception as e:
        print(f"Error reading CDM config: {e}")
        cdm_v = "Error reading file"

    return {
        "aspire": aspire_v,
        "pipeline": pipeline_v,
        "cdm": cdm_v,
        "repository":repo_link
    }

@app.get("/api/analysis/check-updates/{project_id}")
async def check_updates(project_id: str):
    local_version = os.getenv("PIPELINE_VERSION", "Non-versioned")
    repo_path = os.getenv("GITHUB_REPO")
    
    # Si estamos en local o no hay repo configurado, salimos rápido
    if not repo_path or local_version == "Non-versioned":
        return {"update_available": False, "offline": True}

    try:
        # Usamos un timeout agresivo (p.ej. 2 segundos) para no bloquear la UI
        async with httpx.AsyncClient(timeout=10.0) as client:
            api_url = f"https://api.github.com/repos/{repo_path}/releases/latest"
            response = await client.get(api_url)
            
            if response.status_code == 200:
                remote_data = response.json()
                remote_version = remote_data.get("tag_name")
                return {
                    "update_available": remote_version != local_version,
                    "version": remote_version,
                    "current_version":local_version,
                    "offline": False
                }
    except (httpx.ConnectError, httpx.TimeoutException):
        # Si no hay internet, devolvemos un estado 'offline' en lugar de un error 500
        logging.warning("System offline: Unable to reach GitHub for update check.")
        return {
            "update_available": False, 
            "offline": True, 
            "current_version":local_version,
            "message": "Update server unreachable (Offline mode)"
        }
    
    return {"update_available": False, "offline": False}

@app.post("/api/analysis/update/{project_id}")
async def update_project_scripts(project_id: str):
    async def event_generator():
        project_path = get_project_path_by_uuid(project_id)
        
        # 1. Validación de ruta inicial
        if not project_path or not os.path.exists(project_path):
            yield f"data: {json.dumps({'msg': '❌ Project folder not found', 'type': 'error'})}\n\n"
            return

        scripts_path = os.path.join(project_path, SCRIPTS_REL_PATH)
        backup_path = f"{scripts_path}_backup"
        repo_path = os.getenv("GITHUB_REPO")
        
        try:
            yield f"data: {json.dumps({'msg': f'🌐 Connecting to GitHub: {repo_path}...', 'type': 'info'})}\n\n"
            
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                # Obtener info de release
                rel_res = await client.get(f"https://api.github.com/repos/{repo_path}/releases/latest")
                rel_res.raise_for_status()
                data = rel_res.json()
                zip_url = data.get("zipball_url")
                new_version = data.get("tag_name")

                yield f"data: {json.dumps({'msg': f'📦 Downloading release {new_version}...', 'type': 'info'})}\n\n"
                
                # Descargar ZIP
                zip_res = await client.get(zip_url)
                zip_res.raise_for_status()
                zip_data = io.BytesIO(zip_res.content)
            
            # --- PASO 3: BACKUP SEGURO ---
            yield f"data: {json.dumps({'msg': '🛡️ Creating safety backup...', 'type': 'info'})}\n\n"
            if os.path.exists(backup_path):
                shutil.rmtree(backup_path)
            if os.path.exists(scripts_path):
                shutil.copytree(scripts_path, backup_path)

            # --- PASO 4: EXTRACCIÓN ---
            yield f"data: {json.dumps({'msg': '📂 Extracting files to destination...', 'type': 'info'})}\n\n"
            
            with zipfile.ZipFile(zip_data) as z:
                root_in_zip = z.namelist()[0].split('/')[0]
                target_prefix = f"{root_in_zip}/{SCRIPTS_REL_PATH}/"
                
                files_to_extract = [f for f in z.namelist() if f.startswith(target_prefix)]

                if not files_to_extract:
                    raise Exception(f"Folder '{SCRIPTS_REL_PATH}' not found in ZIP.")

                # Limpiamos destino
                if os.path.exists(scripts_path):
                    shutil.rmtree(scripts_path)
                os.makedirs(scripts_path, exist_ok=True)

                for member in files_to_extract:
                    filename = os.path.relpath(member, target_prefix)
                    if filename == ".": continue
                    
                    # Notificar cada archivo copiado
                    yield f"data: {json.dumps({'msg': f'📄 Copying: {filename}', 'type': 'file'})}\n\n"
                    
                    target_file_path = os.path.join(scripts_path, filename)
                    
                    if member.endswith('/'):
                        os.makedirs(target_file_path, exist_ok=True)
                    else:
                        os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
                        with z.open(member) as source, open(target_file_path, "wb") as target:
                            shutil.copyfileobj(source, target)
                    
                    # Pequeño delay opcional para que la terminal sea legible en el front
                    await asyncio.sleep(0.02)

            # ÉXITO
            if os.path.exists(backup_path):
                shutil.rmtree(backup_path)
            
            os.environ["PIPELINE_VERSION"] = new_version
            yield f"data: {json.dumps({'msg': f'✅ Successfully updated to {new_version}', 'type': 'success', 'version': new_version})}\n\n"

        except Exception as e:
            # ROLLBACK
            if os.path.exists(backup_path):
                if os.path.exists(scripts_path):
                    shutil.rmtree(scripts_path)
                os.rename(backup_path, scripts_path)
                yield f"data: {json.dumps({'msg': '⚠️ Error. System rolled back to previous version.', 'type': 'warning'})}\n\n"
            
            yield f"data: {json.dumps({'msg': f'❌ Update failed: {str(e)}', 'type': 'error'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")



#@app.get("/api/analysis/{project_id}/{script_name}")
@app.get("/api/analysis/{project_id}/{script_name}")
async def launch_analysis(project_id: str, script_name: str):
    # 1. Validaciones de Ruta
    path = get_project_path_by_uuid(project_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Project path not found.")
    
    script_path = os.path.join(path, 'src', 'analysis-scripts', script_name)
    output_path = os.path.join(path, 'outputs', 'logs')
    log_path = os.path.join(output_path, 'analysis_execution.log')
    result_path = os.path.join(output_path, 'last_execution_result.json')
    
    if not os.path.exists(output_path): os.makedirs(output_path)
    if not os.path.exists(script_path):
        raise HTTPException(status_code=400, detail=f'Cannot find {script_name}')

    # 2. Definir Comando
    file_extension = os.path.splitext(script_path)[1].upper()
    if file_extension == ".R": cmd = ["Rscript", script_path]
    elif file_extension == ".PY": cmd = ["python3", script_path]
    elif file_extension == ".QMD": cmd = ["quarto", "render", script_path, "--output-dir", "../../outputs"]
    else: raise HTTPException(status_code=400, detail="Invalid extension")

    # 3. Preparar el archivo de Log (Limpieza inicial)
    now_start = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, 'w', encoding='utf-8') as f:
        f.write(f"--- LOG GENERATED ON: {now_start} ---\n\n")

    # 4. Lanzar el proceso Subprocess
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT
    )

    # --- TAREA DE FONDO (LOGGER) ---
    # Esta función corre de forma independiente al ciclo de vida de la petición HTTP
    async def logger_worker(proc, l_path, r_path, s_name):
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            
            # Decodificar y limpiar ANSI
            decoded = line.decode('utf-8', errors='replace').strip()
            clean_line = re.sub(r'\x1b\[[0-9;]*[mK]', '', decoded)
            
            # Escribir en disco inmediatamente (Modo Append)
            with open(l_path, 'a', encoding='utf-8') as f:
                f.write(clean_line + "\n")

        # Esperar a que el proceso termine realmente
        await proc.wait()

        final_status = "SUCCESS" if process.returncode == 0 else "FAILED"
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(f"\n--- EXECUTION FINISHED: {final_status} ---\n")

    # Lanzamos el worker al bucle de eventos del servidor
    asyncio.create_task(logger_worker(process, log_path, result_path, script_name))

    # --- GENERADOR PARA EL STREAMING (FEEDBACK VISUAL) ---
    async def event_generator():
        
        last_pos = 0
        # Mientras el proceso esté vivo o queden datos por leer del log
        while process.returncode is None:
            await asyncio.sleep(0.4) # Evitar saturación de I/O
            if os.path.exists(log_path):
                with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
                    f.seek(last_pos)
                    new_content = f.read()
                    last_pos = f.tell()
                    if new_content:
                        yield new_content
        
        # Última lectura tras finalizar el proceso para asegurar integridad
        await asyncio.sleep(0.5)
        with open(log_path, 'r', encoding='utf-8', errors='replace') as f:
            f.seek(last_pos)
            yield f.read()
            
        final_status = "SUCCESS" if process.returncode == 0 else "FAILED"
        #yield f"\n--- EXECUTION FINISHED: {final_status} ---\n"

    return StreamingResponse(event_generator(), media_type="text/plain")


@app.get("/api/analysis")
def get_analysis_scripts():
    projects = get_projects()
    response = {"scripts": []}
    # Adaptado para que lea la nueva estructura de lista directamente
    for project in projects:
        root_path = project['root_path']
        text_files = glob.glob(root_path + "/src/analysis-scripts/**.*", recursive=False)
        uuid = project['id']
        text_files = [file.rsplit('/', 1)[1] for file in text_files]
        text_files = [file for file in text_files if str(file.split('.')[1]).lower() in ["py", "r", "qmd"]]
        response["scripts"].append({"uuid": uuid, "files": text_files})
    return response


"""@app.get("/api/download/{project_id}")
def download_all(project_id: str):
    try:
        path_ = get_project_path_by_uuid(project_id)
        outputs_files = list(filter(os.path.isfile, glob.glob(os.path.join(path_ + "/outputs/**"), recursive=True)))
        return zipfiles(outputs_files)
    except:
        raise HTTPException(status_code=400, detail=f'Something went wrong trying to download all the files.')"""


@app.get("/api/projects/audit-scripts/{project_id}")
async def list_audit_scripts(project_id: str):
    project_path = get_project_path_by_uuid(project_id)
    if not project_path or not os.path.exists(project_path):
        raise HTTPException(status_code=404, detail="Project not found")

    # Ruta base de los scripts de análisis
    audit_path = os.path.join(project_path, "src/analysis-scripts")
    
    if not os.path.exists(audit_path):
        return []

    # 1. Buscamos todos los archivos de forma recursiva
    search_pattern = os.path.join(audit_path, "**/*.*")
    all_files = glob.glob(search_pattern, recursive=True)
    
    # 2. Aplicamos tu filtro específico de extensiones
    # Solo permitimos archivos que tengan un punto y cuya extensión sea py, r o qmd
    audit_files = []
    for file_path in all_files:
        if os.path.isfile(file_path):
            filename = os.path.basename(file_path)
            
            # Tu lógica de filtrado:
            if "." in filename:
                ext = filename.split('.')[1].lower()
                if ext in ["py", "r", "qmd"]:
                    stats = os.stat(file_path)
                    audit_files.append({
                        "name": os.path.relpath(file_path, audit_path),
                        "size": stats.st_size,
                        "extension": ext,
                        "last_modified": stats.st_mtime
                    })
            
    return sorted(audit_files, key=lambda x: x['name'])

        
@app.get("/api/projects/outputs/{project_id}/download-all")
def download_all_zip(project_id: str):
    path = get_project_path_by_uuid(project_id)
    outputs_path = os.path.join(path, "outputs")
    zip_path = os.path.join(path, f"bundle_{project_id}.zip")

    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(outputs_path):
            for file in files:
                full_path = os.path.join(root, file)
                zipf.write(full_path, os.path.relpath(full_path, outputs_path))

    return FileResponse(zip_path, filename=f"{project_id}_results.zip")

@app.delete("/api/projects/outputs/{project_id}")
def purge_project_outputs(project_id: str):
    path = get_project_path_by_uuid(project_id)
    outputs_path = os.path.join(path, "outputs")
    
    if os.path.exists(outputs_path):
        for item in os.listdir(outputs_path):
            item_path = os.path.join(outputs_path, item)
            if os.path.isdir(item_path):
                shutil.rmtree(item_path)
            else:
                os.remove(item_path)
    return {"status": "success"}

@app.get("/api/projects/outputs/{project_id}/download/{category}/{filename}")
def download_single(project_id: str, category: str, filename: str):
    path = get_project_path_by_uuid(project_id)
    # Mapping categories to subfolders
    sub = ""
    if category == "logs": sub = "logs"
    elif category == "dqa": sub = "dqa"
    
    file_path = os.path.join(path, "outputs", sub, filename)
    return FileResponse(file_path, filename=filename)


"""@app.get("/api/download/{project_id}/{filename}")
def download_file(project_id: str, filename: str):
    path_ = get_project_path_by_uuid(project_id)
    if '.log' in filename:
        file_path = os.path.join(path_, "outputs", "logs", filename)
        if os.path.exists(file_path):
            return FileResponse(path=file_path, filename=filename)
    file_path = os.path.join(path_, "outputs", filename)
    if os.path.exists(file_path):
        return FileResponse(path=file_path, filename=filename)
    raise HTTPException(status_code=400, detail=f'Cannot find {filename} file in your project')"""


@app.get("/api/datamodel/{project_id}")
async def download_documentation(project_id: str):
    path_ = get_project_path_by_uuid(project_id)
    file_list = glob.glob(path_ + "/docs/**", recursive=True)
    return zipfiles(file_list)


def zipfiles(file_list):
    io = BytesIO()
    with zipfile.ZipFile(io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip:
        for fpath in file_list:
            zip.write(fpath, arcname=str(fpath).split('projects/')[1])
        zip.close()
    return StreamingResponse(
        iter([io.getvalue()]),
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename=project_documentation"}
    )


@app.post("/api/uploadfiles/{project_id}")
async def create_upload_file(files: List[UploadFile], project_id: str):
    path_ = get_project_path_by_uuid(project_id)
    output_path = os.path.join(path_, 'outputs', 'logs')
    if not os.path.exists(output_path):
        os.makedirs(output_path)
    status = 0
    output = ""
    for upload_file in files:
        try:
            destination_path = Path(os.path.join(path_, "src", "check_load-scripts", "inputs", upload_file.filename))
            with destination_path.open("wb") as buffer:
                shutil.copyfileobj(upload_file.file, buffer)
            upload_file.file.close()
            output += f"\n {upload_file.filename} - size {os.stat(destination_path).st_size} bytes --> OK \n"
        except Exception as e:
            status = 1
            output += "\n"
            output += f"{upload_file.filename} - {str(e)}"
            output += "\n"
            raise HTTPException(status_code=400, detail=output)
        finally:
            upload_file.file.close()
    log_path = os.path.join(output_path, 'mapping_input_files.log')
    isExisting = os.path.exists(log_path)
    if isExisting:
        os.remove(log_path)
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"--- LOG GENERATED ON: {now} ---\n\n"
    with open(log_path, 'w') as f:
        f.write(header)
        f.write(output)
    return {"status_code": status, "output": output}


@app.delete("/api/delete/{project_id}")
async def delete_outputs_files(project_id: str):
    path_ = get_project_path_by_uuid(project_id)
    outputs_files = list(filter(os.path.isfile, glob.glob(path_ + "/outputs/**", recursive=True)))
    status = 0
    output = ""
    for file in outputs_files:
        try:
            os.remove(file)
            output += f"\n {file} --> DELETED \n"
        except Exception as e:
            status = 1
            output += "\n"
            output += f"{file} - {str(e)}"
            output += "\n"
            raise HTTPException(status_code=400, detail=output)
    return {"status_code": status, "output": output}


# Manejo global de excepciones para devolver JSON puro (sin redirigir)
@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    return JSONResponse({"detail": str(exc.detail)}, status_code=exc.status_code)





if __name__ == "__main__":
    # He puesto el puerto por defecto en 8000 (estándar de FastAPI)
    port = os.getenv('APP_PORT') if os.getenv('APP_PORT') else 8000
    host = os.getenv('APP_HOST') if os.getenv('APP_HOST') else "0.0.0.0"
    uvicorn.run(app, host=host, port=int(port))