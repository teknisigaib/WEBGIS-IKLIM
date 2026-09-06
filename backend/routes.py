import os
import io
import time
import json
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap, BoundaryNorm
import geojsoncontour
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request, Query, Header
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

# Import fungsi dan variabel dari file config, models, & map_engine
from config import MAP_CONFIGS, CSV_DIR, PNG_DIR, GEOJSON_DIR, TIF_DIR, get_db
from models import MapMetadata, MapFeature
from map_engine import get_hth_color, get_or_calculate_idw, clean_and_inject_geojson, draw_print_layout, save_to_tiff
from ai_service import generate_ai_analysis

# Inisialisasi Router
router = APIRouter()

# ==============================================================================
# 🛡️ GEMBOK KEAMANAN (STATIC TOKEN)
# ==============================================================================
def verify_forecaster(x_api_key: str = Header(None)):
    """
    Fungsi sakti buat ngunci rute. Cuma aplikasi React lu yang tau password ini.
    """
    SECRET_KEY = "Administrator96607" # Lu bisa ganti sesuka hati
    if x_api_key != SECRET_KEY:
        raise HTTPException(status_code=403, detail="Akses Ditolak! Anda bukan Forecaster BMKG.")

@router.get("/download-template")
async def download_template():
    return Response("LON,LAT,VAL,NAMA_LOKASI\n117.15,-0.50,150,Pos Hujan Samarinda", media_type="text/csv", headers={"Content-Disposition": "attachment; filename=template_bmkg.csv"})


# Tambahkan Depends(verify_forecaster) untuk mengunci rute ini
@router.post("/generate-map")
async def generate_map(
    file: UploadFile = File(...), 
    sigma: float = Form(2.0), 
    power: float = Form(2.0), 
    category: str = Form(...), 
    period: str = Form(...), 
    update_time: str = Form(...), 
    creator: str = Form("TIM FORECASTER"), 
    col_lon: str = Form("LON"), 
    col_lat: str = Form("LAT"), 
    col_val: str = Form("VAL"), 
    col_name: str = Form(None),
    lock: None = Depends(verify_forecaster) # <--- GEMBOK DIPASANG
):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    map_config = MAP_CONFIGS[category]
    
    file_bytes = await file.read() 
    
    if category == "hari_tanpa_hujan":
        file.file.seek(0)
        df = pd.read_csv(file.file)
        
        rename_mapping = { col_lon: 'LON', col_lat: 'LAT', col_val: 'VAL' }
        if col_name: rename_mapping[col_name] = 'NAMA_LOKASI'
            
        df = df.rename(columns=rename_mapping)
        df_valid = df.fillna(0)
        
        kolom_wajib = ['LON', 'LAT', 'VAL']
        if col_name: kolom_wajib.append('NAMA_LOKASI')
            
        raw_data = df_valid[kolom_wajib].to_dict(orient='records')
        
        features = []
        for _, row in df_valid.iterrows():
            val = row['VAL']
            warna = get_hth_color(val, map_config["levels"], map_config["colors"])
            nama_lok = row['NAMA_LOKASI'] if 'NAMA_LOKASI' in row else "Titik HTH"
            
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row['LON'], row['LAT']]},
                "properties": {
                    "val": val,
                    "nama": nama_lok,
                    "fill": warna,
                    "range_text": f"{val}",
                    "category": category.replace("_", " ").title()
                }
            })
            
        ai_text = generate_ai_analysis(None, None, None, map_config['title'], period, update_time, map_config, raw_data=raw_data)
        
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
async def regenerate_analysis(
    file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), 
    category: str = Form(...), period: str = Form(...), update_time: str = Form(...), 
    col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL"), custom_prompt: str = Form(""),
    lock: None = Depends(verify_forecaster) # <--- GEMBOK DIPASANG
):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    map_config = MAP_CONFIGS[category]
    
    grid_x, grid_y, grid_z, _ = get_or_calculate_idw(await file.read(), sigma, power, col_lon, col_lat, col_val)
    ai_text = generate_ai_analysis(grid_x, grid_y, grid_z, map_config['title'], period, update_time, map_config, custom_prompt)
    
    return {"status": "success", "data": {"analysis_text": ai_text}}


