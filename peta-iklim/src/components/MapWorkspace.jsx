import React, { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl, CircleMarker, Tooltip, LayerGroup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Sliders } from 'lucide-react';
import L from 'leaflet'; 

export default function MapWorkspace({ mapData, isLoading }) {
  const centerKaltim = [0.5, 116.5];
  const defaultZoom = 6;

  const [polygonOpacity, setPolygonOpacity] = useState(0.85);
  const [batasKab, setBatasKab] = useState(null);

  useEffect(() => {
    fetch('/kaltim.json')
      .then(res => res.json())
      .then(data => setBatasKab(data))
      .catch(err => console.error("Gagal memuat batas kabupaten:", err));
  }, []);

  const batasKabStyle = { fillColor: 'transparent', color: '#1e293b', weight: 1.5, opacity: 0.6, dashArray: '6, 6', fillOpacity: 0 };

  const geoJsonStyle = (feature) => {
    const colorHex = feature.properties.fill || "#cccccc";
    return { fillColor: colorHex, fillOpacity: polygonOpacity, color: colorHex, weight: 0, opacity: 1.0 };
  };

  const pointToLayer = (feature, latlng) => {
    const colorHex = feature.properties.fill || "#cccccc";
    return L.circleMarker(latlng, {
      radius: 8, 
      fillColor: colorHex,
      color: '#1e293b', 
      weight: 1.5,
      fillOpacity: 1
    });
  };

  const onEachFeature = (feature, layer) => {
    if (feature.properties) {
      const mapTitle = mapData?.geojson?.metadata?.map_type || 'Area Peta';
      const rangeText = feature.properties.range_text;
      const categoryLabel = feature.properties.category;
      const unit = mapData?.legend_config?.unit || 'mm'; 
      const catHtml = categoryLabel ? `<br/><span class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1 inline-block">${categoryLabel.toUpperCase()}</span>` : "";

      layer.bindTooltip(
        `<div style="font-family: 'Poppins', sans-serif;" class="text-center">
          <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">${mapTitle}</span><br/>
          <strong class="text-base font-black text-slate-800">${rangeText} <span class="text-sm font-bold text-slate-500">${unit}</span></strong>
          ${catHtml}
        </div>`,
        { sticky: true, className: 'bg-white/95 backdrop-blur-md border-0 shadow-xl rounded-xl p-3' }
      );

      layer.on({
        mouseover: (e) => { 
          const l = e.target; 
          if(feature.geometry.type !== "Point") {
            l.setStyle({ weight: 1.5, color: '#1e293b' }); 
            l.bringToFront(); 
          }
        },
        mouseout: (e) => { 
          const l = e.target; 
          if(feature.geometry.type !== "Point") {
            l.setStyle({ weight: 0, color: feature.properties.fill }); 
          }
        }
      });
    }
  };

  const geoJsonKey = useMemo(() => mapData?.geojson?.metadata?.created_at || Date.now().toString(), [mapData]);
  const isHTHMap = mapData?.geojson?.metadata?.map_type?.includes("TANPA HUJAN");

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="h-full w-full relative z-0 bg-slate-50 overflow-hidden">
      
      {isLoading && (
        <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/20 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-white/50 animate-fade-in-up">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
              <Loader2 className="w-14 h-14 text-blue-600 animate-spin relative z-10" />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight">Merender Spasial</h3>
            <p className="text-xs text-slate-500 mt-2 font-medium text-center">Memproses data spasial...<br/>Mohon tunggu sebentar.</p>
          </div>
        </div>
      )}

      <MapContainer center={centerKaltim} zoom={defaultZoom} style={{ height: '100%', width: '100%' }} zoomControl={true}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Peta Jalan (OSM)"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /></LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Citra Satelit"><TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" /></LayersControl.BaseLayer>
          
          <LayersControl.Overlay checked name="Layer Peta Kaltim">
            {mapData && mapData.geojson && (
              <GeoJSON 
                key={geoJsonKey} 
                data={mapData.geojson} 
                style={geoJsonStyle} 
                onEachFeature={onEachFeature} 
                pointToLayer={pointToLayer} 
              />
            )}
          </LayersControl.Overlay>

          {batasKab && (
            <LayersControl.Overlay checked name="Batas Administrasi (Kab/Kota)">
              <GeoJSON data={batasKab} style={batasKabStyle} interactive={false} />
            </LayersControl.Overlay>
          )}

          {mapData && mapData.raw_data && !isHTHMap && (
            <LayersControl.Overlay checked name="Validasi Titik Observasi">
              <LayerGroup>
                {mapData.raw_data.map((pt, idx) => (
                  <CircleMarker 
                    key={idx} center={[pt.LAT, pt.LON]} radius={5} pane="markerPane"
                    pathOptions={{ color: '#ffffff', weight: 1.5, fillOpacity: 0.9, fillColor: '#0f172a' }}
                  >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1} className="bg-white/95 backdrop-blur-md border-0 shadow-xl rounded-xl p-0 overflow-hidden">
                      <div className="text-center min-w-[100px]">
                        <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200">
                          <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Data Observasi</span>
                        </div>
                        <div className="p-3">
                          <strong className="text-base font-black text-slate-800">
                            {pt.VAL} <span className="text-xs font-bold text-slate-500">{mapData?.legend_config?.unit || 'mm'}</span>
                          </strong>
                          <div className="text-[9px] text-slate-400 font-medium mt-1 bg-slate-50 rounded px-1 py-0.5 border border-slate-100 inline-block">
                            {pt.LAT.toFixed(3)}, {pt.LON.toFixed(3)}
                          </div>
                        </div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
          )}
        </LayersControl>
      </MapContainer>

      {mapData && mapData.legend_config && (
        <div className="absolute bottom-8 left-8 z-[1000] bg-white/85 backdrop-blur-xl p-5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 min-w-[260px] animate-fade-in-up">
          <div className="border-b border-slate-200/60 pb-3 mb-3">
            <h4 className="font-black text-slate-900 text-sm tracking-tight leading-tight mb-1">{mapData.geojson?.metadata?.map_type || mapData.legend_config.title.toUpperCase()}</h4>
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold text-slate-500">{mapData.geojson?.metadata?.period || '-'}</p>
              <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">Updated: {mapData.geojson?.metadata?.update_time || '-'}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {mapData.legend_config.colors.map((color, index) => {
              const levels = mapData.legend_config.levels;
              const labels = mapData.legend_config.labels || [];
              if (index === levels.length - 1) return null;
              
              let labelAngka = levels[index + 1] < 1000 ? `${levels[index]} - ${levels[index + 1]}` : `> ${levels[index]}`;
              
              // --- PENGGUNAAN CUSTOM RANGES DARI JSON ---
              if (mapData.legend_config.custom_ranges && mapData.legend_config.custom_ranges[index]) {
                labelAngka = mapData.legend_config.custom_ranges[index];
              }

              const unit = mapData.legend_config.unit || 'mm';
              const labelKategori = labels[index] ? labels[index] : "";
              
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md shadow-sm border border-black/10 shrink-0 transition-transform hover:scale-110" style={{ backgroundColor: color }}></div>
                  <div className="flex flex-col justify-center">
                    <span className="text-[11px] font-bold text-slate-700 leading-none">{labelAngka} <span className="text-slate-400 font-semibold">{unit}</span></span>
                    {labelKategori && <span className="text-[9px] font-semibold text-slate-400 leading-none mt-0.5">{labelKategori}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mapData && !isHTHMap && (
        <div className="absolute bottom-8 right-8 z-[1000] bg-white/85 backdrop-blur-xl p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/60 w-56 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
            <div className="bg-white p-1 rounded shadow-sm"><Sliders size={14} className="text-blue-600" /></div>
            <h4 className="font-bold text-slate-700 text-[11px] tracking-wide uppercase">Transparansi Poligon</h4>
          </div>
          <div className="px-1">
            <input 
              type="range" min="0.1" max="1.0" step="0.05" value={polygonOpacity} 
              onChange={(e) => setPolygonOpacity(parseFloat(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[9px] font-bold text-slate-400">Pudar</span>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 rounded">{Math.round(polygonOpacity * 100)}%</span>
              <span className="text-[9px] font-bold text-slate-400">Solid</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}