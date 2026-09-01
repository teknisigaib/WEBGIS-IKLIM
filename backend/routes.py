import os
import io
import time
import json
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
import geojsoncontour
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

# Import fungsi dan variabel dari file yang udah kita pecah tadi
from config import MAP_CONFIGS, CSV_DIR, PNG_DIR, GEOJSON_DIR, get_db_connection
from map_engine import get_hth_color, get_or_calculate_idw, clean_and_inject_geojson, draw_print_layout
from ai_service import generate_ai_analysis

# Tambahin TIF_DIR
from config import MAP_CONFIGS, CSV_DIR, PNG_DIR, GEOJSON_DIR, TIF_DIR, get_db_connection

# Tambahin save_to_tiff
from map_engine import get_hth_color, get_or_calculate_idw, clean_and_inject_geojson, draw_print_layout, save_to_tiff

# Inisialisasi Router (pengganti 'app' di file ini)
router = APIRouter()

@router.get("/download-template")
async def download_template():
    return Response("LON,LAT,VAL\n117.15,-0.50,150", media_type="text/csv", headers={"Content-Disposition": "attachment; filename=template_bmkg.csv"})

@router.post("/generate-map")
async def generate_map(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), creator: str = Form("TIM FORECASTER"), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL")):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    map_config = MAP_CONFIGS[category]
    
    file_bytes = await file.read() 
    
    if category == "hari_tanpa_hujan":
        df_valid = pd.read_csv(io.BytesIO(file_bytes))
        df_valid = df_valid.rename(columns={col_lon: 'LON', col_lat: 'LAT', col_val: 'VAL'})
        raw_data = df_valid[['LON', 'LAT', 'VAL']].to_dict(orient='records')
        
        features = []
        for _, row in df_valid.iterrows():
            val = row['VAL']
            warna = get_hth_color(val, map_config["levels"], map_config["colors"])
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row['LON'], row['LAT']]},
                "properties": {
                    "val": val,
                    "fill": warna,
                    "range_text": f"{val}",
                    "category": category.replace("_", " ").title()
                }
            })
            
        ai_text = f"Peta Hari Tanpa Hujan (HTH) periode {period} di Kalimantan Timur menampilkan sebaran titik observasi tanpa interpolasi spasial."
        
        clean_geojson = {
            "type": "FeatureCollection", 
            "features": features,
            "metadata": {
                "map_type": map_config["title"],
                "period": period,
                "update_time": update_time,
                "creator": creator,
                "ai_analysis": ai_text
            }
        }
        
    else:
        grid_x, grid_y, grid_z, df_valid = get_or_calculate_idw(file_bytes, sigma, power, col_lon, col_lat, col_val)
        raw_data = df_valid[['LON', 'LAT', 'VAL']].to_dict(orient='records')
        ai_text = generate_ai_analysis(grid_x, grid_y, grid_z, map_config['title'], period, update_time, map_config)
        
        fig, ax = plt.subplots() 
        contour = ax.contourf(grid_x, grid_y, grid_z, levels=map_config["levels"], cmap=ListedColormap(map_config["colors"]), norm=BoundaryNorm(map_config["levels"], len(map_config["colors"])))
        geojson_str = geojsoncontour.contourf_to_geojson(contourf=contour, min_angle_deg=3.0, ndigits=5)
        plt.close(fig)
        
        clean_geojson = clean_and_inject_geojson(geojson_str, map_config, category, period, update_time, creator, ai_text)
        
    return {
        "status": "success", 
        "data": { "geojson": clean_geojson, "legend_config": map_config, "analysis_text": ai_text, "raw_data": raw_data }
    }

