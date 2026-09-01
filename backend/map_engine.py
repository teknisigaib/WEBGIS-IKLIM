import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
import matplotlib.patches as patches
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
from matplotlib.ticker import FuncFormatter
from scipy.spatial.distance import cdist
import geopandas as gpd
from matplotlib.colors import ListedColormap, BoundaryNorm
from scipy.ndimage import gaussian_filter
from fastapi import HTTPException
import io
import json
import geojsoncontour
from datetime import datetime, timezone
import os
# --- BYPASS KONFLIK POSTGIS & RASTERIO DI WINDOWS ---
if 'PROJ_LIB' in os.environ:
    del os.environ['PROJ_LIB']
if 'PROJ_DATA' in os.environ:
    del os.environ['PROJ_DATA']
# ----------------------------------------------------
import rasterio
from rasterio.transform import from_bounds

# Import variabel Kaltim yang udah di-load dari config.py
from config import boundary_file, kaltim_area, REGION_DATA

def get_hth_color(val, levels, colors):
    try:
        val = float(val)
        if val == 0: return colors[0]          
        elif 1 <= val <= 5: return colors[1]   
        elif 6 <= val <= 10: return colors[2]  
        elif 11 <= val <= 20: return colors[3] 
        elif 21 <= val <= 30: return colors[4] 
        elif 31 <= val <= 60: return colors[5] 
        elif val > 60: return colors[6]        
    except:
        pass
    return colors[0] 

def get_or_calculate_idw(content, sigma, power, col_lon="LON", col_lat="LAT", col_val="VAL"):
    grid_x, grid_y = np.mgrid[113.0:120.0:800j, -3.0:3.2:800j]
    try: 
        df = pd.read_csv(io.BytesIO(content), sep=None, engine='python')
    except: 
        raise HTTPException(status_code=400, detail="Format CSV tidak valid!")
    
    missing_selected = [c for c in [col_lon, col_lat, col_val] if c not in df.columns]
    if missing_selected:
        raise HTTPException(status_code=400, detail=f"Kolom tidak ditemukan: {','.join(missing_selected)}")
    
    df = df[[col_lon, col_lat, col_val]].copy()
    df.columns = ['LON', 'LAT', 'VAL']
    
    for col in ['LON', 'LAT', 'VAL']:
        if df[col].dtype == 'object': df[col] = df[col].astype(str).str.replace(',', '.')
        df[col] = pd.to_numeric(df[col], errors='coerce')
        
    df = df.dropna(subset=['LON', 'LAT', 'VAL'])
    df = df[(df['LON'] >= 113.0) & (df['LON'] <= 120.0) & (df['LAT'] >= -3.0) & (df['LAT'] <= 3.2)]
    x, y, z = df['LON'].values, df['LAT'].values, df['VAL'].values
    
    dist = cdist(np.c_[grid_x.ravel(), grid_y.ravel()], np.c_[x, y])
    dist[dist == 0] = 1e-10
    weights = 1.0 / (dist ** power)
    grid_z = (np.sum(weights * z, axis=1) / np.sum(weights, axis=1)).reshape(grid_x.shape)
    grid_z = gaussian_filter(grid_z, sigma=sigma)
    
    if kaltim_area is not None:
        grid_points = gpd.GeoSeries.from_xy(grid_x.ravel(), grid_y.ravel())
        grid_z[~grid_points.within(kaltim_area).values.reshape(grid_x.shape)] = np.nan
        
    return grid_x, grid_y, grid_z, df