@router.post("/preview-print")
async def preview_print(
    file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), 
    category: str = Form(...), period: str = Form(...), update_time: str = Form(...), 
    creator: str = Form("TIM FORECASTER"), col_lon: str = Form("LON"), 
    col_lat: str = Form("LAT"), col_val: str = Form("VAL"), col_name: str = Form(None),
    lock: None = Depends(verify_forecaster) # <--- GEMBOK DIPASANG
):
    if category not in MAP_CONFIGS: raise HTTPException(400, "Invalid Category")
    
    file_bytes = await file.read()
    
    if category == "hari_tanpa_hujan":
        df_valid = pd.read_csv(io.BytesIO(file_bytes))
        rename_mapping = {col_lon: 'LON', col_lat: 'LAT', col_val: 'VAL'}
        if col_name: rename_mapping[col_name] = 'NAMA_LOKASI'
        df_valid = df_valid.rename(columns=rename_mapping)
        
        buf = draw_print_layout(None, None, None, MAP_CONFIGS[category], period, update_time, creator, df_points=df_valid)
    else:
        grid_x, grid_y, grid_z, _ = get_or_calculate_idw(file_bytes, sigma, power, col_lon, col_lat, col_val)
        buf = draw_print_layout(grid_x, grid_y, grid_z, MAP_CONFIGS[category], period, update_time, creator)
    
    return Response(content=buf.getvalue(), media_type="image/png")


# ==============================================================================
# 🚀 MIGRASI PENUH KE POSTGRESQL + POSTGIS MENGGUNAKAN ORM 
# ==============================================================================

