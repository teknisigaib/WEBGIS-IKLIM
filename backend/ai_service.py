import os
import re
import numpy as np
import pandas as pd
import geopandas as gpd
from scipy.spatial.distance import cdist
from google import genai
from dotenv import load_dotenv

# Import variabel Kaltim dari config.py
from config import REGION_DATA, boundary_file

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

ai_client = None
if GEMINI_API_KEY:
    ai_client = genai.Client(api_key=GEMINI_API_KEY)

def generate_ai_analysis(grid_x, grid_y, grid_z, category_label, period, update_time, map_config, custom_prompt=""):
    if not ai_client: 
        return "Draft AI Tidak Tersedia: API Key Gemini belum di-setting di file .env."
    
    try:
        gx, gy, gz = grid_x.ravel(), grid_y.ravel(), grid_z.ravel()
        valid_mask = ~np.isnan(gz)
        gx_valid, gy_valid, gz_valid = gx[valid_mask], gy[valid_mask], gz[valid_mask]
        
        if len(gz_valid) == 0:
            return "Tidak ada data spasial yang valid untuk dianalisis."
            
        geometry = gpd.points_from_xy(gx_valid, gy_valid)
        grid_gdf = gpd.GeoDataFrame({'VAL': gz_valid}, geometry=geometry, crs="EPSG:4326")
        
        levels = map_config.get("levels", [])
        labels = map_config.get("labels", [])
        
        range_labels = []
        range_to_cat = {}
        for i in range(len(levels)-1):
            # Sinkronisasi dengan custom_ranges kalau ada (biar AI bacanya rapi)
            if "custom_ranges" in map_config and i < len(map_config["custom_ranges"]):
                r_text = map_config["custom_ranges"][i]
            else:
                r_text = f"{levels[i]} - {levels[i+1]}" if levels[i+1] < 1000 else f"> {levels[i]}"
                
            range_labels.append(r_text)
            if i < len(labels):
                range_to_cat[r_text] = labels[i]
        
        grid_gdf['RENTANG'] = pd.cut(grid_gdf['VAL'], bins=levels, labels=range_labels, include_lowest=True, ordered=False)
        
        try:
            if boundary_file is not None and not boundary_file.empty:
                if boundary_file.crs is None: boundary_file.set_crs("EPSG:4326", inplace=True)
                joined_gdf = gpd.sjoin(grid_gdf, boundary_file, how="left", predicate="within")
                grid_gdf['KABUPATEN'] = joined_gdf['nm_dati2'].fillna("Wilayah Luar")
            else:
                raise ValueError("File Poligon tidak tersedia")
        except Exception as e:
            reg_coords = np.array([[r['lon'], r['lat']] for r in REGION_DATA])
            reg_names = [r['nama'] for r in REGION_DATA]
            if len(reg_coords) > 0:
                distances = cdist(np.c_[gx_valid, gy_valid], reg_coords)
                grid_gdf['KABUPATEN'] = [reg_names[i] for i in np.argmin(distances, axis=1)]
            else:
                grid_gdf['KABUPATEN'] = "Kalimantan Timur"

        satuan = map_config.get("unit", "mm")
        jenis_data = "Prakiraan" if "PRAKIRAAN" in category_label.upper() else "Analisis"
        
        total_kaltim_pixels = len(grid_gdf)
        ringkasan_range = ""
        
        for rentang in range_labels:
            df_rentang = grid_gdf[grid_gdf['RENTANG'] == rentang]
            if df_rentang.empty: continue
            
            pct_global = (len(df_rentang) / total_kaltim_pixels) * 100
            kab_details = []
            
            for kab in df_rentang['KABUPATEN'].unique():
                if kab == "Wilayah Luar": continue 
                
                tot_kab = len(grid_gdf[grid_gdf['KABUPATEN'] == kab])
                if tot_kab == 0: continue
                
                tot_rentang_kab = len(df_rentang[df_rentang['KABUPATEN'] == kab])
                pct_lokal = (tot_rentang_kab / tot_kab) * 100
                
                if pct_lokal >= 80: sebutan = "hampir seluruh"
                elif pct_lokal >= 50: sebutan = "sebagian besar"
                elif pct_lokal >= 15: sebutan = "sebagian"
                else: sebutan = "sebagian kecil"
                    
                nama_daerah = str(kab).replace("Kota ", "")
                kab_details.append(f"{sebutan} wilayah {nama_daerah}")
                
            kat = range_to_cat.get(rentang, "")
            if kab_details:
                detail_teks = ", ".join(kab_details)
                ringkasan_range += f"- {rentang} {satuan} (Kategori {kat}) [Mencakup {pct_global:.1f}% area Kaltim]: Terpantau di {detail_teks}\n"

        prompt = f"""
        Kamu adalah Prakirawan Cuaca (Forecaster) resmi BMKG Provinsi Kalimantan Timur. Buat narasi analisis cuaca (1-2 paragraf) berdasarkan data luasan spasial berikut:
        
        - Jenis Peta: {category_label} (Tipe Data: {jenis_data})
        - Periode: {period}
        - Tanggal Update: {update_time}

        Berikut adalah semua rentang curah hujan yang tercatat beserta porsi wilayah terdampak:
        {ringkasan_range}
        
        Aturan Penulisan (SANGAT PENTING):
        1. Awali kalimat pertama persis seperti ini: "Berdasarkan data peta {category_label} periode {period} dengan pembaruan tanggal {update_time}, secara umum kondisi cuaca di wilayah Provinsi Kalimantan Timur..."
        2. Gunakan gaya bahasa manusiawi, mengalir, dan mudah dipahami publik. HINDARI penggunaan persentase angka.
        3. Gunakan kata penghubung yang netral dan halus.
        4. Gabungkan nama-nama kabupaten yang memiliki kategori/rentang curah hujan yang sama ke dalam satu kalimat yang padu.
        5. Tulis dalam satu atau dua paragraf utuh, tanpa poin-poin/bullet, TANPA BOLD (**), dan TANPA ITALIC (*).
        """
        
        if custom_prompt.strip():
            prompt += f"\n\nINSTRUKSI TAMBAHAN DARI FORECASTER:\n{custom_prompt}\n(SANGAT PENTING: Harap sesuaikan gaya dan isi narasi mengikuti instruksi tambahan ini secara ketat!)"
        
        response = ai_client.models.generate_content(model='gemini-3.1-flash-lite', contents=prompt)
        text_result = response.text.strip()
        
        clean_text = re.sub(r'[*_#]', '', text_result)
        return clean_text
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Gagal menghasilkan analisis AI: {str(e)}"