@router.post("/regenerate-analysis")
async def regenerate_analysis(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL"), custom_prompt: str = Form("")):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    map_config = MAP_CONFIGS[category]
    
    grid_x, grid_y, grid_z, _ = get_or_calculate_idw(await file.read(), sigma, power, col_lon, col_lat, col_val)
    ai_text = generate_ai_analysis(grid_x, grid_y, grid_z, map_config['title'], period, update_time, map_config, custom_prompt)
    
    return {"status": "success", "data": {"analysis_text": ai_text}}

@router.post("/preview-print")
async def preview_print(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), creator: str = Form("TIM FORECASTER"), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL")):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    
    file_bytes = await file.read()
    
    if category == "hari_tanpa_hujan":
        df_valid = pd.read_csv(io.BytesIO(file_bytes))
        df_valid = df_valid.rename(columns={col_lon: 'LON', col_lat: 'LAT', col_val: 'VAL'})
        buf = draw_print_layout(None, None, None, MAP_CONFIGS[category], period, update_time, creator, df_points=df_valid)
    else:
        grid_x, grid_y, grid_z, _ = get_or_calculate_idw(file_bytes, sigma, power, col_lon, col_lat, col_val)
        buf = draw_print_layout(grid_x, grid_y, grid_z, MAP_CONFIGS[category], period, update_time, creator)
    
    return Response(content=buf.getvalue(), media_type="image/png")

@router.post("/save-archive")
async def save_archive(file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), category: str = Form(...), period: str = Form(...), update_time: str = Form(...), creator: str = Form("TIM FORECASTER"), analysis_text: str = Form(""), col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL")):
    content = await file.read()
    filename_base = f"{category}_{period.replace(' ', '_').upper()}_{int(time.time())}" 
    
    with open(os.path.join(CSV_DIR, f"{filename_base}.csv"), "wb") as f_csv: f_csv.write(content)
    
    if category == "hari_tanpa_hujan":
        df_valid = pd.read_csv(io.BytesIO(content))
        df_valid = df_valid.rename(columns={col_lon: 'LON', col_lat: 'LAT', col_val: 'VAL'})
        
        buf = draw_print_layout(None, None, None, MAP_CONFIGS[category], period, update_time, creator, df_points=df_valid)
        with open(os.path.join(PNG_DIR, f"{filename_base}.png"), "wb") as f_png: f_png.write(buf.read())
        
        features = []
        for _, row in df_valid.iterrows():
            val = row['VAL']
            warna = get_hth_color(val, MAP_CONFIGS[category]["levels"], MAP_CONFIGS[category]["colors"])
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row['LON'], row['LAT']]},
                "properties": {
                    "val": val, "fill": warna, "range_text": f"{val}",
                    "category": category.replace("_", " ").title()
                }
            })
        clean_geojson = {
            "type": "FeatureCollection", "features": features,
            "metadata": {
                "map_type": MAP_CONFIGS[category]["title"],
                "period": period, "update_time": update_time,
                "creator": creator, "ai_analysis": analysis_text
            }
        }
        
    else:
        grid_x, grid_y, grid_z, _ = get_or_calculate_idw(content, sigma, power, col_lon, col_lat, col_val)
        
        buf = draw_print_layout(grid_x, grid_y, grid_z, MAP_CONFIGS[category], period, update_time, creator)
        with open(os.path.join(PNG_DIR, f"{filename_base}.png"), "wb") as f_png: f_png.write(buf.read())

        # --- TAMBAHAN KODE CETAK TIF ---
        tif_path = os.path.join(TIF_DIR, f"{filename_base}.tif")
        save_to_tiff(grid_x, grid_y, grid_z, tif_path)
        # -------------------------------
        
        fig, ax = plt.subplots() 
        contour = ax.contourf(grid_x, grid_y, grid_z, levels=MAP_CONFIGS[category]["levels"], cmap=ListedColormap(MAP_CONFIGS[category]["colors"]), norm=BoundaryNorm(MAP_CONFIGS[category]["levels"], len(MAP_CONFIGS[category]["colors"])))
        geojson_str = geojsoncontour.contourf_to_geojson(contourf=contour, min_angle_deg=3.0, ndigits=5)
        plt.close(fig)
        
        clean_geojson = clean_and_inject_geojson(geojson_str, MAP_CONFIGS[category], category, period, update_time, creator, analysis_text)
        
    with open(os.path.join(GEOJSON_DIR, f"{filename_base}.json"), "w") as f_json: json.dump(clean_geojson, f_json)

    conn = get_db_connection()
    conn.execute('INSERT INTO saved_maps (title, category, period, update_time, sigma, power, creator, analysis_text, filename_base) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                 (MAP_CONFIGS[category]['title'], category, period, update_time, sigma, power, creator, analysis_text, filename_base))
    conn.commit(); conn.close()
    
    return {"status": "success", "filename": f"{filename_base}.png"}

@router.get("/archives")
async def get_archives():
    conn = get_db_connection()
    maps = conn.execute('SELECT * FROM saved_maps ORDER BY id DESC').fetchall()
    conn.close()
    
    result = []
    for row in maps:
        result.append({
            "id": row["id"],
            "title": row["title"],
            "category": row["category"],
            "period": row["period"],
            "update_time": row["update_time"],
            "creator": row["creator"],
            "filename_base": row["filename_base"],
            "analysis_text": row["analysis_text"] if "analysis_text" in row.keys() else ""
        })
    return {"status": "success", "data": result}

@router.delete("/archives/{item_id}")
async def delete_archive(item_id: int):
    conn = get_db_connection()
    record = conn.execute('SELECT filename_base FROM saved_maps WHERE id = ?', (item_id,)).fetchone()
    if not record: raise HTTPException(404, "Archive not found")
    conn.execute('DELETE FROM saved_maps WHERE id = ?', (item_id,))
    conn.commit(); conn.close()
    for path in [os.path.join(PNG_DIR, f"{record['filename_base']}.png"), os.path.join(GEOJSON_DIR, f"{record['filename_base']}.json"), os.path.join(CSV_DIR, f"{record['filename_base']}.csv"), os.path.join(TIF_DIR, f"{record['filename_base']}.tif")]:
        if os.path.exists(path): os.remove(path)
    return {"status": "success"}

@router.get("/archives/download/{file_type}/{filename_base}")
async def download_archive_file(file_type: str, filename_base: str):
    paths = {"png": (PNG_DIR, "image/png", ".png"), "geojson": (GEOJSON_DIR, "application/json", ".json"), "csv": (CSV_DIR, "text/csv", ".csv"), "tif": (TIF_DIR, "image/tiff", ".tif")}
    if file_type not in paths: raise HTTPException(400, "Invalid type")
    folder, mime, ext = paths[file_type]
    target = os.path.join(folder, f"{filename_base}{ext}")
    return FileResponse(target, media_type=mime, filename=f"{filename_base}{ext}")

class UpdateAnalysisModel(BaseModel):
    analysis_text: str

@router.put("/archives/{item_id}/analysis")
async def update_archive_analysis(item_id: int, data: UpdateAnalysisModel):
    conn = get_db_connection()
    conn.execute('UPDATE saved_maps SET analysis_text = ? WHERE id = ?', (data.analysis_text, item_id))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Analisis berhasil diperbarui"}