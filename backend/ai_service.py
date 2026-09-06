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

def generate_ai_analysis(grid_x, grid_y, grid_z, category_label, period, update_time, map_config, custom_prompt="", raw_data=None):
    if not ai_client: 
        return "Draft AI Tidak Tersedia: API Key Gemini belum di-setting di file .env."
    
    try:
        # =========================================================================
        # 🟢 JALUR HTH (HARI TANPA HUJAN) - Berbasis Titik Stasiun
        # =========================================================================
        if "hari tanpa hujan" in category_label.lower():
            if not raw_data or len(raw_data) == 0:
                return "Tidak ada data stasiun HTH yang valid untuk dianalisis."

            levels = map_config.get("levels", [])
            labels = map_config.get("labels", [])
            
            # Kelompokkan pos hujan berdasarkan kategori
            kategori_stasiun = {label: [] for label in labels}
            
            for row in raw_data:
                val = float(row.get('VAL', 0))
                nama = row.get('NAMA_LOKASI', f"Pos di {row.get('LON')},{row.get('LAT')}")
                
                # Tentukan masuk kategori mana nilai 'val' ini
                for i in range(len(levels)-1):
                    if levels[i] <= val <= levels[i+1]:
                        kat_label = labels[i]
                        kategori_stasiun[kat_label].append(nama)
                        break

            # Bikin ringkasan buat disuapin ke AI
            ringkasan = ""
            for kat_label, list_pos in kategori_stasiun.items():
                if len(list_pos) > 0:
                    pos_terdampak = ", ".join(list_pos)
                    ringkasan += f"- Kategori {kat_label}: Terdapat {len(list_pos)} pos/titik (yakni di {pos_terdampak})\n"

            prompt = f"""
            Kamu adalah Prakirawan Cuaca (Forecaster) resmi BMKG Provinsi Kalimantan Timur. Buat narasi analisis singkat (1 paragraf) berdasarkan data titik pos hujan berikut:
            
            - Jenis Peta: {category_label}
            - Periode: {period}
            - Tanggal Update: {update_time}

            Berikut sebaran pos berdasarkan kategori Hari Tanpa Hujan:
            {ringkasan}
            
            Aturan Penulisan (SANGAT PENTING):
            1. Awali kalimat pertama persis: "Berdasarkan pemantauan {category_label} periode {period} update tanggal {update_time}, kondisi di wilayah Provinsi Kalimantan Timur..."
            2. Gunakan bahasa manusiawi, mengalir, dan mudah dipahami publik.
            3. Jika ada pos dengan kategori Ekstrem Panjang atau Sangat Panjang, sebutkan nama stasiun nya. Untuk kategori lain, biarkan saja
            4. Tulis dalam satu paragraf utuh, tanpa poin-poin/bullet, TANPA BOLD (**), dan TANPA ITALIC (*).
            5. Fokus pada fakta data yang diberikan. Jangan tambahkan saran, himbauan, peringatan dini, atau informasi yang tidak ada di data.
            """

        # =========================================================================
        # 🔵 JALUR CURAH HUJAN (IDW) - Berbasis Poligon/Area
        # =========================================================================
        else:
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
            ringkasan = ""
            
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
                    ringkasan += f"- {rentang} {satuan} (Kategori {kat}) [Mencakup {pct_global:.1f}% area Kaltim]: Terpantau di {detail_teks}\n"

            prompt = f"""
            Kamu adalah Prakirawan Cuaca (Forecaster) resmi BMKG Provinsi Kalimantan Timur. Buat narasi analisis cuaca singkat (1 paragraf) berdasarkan data luasan spasial berikut:
            
            - Jenis Peta: {category_label} (Tipe Data: {jenis_data})
            - Periode: {period}
            - Tanggal Update: {update_time}

            Berikut adalah semua rentang curah hujan yang tercatat beserta porsi wilayah terdampak:
            {ringkasan}
            
            Aturan Penulisan (SANGAT PENTING):
            1. Awali kalimat pertama persis: "Berdasarkan data peta {category_label} periode {period} update tanggal {update_time}, kondisi di wilayah Provinsi Kalimantan Timur..."
            2. Gunakan gaya bahasa manusiawi, mengalir, dan mudah dipahami publik. HINDARI penggunaan persentase angka.
            3. Gunakan kata penghubung yang netral dan halus. Jangan gunakan kata teknikal berlebihan.
            4. Gabungkan nama-nama kabupaten yang memiliki kategori/rentang curah hujan yang sama ke dalam satu kalimat padu, dipisahkan per label.
            5. Tulis dalam satu paragraf utuh, tanpa poin-poin/bullet, TANPA BOLD (**), dan TANPA ITALIC (*). Buat paragraf singkat.
            6. Fokus pada fakta data, jangan tambahkan saran atau himbauan.
            """

        # =========================================================================
        # 🟡 GENERATE KE GEMINI (BERLAKU UNTUK HTH & IDW)
        # =========================================================================
        if custom_prompt.strip():
            prompt += f"\n\nINSTRUKSI TAMBAHAN DARI FORECASTER:\n{custom_prompt}\n(SANGAT PENTING: Harap sesuaikan gaya dan isi narasi mengikuti instruksi tambahan ini secara ketat!)"
        
        response = ai_client.models.generate_content(model='gemini-3.1-flash-lite', contents=prompt)
        text_result = response.text.strip()
        
        # Bersihkan format markdown (bold dll) yang kadang bandel
        clean_text = re.sub(r'[*_#]', '', text_result)
        return clean_text
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return f"Gagal menghasilkan analisis AI: {str(e)}"