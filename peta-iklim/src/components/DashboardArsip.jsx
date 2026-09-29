import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, Eye, Download, Trash2, ArrowLeft, CloudRain, 
  Wind, RefreshCw, FileJson, FileSpreadsheet, AlertTriangle, Bot, Edit3,
  CheckCircle2, AlertCircle, X, Check, Copy, ChevronDown, Map, Calendar, Clock, Layers, Filter
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

const CATEGORY_MAP = {
  prakiraan_hujan_dasarian: { label: "Prakiraan Hujan Dasarian", icon: <CloudRain size={14}/> },
  prakiraan_hujan_bulanan: { label: "Prakiraan Hujan Bulanan", icon: <CloudRain size={14}/> },
  prakiraan_sifat_dasarian: { label: "Prakiraan Sifat Dasarian", icon: <Wind size={14}/> },
  prakiraan_sifat_bulanan: { label: "Prakiraan Sifat Bulanan", icon: <Wind size={14}/> },
  analisis_hujan_dasarian: { label: "Analisis Hujan Dasarian", icon: <CloudRain size={14}/> },
  analisis_hujan_bulanan: { label: "Analisis Hujan Bulanan", icon: <CloudRain size={14}/> },
  analisis_sifat_bulanan: { label: "Analisis Sifat Bulanan", icon: <Wind size={14}/> },
  analisis_hari_hujan_bulanan: { label: "Analisis Hari Hujan", icon: <Calendar size={14}/> },
  hari_tanpa_hujan: { label: "Hari Tanpa Hujan", icon: <Map size={14}/> }
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const YEARS = Array.from({length: 10}, (_, i) => new Date().getFullYear() - 2 + i);

export default function DashboardArsip() {
  const [archiveData, setArchiveData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [filterYear, setFilterYear] = useState("ALL");
  
  // State Pagination
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
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
      const token = localStorage.getItem('bmkg_token') || "";
      const config = { headers: { "x-api-key": token } };

      const response = await axios.get(`${API_URL}/archives?skip=${currentSkip}&limit=${limit}`, config);
      
      if (response.data.status === "success") {
        if (reset) {
          setArchiveData(response.data.data);
        } else {
          setArchiveData(prev => [...prev, ...response.data.data]);
        }
        setSkip(currentSkip + limit);
        setHasMore(response.data.pagination.has_more);
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
      const token = localStorage.getItem('bmkg_token') || "";
      const config = { headers: { "x-api-key": token } };

      const response = await axios.delete(`${API_URL}/archives/${deleteTarget.id}`, config);
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
      const token = localStorage.getItem('bmkg_token') || "";
      const config = { headers: { "x-api-key": token } };

      await axios.put(`${API_URL}/archives/${previewData.id}/analysis`, {
        analysis_text: editAnalysisText
      }, config);
      
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

  // LOGIKA FILTERING
  const filteredData = archiveData.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.period.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = filterCategory === "ALL" || item.category === filterCategory;
    const matchesMonth = filterMonth === "ALL" || item.period.toLowerCase().includes(filterMonth.toLowerCase());
    const matchesYear = filterYear === "ALL" || item.period.includes(filterYear.toString());
    
    return matchesSearch && matchesCat && matchesMonth && matchesYear;
  });

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="min-h-screen bg-[#F8FAFC] text-slate-700 flex flex-col relative">
      
      {/* HEADER NAVIGASI */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <Link className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors" to="/">
          <ArrowLeft size={16}/> Kembali ke Beranda
        </Link>
        <button onClick={() => fetchArchives(true)} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors bg-white px-4 py-2 rounded border border-slate-200 hover:bg-slate-50">
          <RefreshCw size={14} className={isLoading && skip === 0 ? "animate-spin text-blue-600" : ""} /> Segarkan
        </button>
      </div>

      <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        
        {/* PANEL PENCARIAN & FILTER WAKTU (Lebih Simpel) */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Bar */}
          <div className="flex-1 flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all shadow-sm">
            <Search className="text-slate-400" size={16}/>
            <input 
              type="text" 
              placeholder="Cari berdasarkan judul peta atau periode..." 
              className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>

          {/* Filter Waktu */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto">
              <Filter size={14}/>
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer w-full md:w-32"
              >
                <option value="ALL">Semua Bulan</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm w-full md:w-auto">
              <Calendar size={14}/>
              <select 
                value={filterYear} 
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer w-full md:w-24"
              >
                <option value="ALL">Semua Tahun</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* KATEGORI PILLS (Lebih Ringkas) */}
        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <button 
            onClick={() => setFilterCategory("ALL")}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all border ${filterCategory === "ALL" ? 'bg-slate-700 text-white border-slate-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <Layers size={14}/> Semua Peta
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, data]) => (
            <button 
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all border ${filterCategory === key ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {data.icon} {data.label}
            </button>
          ))}
        </div>

        {/* LIST VIEW (CARD SIMPEL) */}
        <div className="space-y-3">
          {isLoading && skip === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-500 flex flex-col items-center gap-3 shadow-sm">
              <RefreshCw className="animate-spin text-blue-500" size={24}/>
              <p className="text-sm font-medium">Memuat data arsip...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400 flex flex-col items-center gap-3 shadow-sm">
              <Search className="text-slate-300" size={32}/>
              <p className="text-sm font-medium">Tidak ada data arsip yang ditemukan.</p>
            </div>
          ) : (
            filteredData.map(item => {
              const catData = CATEGORY_MAP[item.category] || { label: item.category, icon: <Map size={14}/> };
              return (
                <div key={item.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Info Peta */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1 uppercase tracking-wider">
                        {catData.label}
                      </span>
                      {item.analysis_text && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                          <Bot size={12}/> Teks AI
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-base font-bold text-slate-800 mb-1">{item.title}</h3>
                    
                    <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                      <span className="flex items-center gap-1"><Calendar size={12}/> {item.period}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock size={12}/> Update: {item.update_time}</span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 pt-3 lg:pt-0 border-t border-slate-100 lg:border-t-0">
                    
                    {/* File Downloads */}
                    <div className="flex items-center gap-1.5 pr-0 sm:pr-3 sm:border-r border-slate-200 w-full sm:w-auto">
                      <button onClick={() => handleDownloadFile('png', item.filename_base)} className="flex-1 sm:flex-none px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors">
                        PNG
                      </button>
                      <button onClick={() => handleDownloadFile('geojson', item.filename_base)} className="flex-1 sm:flex-none px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors">
                        JSON
                      </button>
                      <button onClick={() => handleDownloadFile('csv', item.filename_base)} className="flex-1 sm:flex-none px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors">
                        CSV
                      </button>
                      {item.category !== "hari_tanpa_hujan" && (
                        <button onClick={() => handleDownloadFile('tif', item.filename_base)} className="flex-1 sm:flex-none px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:text-blue-600 transition-colors">
                          TIF
                        </button>
                      )}
                    </div>

                    {/* Detail & Hapus */}
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
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                      >
                        <Eye size={14}/> Detail
                      </button>
                      <button 
                        onClick={() => setDeleteTarget({ id: item.id, title: item.title })} 
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-white border border-red-100 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={14}/> Hapus
                      </button>
                    </div>
                  </div>

                </div>
              )
            })
          )}
        </div>
        
        {/* TOMBOL LOAD MORE */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <button 
              onClick={() => fetchArchives(false)} 
              disabled={isLoading}
              className="text-sm font-semibold bg-white text-slate-600 border border-slate-200 px-6 py-2 rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={14}/> : <ChevronDown size={14}/>}
              {isLoading ? 'Memuat...' : 'Tampilkan Lebih Banyak'}
            </button>
          </div>
        )}
      </div>

      {/* ================= MODAL PREVIEW & EDIT ================= */}
      {previewData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 transition-all">
          <div className="bg-white p-5 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col md:flex-row gap-5 overflow-hidden shadow-2xl">
            
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-slate-800 text-lg truncate pr-4">{previewData.title}</h3>
                <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1 rounded-full md:hidden"><X size={18}/></button>
              </div>
              <div className="flex-1 bg-slate-100/50 rounded-lg overflow-auto flex items-center justify-center p-3 border border-slate-200">
                <img src={previewData.url} alt="Preview Arsip" className="max-h-[75vh] object-contain border border-slate-200 bg-white rounded shadow-sm" />
              </div>
            </div>

            <div className="w-full md:w-[320px] lg:w-[380px] flex flex-col max-h-[40vh] md:max-h-none border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-5 relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <Bot className="text-blue-500" size={16}/> Analisis Cuaca
                </h3>
                
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="text-xs flex items-center gap-1 bg-white border border-slate-300 text-slate-600 px-2 py-1 rounded hover:bg-slate-50 font-medium transition-colors"
                    >
                      <Edit3 size={12}/> Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsEditing(false); setEditAnalysisText(previewData.analysis); }} 
                        className="text-xs font-medium text-slate-500 border border-slate-300 hover:bg-slate-50 px-2 py-1 rounded transition-colors"
                      >
                        Batal
                      </button>
                      <button 
                        onClick={handleSaveEdit} 
                        disabled={isSavingEdit} 
                        className="text-xs font-medium bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  )}
                  <button onClick={() => setPreviewData(null)} className="hidden md:flex text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-full"><X size={18}/></button>
                </div>
              </div>
              
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar">
                {isEditing ? (
                  <textarea 
                    className="w-full h-full min-h-[200px] bg-white border border-slate-300 rounded p-3 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none font-medium"
                    value={editAnalysisText}
                    onChange={(e) => setEditAnalysisText(e.target.value)}
                    placeholder="Ketik narasi analisis di sini..."
                  />
                ) : (
                  previewData.analysis ? (
                    <div className="text-justify font-normal">{previewData.analysis}</div>
                  ) : (
                    <div className="text-center text-slate-400 mt-10 flex flex-col items-center">
                      <FileJson className="text-slate-300 mb-2" size={24}/>
                      <p className="text-xs font-medium">Tidak ada catatan analisis AI.</p>
                    </div>
                  )
                )}
              </div>
              
              {!isEditing && (
                <button 
                  onClick={handleCopyText} 
                  disabled={!previewData.analysis} 
                  className="mt-3 w-full py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCopied ? <Check className="text-green-600" size={16}/> : <Copy className="text-slate-400" size={16}/>}
                  {isCopied ? 'Tersalin!' : 'Copy Analisis'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS ================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col w-full max-w-sm border border-slate-200 text-center">
            <AlertTriangle className="text-red-500 mx-auto mb-3" size={32}/>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Hapus Arsip?</h3>
            <p className="text-sm font-medium text-slate-500 mb-6">
              Data <strong className="text-slate-800">{deleteTarget.title}</strong> akan dihapus permanen.
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded font-semibold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
                Batal
              </button>
              <button onClick={executeDelete} className="flex-1 py-2 rounded font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[10000] px-4 py-3 rounded-lg shadow-lg font-medium text-sm flex items-center gap-3 border ${toast.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-800 text-white border-slate-700'}`}>
          {toast.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle2 className="text-green-400" size={16}/>}
          {toast.message}
        </div>
      )}
    </div>
  );
}