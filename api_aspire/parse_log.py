import re
import json

def parse_validation_log(log_text: str):
    """
    Parsea el log de ASPIRE y extrae un listado estructurado por entidad.
    """
    entities_data = {}

    # 1. Detectar entidades sin fichero (Missing / Not Found)
    missing_pattern = re.compile(r'WARNING:: No file.*?configuration of the "(.*?)" entity')
    for match in missing_pattern.finditer(log_text):
        ent = match.group(1)
        entities_data[ent] = {
            "entity": ent,
            "status": "missing",
            "totalRecords": 0,
            "headerMatch": False,
            "errorDetails": []
        }

    # 2. Detectar registros leídos por entidad
    # Busca bloques tipo: table "episode" \n ... \n INFO:: 2332 records read
    records_pattern = re.compile(r'table "(.*?)"[\s\S]*?(?:INFO|ERROR):: (\d+) records read')
    for match in records_pattern.finditer(log_text):
        ent = match.group(1)
        records = int(match.group(2))
        
        if ent not in entities_data:
            entities_data[ent] = {
                "entity": ent,
                "status": "success" if records > 0 else "fatal",
                "totalRecords": records,
                "headerMatch": True, # Asumimos True si llegó a intentar cargar
                "errorDetails": []
            }
        else:
            entities_data[ent]["totalRecords"] = records
            entities_data[ent]["status"] = "success" if records > 0 else "fatal"

    # 3. Extraer errores de Casting "Variable by Variable"
    # Dividimos el log por el separador de comprobación de variables
    var_blocks = log_text.split("ERROR:: Checking variable: ")
    
    for block in var_blocks[1:]:
        lines = block.strip().split('\n')
        if not lines: continue
        
        var_name = lines[0].strip()
        filename = ""
        affected_lines = 0
        examples = ""
        
        for line in lines:
            if line.startswith("ERROR:: Filename:"):
                filename = line.split(":")[2].strip().replace('.csv', '')
            elif "Found casting errors in" in line:
                match = re.search(r'(\d+) line', line)
                if match: affected_lines = int(match.group(1))
            elif "Example of erroneous values found:" in line:
                examples = line.split("found: ")[1].strip()
        
        # Asumimos que el filename coincide con la entidad (ej: transfusion.csv -> transfusion)
        entity_name = filename
        if entity_name and affected_lines > 0:
            if entity_name not in entities_data:
                entities_data[entity_name] = {
                    "entity": entity_name, "status": "fatal", "totalRecords": 0, 
                    "headerMatch": True, "errorDetails": []
                }
            
            entities_data[entity_name]["status"] = "fatal"
            entities_data[entity_name]["errorDetails"].append({
                "column": var_name,
                "affectedRows": affected_lines,
                "examples": examples
            })

    # Convertir el diccionario a una lista para el frontend
    return list(entities_data.values())

# Uso de ejemplo (asumiendo que log_text tiene el string que me pasaste):
# parsed_results = parse_validation_log(log_text)
# print(json.dumps(parsed_results, indent=2))