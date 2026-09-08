import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, Eye, Download, Trash2, ArrowLeft, Archive, CloudRain, 
  Wind, RefreshCw, FileJson, FileSpreadsheet, AlertTriangle, Bot, Edit3,
  CheckCircle2, AlertCircle, X, Check, Copy, ChevronDown, Map, Calendar, Clock, Layers
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

// Gembok rahasia
const API_KEY = "Administrator96607"; 
const axiosConfig = {
  headers: { "x-api-key": API_KEY }
};

const CATEGORY_MAP = {
  prakiraan_hujan_dasarian: { label: "Prakiraan Hujan Dasarian", icon: <CloudRain size={16}/> },
  prakiraan_hujan_bulanan: { label: "Prakiraan Hujan Bulanan", icon: <CloudRain size={16}/> },
  prakiraan_sifat_dasarian: { label: "Prakiraan Sifat Dasarian", icon: <Wind size={16}/> },
  prakiraan_sifat_bulanan: { label: "Prakiraan Sifat Bulanan", icon: <Wind size={16}/> },
  analisis_hujan_dasarian: { label: "Analisis Hujan Dasarian", icon: <CloudRain size={16}/> },
  analisis_hujan_bulanan: { label: "Analisis Hujan Bulanan", icon: <CloudRain size={16}/> },
  analisis_sifat_bulanan: { label: "Analisis Sifat Bulanan", icon: <Wind size={16}/> },
  analisis_hari_hujan_bulanan: { label: "Analisis Hari Hujan", icon: <Calendar size={16}/> },
  hari_tanpa_hujan: { label: "Hari Tanpa Hujan", icon: <Map size={16}/> }
};