@router.post("/save-archive")
async def save_archive(
    file: UploadFile = File(...), sigma: float = Form(2.0), power: float = Form(2.0), 
    category: str = Form(...), period: str = Form(...), update_time: str = Form(...), 
    creator: str = Form("TIM FORECASTER"), analysis_text: str = Form(""), 
    col_lon: str = Form("LON"), col_lat: str = Form("LAT"), col_val: str = Form("VAL"), 
    col_name: str = Form(None),
    db: Session = Depends(get_db),
    lock: None = Depends(verify_forecaster) # <--- GEMBOK DIPASANG
):
    content = await file.read()
    filename_base = f"{category}_{period.replace(' ', '_').upper()}_{int(time.time())}" 
    
    # 1. Simpan CSV Mentah
    with open(os.path.join(CSV_DIR, f"{filename_base}.csv"), "wb") as f_csv: f_csv.write(content)
    
    if category == "hari_tanpa_hujan":
        df_valid = pd.read_csv(io.BytesIO(content))
        rename_mapping = {col_lon: 'LON', col_lat: 'LAT', col_val: 'VAL'}
        if col_name: rename_mapping[col_name] = 'NAMA_LOKASI'
        df_valid = df_valid.rename(columns=rename_mapping)
        
        # Simpan PNG
        buf = draw_print_layout(None, None, None, MAP_CONFIGS[category], period, update_time, creator, df_points=df_valid)
        with open(os.path.join(PNG_DIR, f"{filename_base}.png"), "wb") as f_png: f_png.write(buf.read())
        
        features = []
        for _, row in df_valid.iterrows():
            val = row['VAL']
            warna = get_hth_color(val, MAP_CONFIGS[category]["levels"], MAP_CONFIGS[category]["colors"])
            nama_lok = row['NAMA_LOKASI'] if 'NAMA_LOKASI' in row else "Titik HTH"
            
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [row['LON'], row['LAT']]},
                "properties": {
                    "val": val, "nama": nama_lok, "fill": warna, "range_text": f"{val}",
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
        
        # Simpan PNG & TIF
        buf = draw_print_layout(grid_x, grid_y, grid_z, MAP_CONFIGS[category], period, update_time, creator)
        with open(os.path.join(PNG_DIR, f"{filename_base}.png"), "wb") as f_png: f_png.write(buf.read())

        tif_path = os.path.join(TIF_DIR, f"{filename_base}.tif")
        save_to_tiff(grid_x, grid_y, grid_z, tif_path)
        
        fig, ax = plt.subplots() 
        contour = ax.contourf(grid_x, grid_y, grid_z, levels=MAP_CONFIGS[category]["levels"], cmap=ListedColormap(MAP_CONFIGS[category]["colors"]), norm=BoundaryNorm(MAP_CONFIGS[category]["levels"], len(MAP_CONFIGS[category]["colors"])))
        geojson_str = geojsoncontour.contourf_to_geojson(contourf=contour, min_angle_deg=3.0, ndigits=5)
        plt.close(fig)
        
        clean_geojson = clean_and_inject_geojson(geojson_str, MAP_CONFIGS[category], category, period, update_time, creator, analysis_text)
        
    # Simpan JSON File
    with open(os.path.join(GEOJSON_DIR, f"{filename_base}.json"), "w") as f_json: json.dump(clean_geojson, f_json)

    # -------------------------------------------------------------------------
    # 2. INSERT KE POSTGRESQL (Tabel Induk: MapMetadata)
    # -------------------------------------------------------------------------
    new_map = MapMetadata(
        title=MAP_CONFIGS[category]['title'],
        category=category,
        period=period,
        update_time=update_time,
        analysis_text=analysis_text,
        # Kita pakai URL ini sekaligus buat nyimpan filename_base
        png_url=f"{filename_base}.png",
        geojson_url=f"{filename_base}.json",
        tif_url=f"{filename_base}.tif" if category != "hari_tanpa_hujan" else None
    )
    db.add(new_map)
    db.commit()      # Simpan untuk dapetin 'new_map.id'
    db.refresh(new_map)

    # -------------------------------------------------------------------------
    # 3. INSERT KE POSTGIS (Tabel Anak: MapFeature) - BEDAH GEOJSON!
    # -------------------------------------------------------------------------
    features_to_insert = []
    for feat in clean_geojson['features']:
        geom_json = json.dumps(feat['geometry'])
        
        # Cek properti val/label (HTH beda sama IDW)
        props = feat.get('properties', {})
        val = props.get('val', None)
        label = props.get('nama') if category == "hari_tanpa_hujan" else props.get('title', '')
        
        # Query Sakti PostGIS: Mengubah teks GeoJSON murni menjadi tipe data GEOMETRY Spatial
        geom_postgis = func.ST_SetSRID(func.ST_GeomFromGeoJSON(geom_json), 4326)
        
        db_feat = MapFeature(
            map_id=new_map.id,
            val=float(val) if val is not None else 0.0,
            category_label=label,
            geom=geom_postgis
        )
        features_to_insert.append(db_feat)
        
    if features_to_insert:
        db.add_all(features_to_insert)
        db.commit() # Simpan semua koordinat spasial sekaligus

    return {"status": "success", "filename": f"{filename_base}.png"}


# ==============================================================================
# 📄 PAGINATION UNTUK ARSIP
# ==============================================================================
@router.get("/archives")
async def get_archives(
    skip: int = Query(0, description="Mulai dari data ke-berapa (offset)"),
    limit: int = Query(20, description="Batas jumlah data yang diambil per halaman"),
    db: Session = Depends(get_db)
):
    # Hitung total data yang ada
    total_data = db.query(MapMetadata).count()
    
    # Ambil data pakai offset(skip) dan limit
    maps = db.query(MapMetadata).order_by(MapMetadata.id.desc()).offset(skip).limit(limit).all()
    
    result = []
    for row in maps:
        filename_base = row.png_url.replace('.png', '') if row.png_url else ""
        
        result.append({
            "id": row.id,
            "title": row.title,
            "category": row.category,
            "period": row.period,
            "update_time": row.update_time,
            "creator": "TIM FORECASTER", 
            "filename_base": filename_base,
            "analysis_text": row.analysis_text or ""
        })
        
    return {
        "status": "success", 
        "pagination": {
            "total_data": total_data,
            "limit": limit,
            "skip": skip,
            "has_more": (skip + limit) < total_data
        },
        "data": result
    }


@router.delete("/archives/{item_id}")
async def delete_archive(
    item_id: int, 
    db: Session = Depends(get_db),
    lock: None = Depends(verify_forecaster) # <--- GEMBOK DIPASANG
):
    record = db.query(MapMetadata).filter(MapMetadata.id == item_id).first()
    if not record: 
        raise HTTPException(404, "Archive not found")
        
    filename_base = record.png_url.replace('.png', '')
    
    # Hapus file fisik
    for path in [
        os.path.join(PNG_DIR, f"{filename_base}.png"), 
        os.path.join(GEOJSON_DIR, f"{filename_base}.json"), 
        os.path.join(CSV_DIR, f"{filename_base}.csv"), 
        os.path.join(TIF_DIR, f"{filename_base}.tif")
    ]:
        if os.path.exists(path): os.remove(path)
            
    # Hapus dari PostgreSQL (Otomatis menghapus data MapFeature karena fitur Cascade On Delete)
    db.delete(record)
    db.commit()
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
async def update_archive_analysis(
    item_id: int, 
    data: UpdateAnalysisModel, 
    db: Session = Depends(get_db),
    lock: None = Depends(verify_forecaster) # <--- GEMBOK DIPASANG
):
    record = db.query(MapMetadata).filter(MapMetadata.id == item_id).first()
    if not record:
        raise HTTPException(404, "Archive not found")
        
    record.analysis_text = data.analysis_text
    db.commit()
    
    return {"status": "success", "message": "Analisis berhasil diperbarui"}



# ==============================================================================
# 🌐 ENDPOINT KHUSUS UNTUK WEB UTAMA (PUBLIC API) - TERBUKA TANPA GEMBOK
# ==============================================================================
@router.get("/api/v1/maps/latest")
async def get_latest_map(
    request: Request,
    category: str = Query(None, description="Filter kategori peta, misal: hari_tanpa_hujan"),
    db: Session = Depends(get_db)
):
    """
    Endpoint ini dipakai oleh website utama BMKG untuk mengambil data peta paling baru.
    Bisa difilter berdasarkan kategori (opsional).
    """
    # 1. Bikin query dasar
    query = db.query(MapMetadata)
    
    # 2. Kalau web utama minta kategori spesifik, kita filter
    if category:
        query = query.filter(MapMetadata.category == category)
        
    # 3. Ambil 1 data yang paling terakhir disave (ORDER BY id DESC LIMIT 1)
    latest_map = query.order_by(MapMetadata.id.desc()).first()
    
    # 4. Kalau datanya kosong / belum ada arsip
    if not latest_map:
        raise HTTPException(status_code=404, detail="Data peta belum tersedia di server.")
        
    # 5. Dapatkan URL dasar (Base URL) dari server otomatis (contoh: http://localhost:8000)
    # Biar Frontend React nggak usah pusing nyari letak IP servernya
    base_url = str(request.base_url).rstrip("/")
    
    # 6. Susun response yang cantik dan bersih buat web utama
    return {
        "status": "success",
        "data": {
            "id": latest_map.id,
            "title": latest_map.title,
            "category": latest_map.category,
            "period": latest_map.period,
            "update_time": latest_map.update_time,
            "analysis_text": latest_map.analysis_text or "",
            "image_url": f"{base_url}/static/png/{latest_map.png_url}" if latest_map.png_url else None,
            "geojson_url": f"{base_url}/static/geojson/{latest_map.geojson_url}" if latest_map.geojson_url else None
        }
    }