def clean_and_inject_geojson(geojson_str, map_config, category, period, update_time, creator, analysis_text=""):
    geojson_dict = json.loads(geojson_str)
    unit_val = map_config.get("unit", "mm")
    levels = map_config.get("levels", [])
    colors = map_config.get("colors", [])
    labels = map_config.get("labels", [])

    legend_info = []
    for i in range(len(levels)-1):
        v_min, v_max = levels[i], levels[i+1]
        range_txt = f"{v_min} - {v_max}" if v_max < 1000 else f"> {v_min}"
        
        # Override pakai custom_ranges kalau ada di json
        if "custom_ranges" in map_config and i < len(map_config["custom_ranges"]):
            range_txt = map_config["custom_ranges"][i]
            
        legend_info.append({
            "min_value": v_min, "max_value": v_max, "range_text": range_txt,
            "color": colors[i] if i < len(colors) else "#cccccc", 
            "category": labels[i] if i < len(labels) else ""
        })

    geojson_dict["metadata"] = {
        "map_type": map_config['title'].upper(),
        "system_category": category,
        "period": period,
        "update_time": update_time,
        "creator": creator,
        "unit": unit_val,
        "province": "Kalimantan Timur",
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "author": "Stasiun Meteorologi Kelas III Aji Pangeran Tumenggung Pranoto - Samarinda",
        "analysis_text": analysis_text, 
        "legend": legend_info 
    }
    
    for feature in geojson_dict["features"]:
        range_text = feature["properties"].get("title", "")
        val_str = range_text.replace(" ", "")
        
        if "-" in val_str:
            v_min, v_max = float(val_str.split("-")[0]), float(val_str.split("-")[1])
        elif ">" in val_str:
            v_min, v_max = float(val_str.replace(">", "")), 9999.0
        else:
            v_min, v_max = 0.0, 0.0
            
        category_label = ""
        color_hex = "#cccccc" 
        
        for i in range(len(levels)-1):
            if levels[i] == v_min:
                if i < len(labels): category_label = labels[i]
                if i < len(colors): color_hex = colors[i]
                # Benerin teks rentang geojson sesuai custom_ranges
                if "custom_ranges" in map_config and i < len(map_config["custom_ranges"]):
                    range_text = map_config["custom_ranges"][i]
                break
                
        feature["properties"] = {
            "min_value": v_min, "max_value": v_max, "range_text": range_text,
            "category": category_label, "fill": color_hex, "fill-opacity": 0.85, 
            "stroke": color_hex, "stroke-width": 0, "stroke-opacity": 1.0
        }
        
    return geojson_dict

def format_lon(x, pos): return f"{int(x)}°0'0\"E"
def format_lat(y, pos): return f"{abs(int(y))}°0'0\"{ 'N' if y>=0 else 'S' }"

