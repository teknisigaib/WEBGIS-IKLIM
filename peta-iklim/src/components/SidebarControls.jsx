import React, { useState } from 'react';
import { UploadCloud, Settings, Printer, FileText, User, Calendar, Clock, Sliders, Zap, Database, ChevronRight } from 'lucide-react';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const YEARS = Array.from({length: 10}, (_, i) => new Date().getFullYear() - 2 + i);

export default function SidebarControls({ onGenerate, onExport, isLoading, hasPreview }) {
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [selectedCol, setSelectedCol] = useState({ lon: '', lat: '', val: '' });

  const [category, setCategory] = useState("prakiraan_hujan_dasarian");
  const [creator, setCreator] = useState("TIM FORECASTER");

  const [selDasarian, setSelDasarian] = useState("I");
  const [selMonth, setSelMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const [updateDate, setUpdateDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [sigma, setSigma] = useState(2.0);
  const [power, setPower] = useState(2.0);

  const handleFileUpload = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const firstLine = text.split('\n')[0]; 
        const headers = firstLine.split(/[,;]/).map(h => h.trim().replace(/['"]/g, ''));
        setCsvHeaders(headers);
        setSelectedCol({ lon: '', lat: '', val: '' });
      };
      reader.readAsText(selectedFile);
    } else {
      setCsvHeaders([]);
      setSelectedCol({ lon: '', lat: '', val: '' });
    }
  };

  const formatIndoDate = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const buildFormData = () => {
    const isDasarian = category.includes('dasarian');
    const finalPeriod = isDasarian ? `Dasarian ${selDasarian} ${selMonth} ${selYear}` : `Bulan ${selMonth} ${selYear}`;
    const finalUpdateTime = formatIndoDate(updateDate);

    return { file, category, period: finalPeriod, update_time: finalUpdateTime, creator, sigma, power, col_lon: selectedCol.lon, col_lat: selectedCol.lat, col_val: selectedCol.val };
  };

  const onGenerateClick = () => {
    if (!file) return alert("Pilih file CSV terlebih dahulu!");
    if (!selectedCol.lon || !selectedCol.lat || !selectedCol.val) return alert("PENTING: Harap petakan kolom Bujur (X), Lintang (Y), dan Nilai Curah Hujan (Z) terlebih dahulu!");
    if (!updateDate) return alert("Tanggal Update wajib diisi!");
    onGenerate(buildFormData());
  };

  const onExportClick = () => {
    if (!hasPreview) return alert("Generate peta terlebih dahulu!");
    onExport(buildFormData());
  };

  const isDasarianMode = category.includes('dasarian');

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="w-[400px] h-full bg-white flex flex-col shadow-[8px_0_30px_rgba(0,0,0,0.03)] z-10 relative">
      
      {/* HEADER SIDEBAR (DIUPDATE SESUAI GAMBAR) */}
      <div className="p-6 bg-white border-b border-slate-100 flex flex-col z-20 shadow-sm">
        <div className="flex items-center gap-3 mb-1">
          <img src="/logo_bmkg.png" alt="BMKG" className="h-8 w-8 object-contain drop-shadow-sm" onError={(e) => e.target.style.display='none'} />
          
          {/* Garis vertikal pemisah */}
          <div className="w-[2px] h-6 bg-slate-300 rounded-full"></div>
          
          <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none">
            WebGIS
          </h1>
        </div>
        <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-1">Workspace Editor</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 styled-scrollbar bg-slate-50/50">
        
        {/* 1. SUMBER DATA */}
        <section>
          <div className="flex items-center gap-2 text-slate-800 font-bold mb-4">
            <Database size={18} className="text-blue-600" /> <h3 className="text-sm">Sumber Data</h3>
          </div>
          
          <div className="relative group">
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${file ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-400 hover:shadow-md'}`}>
              <UploadCloud size={32} className={`mb-3 transition-colors ${file ? 'text-emerald-500' : 'text-slate-300 group-hover:text-blue-500'}`} />
              <span className={`text-xs font-bold text-center px-4 truncate w-full ${file ? 'text-emerald-700' : 'text-slate-500'}`}>
                {file ? file.name : "Klik / Drag file CSV kesini"}
              </span>
            </label>
          </div>

          {/* DYNAMIC COLUMN MAPPING */}
          {csvHeaders.length > 0 && (
            <div className="mt-4 p-5 bg-indigo-50/70 border border-indigo-100 rounded-2xl animate-fade-in-up">
              <h4 className="text-xs font-bold text-indigo-900 mb-1 flex items-center gap-1">
                <Settings size={14}/> Pemetaan Kolom Manual
              </h4>
              <p className="text-[10px] text-indigo-600/80 font-medium leading-relaxed mb-4">
                Pilih kolom CSV yang mewakili koordinat dan nilai spasial:
              </p>

              <div className="space-y-3">
                {['lon', 'lat', 'val'].map((type, idx) => (
                  <div key={idx}>
                    <label className="text-[10px] font-bold text-slate-600 mb-1.5 block uppercase tracking-wider">
                      Kolom {type === 'lon' ? 'Bujur (X)' : type === 'lat' ? 'Lintang (Y)' : 'Nilai (Z)'} <span className="text-red-500">*</span>
                    </label>
                    <select 
                      className="w-full text-xs p-2.5 border border-indigo-200/50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 bg-white font-semibold text-slate-700 transition-all shadow-sm cursor-pointer" 
                      value={selectedCol[type]} 
                      onChange={e => setSelectedCol({...selectedCol, [type]: e.target.value})}
                    >
                      <option value="" disabled>-- Pilih Kolom --</option>
                      {csvHeaders.map((h, i) => <option key={`${type}-${i}`} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 2. INFORMASI PETA */}
        <section>
          <div className="flex items-center gap-2 text-slate-800 font-bold mb-4">
            <FileText size={18} className="text-blue-600" /> <h3 className="text-sm">Metadata Peta</h3>
          </div>
          
          <div className="space-y-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">Kategori Peta</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-400 transition-all font-semibold text-slate-700 cursor-pointer">
                <option value="prakiraan_hujan_dasarian">Prakiraan Curah Hujan Dasarian</option>
                <option value="prakiraan_hujan_bulanan">Prakiraan Curah Hujan Bulanan</option>
                <option value="prakiraan_sifat_dasarian">Prakiraan Sifat Hujan Dasarian</option>
                <option value="prakiraan_sifat_bulanan">Prakiraan Sifat Hujan Bulanan</option>
                <option value="analisis_hujan_dasarian">Analisis Curah Hujan Dasarian</option>
                <option value="analisis_hujan_bulanan">Analisis Curah Hujan Bulanan</option>
                <option value="analisis_sifat_bulanan">Analisis Sifat Hujan Bulanan</option>
                <option value="analisis_hari_hujan_bulanan">Analisis Hari Hujan Bulanan</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Calendar size={12}/> Periode Peta</label>
              <div className="flex gap-2">
                {isDasarianMode && (
                  <select value={selDasarian} onChange={e => setSelDasarian(e.target.value)} className="w-1/3 text-xs p-2.5 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-semibold text-slate-700 cursor-pointer">
                    <option value="I">Das I</option><option value="II">Das II</option><option value="III">Das III</option>
                  </select>
                )}
                <select value={selMonth} onChange={e => setSelMonth(e.target.value)} className={`${isDasarianMode ? 'w-1/3' : 'w-2/3'} text-xs p-2.5 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-semibold text-slate-700 cursor-pointer`}>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={selYear} onChange={e => setSelYear(e.target.value)} className="w-1/3 text-xs p-2.5 border border-slate-200 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 font-semibold text-slate-700 cursor-pointer">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><Clock size={12}/> Tgl Update</label>
                <input type="date" value={updateDate} onChange={(e) => setUpdateDate(e.target.value)} className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-400 transition-all font-semibold text-slate-700 cursor-pointer" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><User size={12}/> Pembuat</label>
                <input type="text" value={creator} onChange={(e) => setCreator(e.target.value)} className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-400 transition-all font-semibold text-slate-700" />
              </div>
            </div>
          </div>
        </section>

        {/* 3. ALGORITMA IDW */}
        <section>
          <div className="flex items-center gap-2 text-slate-800 font-bold mb-4">
            <Sliders size={18} className="text-blue-600" /> <h3 className="text-sm">Parameter Spasial (IDW)</h3>
          </div>
          
          <div className="space-y-5 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Power (P)</label><span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{power}</span></div>
              <input type="range" min="0.5" max="5.0" step="0.1" value={power} onChange={(e) => setPower(parseFloat(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2"><label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Smoothing (Sigma)</label><span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{sigma}</span></div>
              <input type="range" min="0" max="5.0" step="0.1" value={sigma} onChange={(e) => setSigma(parseFloat(e.target.value))} className="w-full accent-blue-600 cursor-pointer" />
            </div>
          </div>
        </section>

      </div>

      {/* 4. ACTION BUTTONS (STICKY BOTTOM) */}
      <div className="p-6 bg-white/90 backdrop-blur-md border-t border-slate-100 space-y-3 z-20">
        <button onClick={onGenerateClick} disabled={isLoading} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-70 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
          <Zap size={18} className={isLoading ? 'animate-pulse' : ''} /> {isLoading ? "Memproses AI & Spasial..." : "Render Peta Spasial"}
        </button>
        <button onClick={onExportClick} disabled={!hasPreview || isLoading} className="w-full py-3.5 bg-white border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:hover:bg-white text-slate-700 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
          <Printer size={18} className="text-slate-500" /> Export & Simpan Arsip
        </button>
      </div>
    </div>
  );
}