export default function DashboardArsip() {
  const [archiveData, setArchiveData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  
  // State Pagination
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalData, setTotalData] = useState(0);
  const limit = 20;
  
  const [previewData, setPreviewData] = useState(null); 
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editAnalysisText, setEditAnalysisText] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchArchives = async (reset = false) => {
    setIsLoading(true);
    try {
      const currentSkip = reset ? 0 : skip;
      const response = await axios.get(`${API_URL}/archives?skip=${currentSkip}&limit=${limit}`);
      
      if (response.data.status === "success") {
        if (reset) {
          setArchiveData(response.data.data);
        } else {
          setArchiveData(prev => [...prev, ...response.data.data]);
        }
        setSkip(currentSkip + limit);
        setHasMore(response.data.pagination.has_more);
        setTotalData(response.data.pagination.total_data);
      }
    } catch (error) { 
      showToast("Gagal mengambil data arsip dari server.", "error");
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { 
    fetchArchives(true); 
  }, []);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await axios.delete(`${API_URL}/archives/${deleteTarget.id}`, axiosConfig);
      if (response.data.status === "success") {
        showToast(`Arsip "${deleteTarget.title}" berhasil dihapus.`, "success");
        setDeleteTarget(null); 
        fetchArchives(true); 
      }
    } catch (error) { 
      showToast("Akses ditolak atau server bermasalah.", "error"); 
    }
  };

  const handleSaveEdit = async () => {
    if (!previewData) return;
    setIsSavingEdit(true);
    try {
      await axios.put(`${API_URL}/archives/${previewData.id}/analysis`, {
        analysis_text: editAnalysisText
      }, axiosConfig);
      
      setPreviewData({...previewData, analysis: editAnalysisText});
      setIsEditing(false);
      setArchiveData(prev => prev.map(item => item.id === previewData.id ? {...item, analysis_text: editAnalysisText} : item));
      
      showToast("Teks analisis berhasil diperbarui!", "success");
    } catch (error) {
      showToast("Gagal menyimpan perubahan. Pastikan Anda punya akses.", "error");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopyText = () => {
    if(previewData?.analysis) { 
      navigator.clipboard.writeText(previewData.analysis); 
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      showToast("Teks analisis disalin ke clipboard!", "success"); 
    }
  };

  const handleDownloadFile = (type, filenameBase) => { 
    if (!filenameBase) {
        showToast("Error: File belum siap atau tidak ditemukan.", "error");
        return;
    }
    window.open(`${API_URL}/archives/download/${type}/${filenameBase}`, '_blank'); 
  };

  const filteredData = archiveData.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.period.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === "ALL" || item.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col selection:bg-blue-200 relative">
      
      {/* HEADER NAVIGASI */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-xl shadow-sm">
          <ArrowLeft size={16} /> Kembali
        </Link>
        <button onClick={() => fetchArchives(true)} title="Muat Ulang Data" className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 shadow-sm px-4 py-2 rounded-xl transition-all">
          <RefreshCw size={14} className={isLoading && skip === 0 ? "animate-spin text-blue-600" : ""} /> Refresh Data
        </button>
      </div>

      <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in-up">
        
        {/* STATISTIK DASHBOARD */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all relative overflow-hidden flex justify-between items-center cursor-default">
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Total Arsip Database</p>
              <h3 className="text-4xl font-black text-slate-800">{totalData || archiveData.length}</h3>
            </div>
            <div className="relative z-10 h-14 w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Archive size={26} strokeWidth={2} />
            </div>
          </div>
          <div className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all relative overflow-hidden flex justify-between items-center cursor-default">
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Data Peta Curah Hujan</p>
              <h3 className="text-4xl font-black text-slate-800">{archiveData.filter(i=>i.category.includes('hujan')).length}</h3>
            </div>
            <div className="relative z-10 h-14 w-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <CloudRain size={26} strokeWidth={2} />
            </div>
          </div>
          <div className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 transition-all relative overflow-hidden flex justify-between items-center cursor-default">
            <div className="relative z-10">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Data Peta Sifat & HTH</p>
              <h3 className="text-4xl font-black text-slate-800">{archiveData.filter(i=>!i.category.includes('hujan')).length}</h3>
            </div>
            <div className="relative z-10 h-14 w-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Wind size={26} strokeWidth={2} />
            </div>
          </div>
        </div>

        {/* AREA PENCARIAN & FILTER PILLS */}
        <div className="space-y-4">
          <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
            <Search className="ml-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Cari berdasarkan judul peta atau periode (contoh: Oktober 2026)..." 
              className="w-full px-3 py-3 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>

          {/* HORIZONTAL SCROLLABLE CATEGORY PILLS */}
          <div className="flex gap-2 overflow-x-auto pb-2 pt-1 custom-scrollbar">
            <button 
              onClick={() => setFilterCategory("ALL")}
              className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm border ${filterCategory === "ALL" ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}
            >
              <Layers size={14}/> Semua Peta
            </button>
            {Object.entries(CATEGORY_MAP).map(([key, data]) => (
              <button 
                key={key}
                onClick={() => setFilterCategory(key)}
                className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm border ${filterCategory === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`}
              >
                {data.icon} {data.label}
              </button>
            ))}
          </div>
        </div>

        {/* MODERN CARD LIST VIEW */}
        <div className="space-y-4">
          {isLoading && skip === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium animate-pulse flex flex-col items-center gap-3">
              <RefreshCw size={28} className="animate-spin text-blue-400" />
              Memuat database arsip...
            </div>
          ) : filteredData.length === 0 ? (
            <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 font-medium flex flex-col items-center gap-4">
              <div className="bg-slate-50 p-5 rounded-full border border-slate-100"><Search size={32} className="text-slate-300"/></div>
              <p>Tidak ada data arsip yang cocok dengan pencarian atau filter.</p>
            </div>
          ) : (
            filteredData.map(item => {
              const catData = CATEGORY_MAP[item.category] || { label: item.category, icon: <Map size={14}/> };
              return (
                <div key={item.id} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 group">
                  
                  {/* Info Peta (Kiri) */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="hidden sm:flex mt-1 w-12 h-12 bg-slate-50 text-slate-400 border border-slate-100 rounded-xl items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {catData.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                          {catData.icon} {catData.label}
                        </span>
                        {item.analysis_text && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Bot size={12}/> Teks AI Tersedia
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-slate-800 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{item.title}</h3>
                      <div className="flex items-center gap-4 text-xs font-medium text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400"/> {item.period}</span>
                        <span className="flex items-center gap-1.5"><Clock size={14} className="text-slate-400"/> Update: {item.update_time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi (Kanan) */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                    
                    {/* Grup Tombol Download */}
                    <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                      <button onClick={() => handleDownloadFile('png', item.filename_base)} className="text-[10px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                        <Download size={14}/> PNG
                      </button>
                      <button onClick={() => handleDownloadFile('geojson', item.filename_base)} className="text-[10px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                        <FileJson size={14}/> JSON
                      </button>
                      <button onClick={() => handleDownloadFile('csv', item.filename_base)} className="text-[10px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                        <FileSpreadsheet size={14}/> CSV
                      </button>
                      {item.category !== "hari_tanpa_hujan" && (
                        <button onClick={() => handleDownloadFile('tif', item.filename_base)} className="text-[10px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm">
                          <Download size={14}/> TIF
                        </button>
                      )}
                    </div>

                    <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>

                    {/* Grup Tombol Lihat & Hapus */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button 
                        onClick={() => {
                          setPreviewData({ 
                            id: item.id, url: `${API_URL}/archives/download/png/${item.filename_base}`, 
                            title: item.title, analysis: item.analysis_text 
                          });
                          setIsEditing(false); 
                          setEditAnalysisText(item.analysis_text || "");
                        }} 
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
                      >
                        <Eye size={16}/> <span className="sm:hidden">Lihat Detail</span>
                      </button>
                      <button 
                        onClick={() => setDeleteTarget({ id: item.id, title: item.title })} 
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-sm"
                      >
                        <Trash2 size={16}/> <span className="sm:hidden">Hapus</span>
                      </button>
                    </div>
                  </div>

                </div>
              )
            })
          )}
        </div>
        
        {/* TOMBOL LOAD MORE (PAGINATION) */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <button 
              onClick={() => fetchArchives(false)} 
              disabled={isLoading}
              className="text-sm font-bold bg-white text-slate-600 border border-slate-200 px-8 py-3 rounded-xl shadow-sm hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <ChevronDown size={16} />}
              {isLoading ? 'Memuat Data...' : 'Tampilkan Lebih Banyak'}
            </button>
          </div>
        )}
      </div>

      {/* ================= MODAL PREVIEW & EDIT ================= */}
      {previewData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white p-6 rounded-3xl w-full max-w-7xl max-h-[95vh] flex flex-col md:flex-row gap-6 overflow-hidden animate-fade-in-up shadow-2xl border border-slate-200">
            
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-slate-800 text-xl truncate pr-4">{previewData.title}</h3>
                <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-slate-700 p-1.5 bg-slate-100 rounded-full md:hidden transition-colors"><X size={20}/></button>
              </div>
              <div className="flex-1 bg-slate-100/50 rounded-2xl overflow-auto flex items-center justify-center p-4 border border-slate-200">
                <img src={previewData.url} alt="Preview Arsip" className="max-h-[75vh] object-contain shadow-sm border border-slate-200 rounded bg-white" />
              </div>
            </div>

            <div className="w-full md:w-[380px] lg:w-[450px] flex flex-col max-h-[40vh] md:max-h-none border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <Bot size={16} className="text-blue-600"/> Draf Analisis Cuaca
                </h3>
                
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="text-xs flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 hover:text-blue-600 font-bold transition-colors shadow-sm"
                    >
                      <Edit3 size={14}/> Edit Text
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsEditing(false); setEditAnalysisText(previewData.analysis); }} 
                        className="text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                      >
                        Batal
                      </button>
                      <button 
                        onClick={handleSaveEdit} 
                        disabled={isSavingEdit} 
                        className="text-xs font-bold flex items-center gap-1.5 bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 shadow-md transition-all disabled:opacity-50"
                      >
                        {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  )}
                  <button onClick={() => setPreviewData(null)} className="hidden md:flex text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded-full ml-1 transition-colors"><X size={20}/></button>
                </div>
              </div>
              
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm text-slate-700 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner custom-scrollbar relative">
                {isEditing ? (
                  <textarea 
                    className="w-full h-full min-h-[250px] bg-white border border-slate-300 rounded-xl p-4 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none shadow-sm transition-colors text-slate-700 leading-relaxed"
                    value={editAnalysisText}
                    onChange={(e) => setEditAnalysisText(e.target.value)}
                    placeholder="Ketik narasi analisis di sini..."
                  />
                ) : (
                  previewData.analysis ? (
                    <div className="text-justify font-medium">{previewData.analysis}</div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 space-y-3">
                      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm"><FileJson size={24} className="text-slate-300"/></div>
                      <p className="text-xs font-semibold">Tidak ada catatan analisis AI untuk arsip ini.</p>
                    </div>
                  )
                )}
              </div>
              
              {!isEditing && (
                <button 
                  onClick={handleCopyText} 
                  disabled={!previewData.analysis} 
                  className="mt-4 w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 text-slate-700 font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {isCopied ? <Check size={16} className="text-blue-600"/> : <Copy size={16} className="text-slate-400"/>}
                  {isCopied ? 'Teks Tersalin!' : 'Copy Teks Analisis'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS PERMANEN ================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col w-full max-w-sm border border-slate-200 animate-fade-in-up text-center">
            <div className="w-16 h-16 bg-white text-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-200 shadow-sm">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Hapus Arsip?</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
              Data <strong className="text-slate-800">{deleteTarget.title}</strong> akan dihapus permanen dari sistem.
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                Batal
              </button>
              <button onClick={executeDelete} className="flex-1 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-red-600 shadow-md transition-all active:scale-95">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[10000] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm animate-fade-in-up flex items-center gap-3 border backdrop-blur-md ${toast.type === 'error' ? 'bg-red-50/90 text-red-700 border-red-200' : 'bg-slate-900 text-white border-slate-800'}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} className="text-blue-400" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}