def draw_print_layout(grid_x, grid_y, grid_z, map_config, period, update_time, creator, df_points=None):
    levels, colors = map_config["levels"], map_config["colors"]
    labels = map_config.get("labels", [])
    unit = map_config.get("unit", "mm")
    
    fig = plt.figure(figsize=(10.52, 7.44), dpi=150, facecolor='white')
    fig.patch.set_linewidth(0)
    fig.add_artist(patches.Rectangle((0, 0), 1, 1, transform=fig.transFigure, facecolor='none', edgecolor='black', linewidth=3, clip_on=False))
    
    gs = GridSpec(1, 2, width_ratios=[2.2, 1], wspace=0.06, left=0.03, right=0.98, top=0.98, bottom=0.02)
    ax_map = fig.add_subplot(gs[0])
    ax_map.set_facecolor('#8be1ff') 
    for spine in ax_map.spines.values(): spine.set_linewidth(1)
    
    try:
        malaysia = gpd.read_file('malaysia.json')
        malaysia.plot(ax=ax_map, color='#808080', edgecolor='none', zorder=1)
    except: pass

    try: 
        indo = gpd.read_file('indonesia.json')
        indo.plot(ax=ax_map, color='#cccccc', edgecolor='none', zorder=2, linewidth=0.5)
    except: pass
    
    map_title_upper = map_config['title'].upper()
    is_hth = "HARI TANPA HUJAN" in map_title_upper

    if is_hth and df_points is not None:
        if boundary_file is not None: 
            boundary_file.plot(ax=ax_map, color='#ffffd9', edgecolor='none', zorder=3)
        
        for _, row in df_points.iterrows():
            val = row.get('VAL', 0)
            warna = get_hth_color(val, levels, colors) 
            ax_map.scatter(row['LON'], row['LAT'], color=warna, edgecolor='black', s=55, zorder=6, linewidth=1)
    else:
        if grid_x is not None:
            ax_map.contourf(grid_x, grid_y, grid_z, levels=levels, cmap=ListedColormap(colors), norm=BoundaryNorm(levels, len(colors)), antialiased=True, zorder=3)
    
    if boundary_file is not None: 
        boundary_file.boundary.plot(ax=ax_map, color='black', linewidth=1.0, linestyle=':', zorder=4)
        
    try:
        indo.boundary.plot(ax=ax_map, color='red', linewidth=1, linestyle='--', zorder=5)
    except: pass
    if kaltim_area is not None: 
        gpd.GeoSeries([kaltim_area]).boundary.plot(ax=ax_map, color='red', linewidth=1, linestyle='--', zorder=5)

    try:
        if 'malaysia' in locals():
            malaysia_fix = malaysia.copy()
            malaysia_fix.geometry = malaysia_fix.geometry.buffer(0)
            gpd.GeoSeries([malaysia_fix.unary_union]).boundary.plot(ax=ax_map, color='black', linewidth=1, linestyle='-', zorder=6)
    except: pass

    try:
        if 'indo' in locals():
            indo_fix = indo.copy()
            indo_fix.geometry = indo_fix.geometry.buffer(0)
            gpd.GeoSeries([indo_fix.unary_union]).boundary.plot(ax=ax_map, color='black', linewidth=1, linestyle='-', zorder=6)
    except: pass
    
    for reg in REGION_DATA: ax_map.text(reg['lon'], reg['lat'], reg['nama'].replace("Kota ", ""), fontsize=6.5, color='black', ha='center', va='center', zorder=7)
    
    ax_map.text(116.5, 2.6, "KALTARA", fontsize=10, fontweight='bold', ha='center', va='center', color='black', zorder=7)
    ax_map.text(114.5, -1.2, "KALTENG", fontsize=10, fontweight='bold', ha='center', va='center', color='black', zorder=7)
    ax_map.text(115.8, -2.5, "KALSEL", fontsize=10, fontweight='bold', ha='center', va='center', color='black', zorder=7)
    
    ax_map.set_xlim(113.8, 119.5)
    ax_map.set_ylim(-2.8, 2.8)
    ax_map.xaxis.set_major_formatter(FuncFormatter(format_lon))
    ax_map.yaxis.set_major_formatter(FuncFormatter(format_lat))
    ax_map.set_xticks([114, 116, 118])
    ax_map.set_yticks([-2, 0, 2])
    
    ax_map.tick_params(labelsize=8, direction='in', length=6, pad=5, top=True, bottom=True, left=True, right=True, labeltop=True, labelbottom=True, labelleft=True, labelright=True)
    ax_map.tick_params(axis='y', labelrotation=90)
    
    for x in [114, 116, 118]:
        for y in [-2, 0, 2]:
            ax_map.plot(x, y, marker='+', color='black', markersize=8, lw=1, zorder=7)

    ax_info = fig.add_subplot(gs[1])
    ax_info.axis('off')
    ax_info.add_patch(patches.Rectangle((0, 0.72), 1, 0.28, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    
    plt.text(0.5, 0.97, map_title_upper, ha='center', va='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    plt.text(0.5, 0.945, period.upper(), ha='center', va='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    plt.text(0.5, 0.920, "PROVINSI KALIMANTAN TIMUR", ha='center', va='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    plt.text(0.5, 0.900, f"Update : {update_time}", ha='center', va='center', transform=ax_info.transAxes, color='blue', fontweight='bold', fontsize=7)
    
    try: 
        img_logo = plt.imread('logo_bmkg.png')
        ax_info.add_artist(AnnotationBbox(OffsetImage(img_logo, zoom=0.15), (0.5, 0.83), frameon=False, xycoords='axes fraction'))
    except: pass
    
    bmkg_text = "BADAN METEOROLOGI KLIMATOLOGI DAN GEOFISIKA\nSTASIUN METEOROLOGI KELAS II\nAJI PANGERAN TUMENGGUNG PRANOTO\nSAMARINDA - KALIMANTAN TIMUR"
    plt.text(0.5, 0.73, bmkg_text, ha='center', va='bottom', transform=ax_info.transAxes, fontsize=5.5, fontweight='bold', linespacing=1.2)

    ax_info.add_patch(patches.Rectangle((0, 0.58), 1, 0.13, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    plt.text(0.5, 0.675, "KETERANGAN :", ha='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    
    ax_info.plot([0.05, 0.15], [0.63, 0.63], color='red', ls='--', lw=1.5, transform=ax_info.transAxes)
    plt.text(0.18, 0.63, "Batas Provinsi", va='center', transform=ax_info.transAxes, fontsize=8)
    
    ax_info.add_patch(patches.Rectangle((0.05, 0.595), 0.1, 0.025, facecolor='#808080', ec='black', lw=1, transform=ax_info.transAxes))
    plt.text(0.18, 0.605, "Luar Negeri", va='center', transform=ax_info.transAxes, fontsize=8)

    ax_info.add_patch(patches.Rectangle((0.55, 0.62), 0.1, 0.025, facecolor='#cccccc', ec='black', lw=1, transform=ax_info.transAxes))
    plt.text(0.68, 0.63, "Provinsi Lain", va='center', transform=ax_info.transAxes, fontsize=8)
    
    ax_info.plot([0.55, 0.65], [0.605, 0.605], color='black', ls=':', lw=1.5, transform=ax_info.transAxes)
    plt.text(0.68, 0.605, "Batas Kab/Kota", va='center', transform=ax_info.transAxes, fontsize=8)

    box_3_top = 0.57
    box_3_bottom = 0.20 
    ax_info.add_patch(patches.Rectangle((0, box_3_bottom), 1, box_3_top - box_3_bottom, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    
    judul_legenda = "SIFAT HUJAN (%) :" if "%" in unit else f"{map_title_upper.split(' ')[-1]} ({unit}) :"
    if "HARI HUJAN" in map_title_upper: judul_legenda = "HARI HUJAN (hari) :"
    if "HARIAN" in map_title_upper: judul_legenda = f"CURAH HUJAN ({unit}) :"
    if "HARI TANPA HUJAN" in map_title_upper: judul_legenda = f"HARI TANPA HUJAN ({unit}) :"
    
    plt.text(0.5, box_3_top - 0.03, judul_legenda, ha='center', transform=ax_info.transAxes, fontweight='bold', fontsize=9)
    ax_info.plot([0, 1], [box_3_top - 0.05, box_3_top - 0.05], color='black', lw=2, transform=ax_info.transAxes)
    
    num_items = len(colors)
    available_height = (box_3_top - 0.05) - box_3_bottom
    row_h = available_height / num_items
    y_cursor = box_3_top - 0.05
    
    groups = []
    current_label = labels[0] if labels else ""
    start_idx = 0
    for i in range(1, num_items):
        lbl = labels[i] if i < len(labels) else ""
        if lbl != current_label:
            groups.append((start_idx, i-1, current_label))
            current_label = lbl
            start_idx = i
    groups.append((start_idx, num_items-1, current_label))

    for i, color in enumerate(colors):
        y_top = y_cursor
        y_bot = y_cursor - row_h
        
        ax_info.add_patch(patches.Rectangle((0.05, y_bot + (row_h*0.1)), 0.15, row_h*0.8, facecolor=color, ec='black', lw=1, transform=ax_info.transAxes))
        
        if "custom_ranges" in map_config and i < len(map_config["custom_ranges"]):
            text_range = map_config["custom_ranges"][i]
        else:
            text_range = f"{levels[i]} - {levels[i+1]}" if levels[i+1] < 1000 else f"> {levels[i]}"
        
        plt.text(0.25, (y_top + y_bot)/2, text_range, va='center', transform=ax_info.transAxes, fontsize=9)
        
        if labels:
            if i < num_items - 1:
                ax_info.plot([0, 0.5], [y_bot, y_bot], color='black', lw=1, transform=ax_info.transAxes)
        else:
            if i < num_items - 1:
                ax_info.plot([0, 1], [y_bot, y_bot], color='black', lw=1, transform=ax_info.transAxes)
        
        y_cursor = y_bot
        
    if labels:
        ax_info.plot([0.5, 0.5], [box_3_top - 0.05, box_3_bottom], color='black', lw=2, transform=ax_info.transAxes)
        for (start_idx, end_idx, label) in groups:
            y_start = (box_3_top - 0.05) - (start_idx * row_h)
            y_end = (box_3_top - 0.05) - ((end_idx + 1) * row_h)
            y_center = (y_start + y_end) / 2
            
            plt.text(0.75, y_center, label, ha='center', va='center', transform=ax_info.transAxes, fontsize=9)
            
            if y_end > box_3_bottom + 0.001:
                ax_info.plot([0.5, 1], [y_end, y_end], color='black', lw=1, transform=ax_info.transAxes)

    ax_info.add_patch(patches.Rectangle((0, 0.0), 1, 0.19, transform=ax_info.transAxes, facecolor='white', ec='black', lw=2))
    
    try: 
        img_compass = plt.imread('mata_angin.png')
        ax_info.add_artist(AnnotationBbox(OffsetImage(img_compass, zoom=0.07), (0.5, 0.145), frameon=False, xycoords='axes fraction'))
    except: pass
    
    scale_y = 0.075
    ax_info.plot([0.1, 0.9], [scale_y, scale_y], color='black', lw=4, transform=ax_info.transAxes)
    for px in [0.1, 0.3, 0.5, 0.7, 0.9]:
        ax_info.plot([px, px], [scale_y-0.01, scale_y+0.01], color='white', lw=1.5, transform=ax_info.transAxes)
    
    plt.text(0.1, scale_y+0.015, "0", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.3, scale_y+0.015, "30", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.5, scale_y+0.015, "60", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.7, scale_y+0.015, "120", ha='center', transform=ax_info.transAxes, fontsize=6)
    plt.text(0.9, scale_y+0.015, "240\nKM", ha='center', transform=ax_info.transAxes, fontsize=6)
    ax_info.plot([0, 1], [0.04, 0.04], color='black', lw=1.5, transform=ax_info.transAxes)
    
    if "PREDIKSI" in map_title_upper or "PRAKIRAAN" in map_title_upper:
        sumber_1 = "1. Bidang Analisis Variabilitas Iklim BMKG"
    else:
        sumber_1 = "1. Stasiun Meteorologi APT Pranoto Samarinda"
        
    sumber_text = f"Sumber Data :\n{sumber_1}\n2. Peta Rupa Bumi Indonesia : BIG"
    plt.text(0.5, 0.02, sumber_text, ha='center', va='center', transform=ax_info.transAxes, fontsize=5.5)

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=300, bbox_inches='tight', pad_inches=0.15, facecolor='white') 
    plt.close(fig)
    buf.seek(0)
    return buf

def save_to_tiff(grid_x, grid_y, grid_z, filepath):
    """Fungsi untuk mencetak hasil IDW menjadi file GeoTIFF (.tif)"""
    lon_min, lon_max = grid_x.min(), grid_x.max()
    lat_min, lat_max = grid_y.min(), grid_y.max()
    
    z_raster = np.flipud(grid_z.T)
    z_raster = np.nan_to_num(z_raster, nan=-9999.0).astype(np.float32)
    
    transform = from_bounds(lon_min, lat_min, lon_max, lat_max, z_raster.shape[1], z_raster.shape[0])
    
    # Gunakan string Proj4 WGS84 mentah untuk menghindari EPSG database lookup
    wgs84_proj4 = "+proj=longlat +datum=WGS84 +no_defs"
    
    with rasterio.open(
        filepath, 'w', driver='GTiff',
        height=z_raster.shape[0], width=z_raster.shape[1],
        count=1, dtype=z_raster.dtype, crs=wgs84_proj4,
        transform=transform, nodata=-9999.0
    ) as dst:
        dst.write(z_raster, 1)