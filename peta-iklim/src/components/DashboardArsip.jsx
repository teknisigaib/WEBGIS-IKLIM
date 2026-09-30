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
  prediksi_hujan_dasarian: { label: "Prediksi Hujan Dasarian", icon: <CloudRain size={14}/> },
  prediksi_hujan_bulanan: { label: "Prediksi Hujan Bulanan", icon: <CloudRain size={14}/> },
  prediksi_sifat_dasarian: { label: "Prediksi Sifat Dasarian", icon: <Wind size={14}/> },
  prediksi_sifat_bulanan: { label: "Prediksi Sifat Bulanan", icon: <Wind size={14}/> },
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
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="min-h-screen bg-slate-50 text-slate-700 flex flex-col relative overflow-hidden">
      
      {/* Background Ornaments (Efek Cahaya Modern) */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-400/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* HEADER NAVIGASI (GLASSMORPHISM) */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-white/50 px-6 py-4 sticky top-0 z-40 flex items-center justify-between shadow-sm">
        <Link className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors bg-white/50 px-4 py-2 rounded-xl border border-white/60 hover:bg-white/80 shadow-sm" to="/">
          <ArrowLeft size={16}/> Kembali ke Beranda
        </Link>
        <button onClick={() => fetchArchives(true)} className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors bg-white/50 px-4 py-2 rounded-xl border border-white/60 hover:bg-white/80 shadow-sm">
          <RefreshCw size={14} className={isLoading && skip === 0 ? "animate-spin text-blue-600" : ""} /> Segarkan
        </button>
      </div>

      <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 relative z-10">
        
        {/* PANEL PENCARIAN & FILTER WAKTU */}
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1 flex items-center gap-3 bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/60 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <Search className="text-slate-400" size={18}/>
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
            <div className="flex items-center gap-2 text-slate-500 bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full md:w-auto focus-within:border-blue-400 transition-all">
              <Filter size={16}/>
              <select 
                value={filterMonth} 
                onChange={(e) => setFilterMonth(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer w-full md:w-32 appearance-none"
              >
                <option value="ALL">Semua Bulan</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-2 text-slate-500 bg-white/80 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full md:w-auto focus-within:border-blue-400 transition-all">
              <Calendar size={16}/>
              <select 
                value={filterYear} 
                onChange={(e) => setFilterYear(e.target.value)}
                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer w-full md:w-24 appearance-none"
              >
                <option value="ALL">Semua Tahun</option>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* KATEGORI PILLS */}
        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
          <button 
            onClick={() => setFilterCategory("ALL")}
            className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all border shadow-sm backdrop-blur-md ${filterCategory === "ALL" ? 'bg-slate-800/90 text-white border-slate-700' : 'bg-white/70 text-slate-600 border-white/60 hover:bg-white/90'}`}
          >
            <Layers size={14}/> Semua Peta
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, data]) => (
            <button 
              key={key}
              onClick={() => setFilterCategory(key)}
              className={`shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all border shadow-sm backdrop-blur-md ${filterCategory === key ? 'bg-blue-600/90 text-white border-blue-500' : 'bg-white/70 text-slate-600 border-white/60 hover:bg-white/90'}`}
            >
              {data.icon} {data.label}
            </button>
          ))}
        </div>

        {/* LIST VIEW (MODERN GLASS CARDS) */}
        <div className="space-y-4">
          {isLoading && skip === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl p-16 rounded-[2rem] border border-white/60 text-center text-slate-500 flex flex-col items-center gap-4 shadow-sm">
              <RefreshCw className="animate-spin text-blue-500" size={32}/>
              <p className="text-sm font-medium">Memuat data arsip...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-xl p-16 rounded-[2rem] border border-white/60 text-center text-slate-400 flex flex-col items-center gap-4 shadow-sm">
              <Search className="text-slate-300" size={40}/>
              <p className="text-sm font-medium">Tidak ada data arsip yang ditemukan.</p>
            </div>
          ) : (
            filteredData.map(item => {
              const catData = CATEGORY_MAP[item.category] || { label: item.category, icon: <Map size={14}/> };
              return (
                <div key={item.id} className="bg-white/70 backdrop-blur-xl p-5 rounded-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_10px_40px_rgba(37,99,235,0.08)] hover:-translate-y-0.5 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-5 group">
                  
                  {/* Info Peta */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-md border border-blue-100/50 flex items-center gap-1 uppercase tracking-wider backdrop-blur-sm">
                        {catData.label}
                      </span>
                      {item.analysis_text && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded-md border border-amber-200/50 flex items-center gap-1 backdrop-blur-sm">
                          <Bot size={12}/> Teks AI
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-800 mb-1.5 group-hover:text-blue-700 transition-colors">{item.title}</h3>
                    
                    <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                      <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-md border border-slate-100"><Calendar size={13}/> {item.period}</span>
                      <span className="flex items-center gap-1.5"><Clock size={13}/> {item.update_time}</span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 pt-3 lg:pt-0 border-t border-slate-200/50 lg:border-t-0">
                    
                    {/* File Downloads */}
                    <div className="flex items-center gap-1.5 pr-0 sm:pr-4 sm:border-r border-slate-200/60 w-full sm:w-auto">
                      <button onClick={() => handleDownloadFile('png', item.filename_base)} className="flex-1 sm:flex-none px-3 py-2 text-[11px] font-semibold text-slate-600 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm">
                        PNG
                      </button>
                      <button onClick={() => handleDownloadFile('geojson', item.filename_base)} className="flex-1 sm:flex-none px-3 py-2 text-[11px] font-semibold text-slate-600 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm">
                        JSON
                      </button>
                      <button onClick={() => handleDownloadFile('csv', item.filename_base)} className="flex-1 sm:flex-none px-3 py-2 text-[11px] font-semibold text-slate-600 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm">
                        CSV
                      </button>
                      {item.category !== "hari_tanpa_hujan" && (
                        <button onClick={() => handleDownloadFile('tif', item.filename_base)} className="flex-1 sm:flex-none px-3 py-2 text-[11px] font-semibold text-slate-600 bg-white/60 backdrop-blur-sm border border-slate-200/60 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm">
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
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-white/60 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-sm transition-all"
                      >
                        <Eye size={14}/> Detail
                      </button>
                      <button 
                        onClick={() => setDeleteTarget({ id: item.id, title: item.title })} 
                        className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-white/60 backdrop-blur-sm border border-red-100 text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all"
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
          <div className="flex justify-center pt-4">
            <button 
              onClick={() => fetchArchives(false)} 
              disabled={isLoading}
              className="text-sm font-semibold bg-white/80 backdrop-blur-xl text-slate-700 border border-white/60 px-8 py-3 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:bg-white transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={16}/> : <ChevronDown size={16}/>}
              {isLoading ? 'Memuat...' : 'Tampilkan Lebih Banyak'}
            </button>
          </div>
        )}
      </div>

      {/* ================= MODAL PREVIEW & EDIT ================= */}
      {previewData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-md p-4 transition-all">
          <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2rem] w-full max-w-6xl max-h-[95vh] flex flex-col md:flex-row gap-6 overflow-hidden shadow-2xl border border-white/60 animate-fade-in-up">
            
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 text-xl truncate pr-4">{previewData.title}</h3>
                <button onClick={() => setPreviewData(null)} className="text-slate-400 hover:text-slate-700 bg-white/50 p-2 rounded-full md:hidden shadow-sm border border-slate-200/50"><X size={18}/></button>
              </div>
              <div className="flex-1 bg-slate-50/50 backdrop-blur-sm rounded-2xl overflow-auto flex items-center justify-center p-3 border border-slate-200/50">
                <img src={previewData.url} alt="Preview Arsip" className="max-h-[75vh] object-contain bg-white rounded-xl shadow-sm border border-slate-100" />
              </div>
            </div>

            <div className="w-full md:w-[350px] lg:w-[400px] flex flex-col max-h-[40vh] md:max-h-none border-t md:border-t-0 md:border-l border-slate-200/60 pt-5 md:pt-0 md:pl-6 relative">
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <div className="bg-blue-50 p-1.5 rounded-lg"><Bot className="text-blue-600" size={16}/></div> Analisis Cuaca
                </h3>
                
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button 
                      onClick={() => setIsEditing(true)} 
                      className="text-xs flex items-center gap-1.5 bg-white/60 backdrop-blur-sm border border-slate-200/60 text-slate-700 px-3 py-1.5 rounded-xl hover:bg-white font-semibold transition-colors shadow-sm"
                    >
                      <Edit3 size={12}/> Edit Teks
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsEditing(false); setEditAnalysisText(previewData.analysis); }} 
                        className="text-xs font-semibold text-slate-500 border border-slate-200/60 hover:bg-white bg-white/50 px-3 py-1.5 rounded-xl transition-colors shadow-sm"
                      >
                        Batal
                      </button>
                      <button 
                        onClick={handleSaveEdit} 
                        disabled={isSavingEdit} 
                        className="text-xs font-bold bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-1.5 rounded-xl shadow-md hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50"
                      >
                        {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
                      </button>
                    </div>
                  )}
                  <button onClick={() => setPreviewData(null)} className="hidden md:flex text-slate-400 hover:text-slate-700 bg-white/50 hover:bg-white p-2 rounded-full ml-1 border border-slate-200/50 shadow-sm transition-colors"><X size={18}/></button>
                </div>
              </div>
              
              <div className="flex-1 bg-slate-50/50 backdrop-blur-sm border border-slate-200/50 rounded-2xl p-5 text-sm text-slate-700 overflow-y-auto whitespace-pre-wrap leading-relaxed custom-scrollbar shadow-inner">
                {isEditing ? (
                  <textarea 
                    className="w-full h-full min-h-[250px] bg-white/80 border border-slate-200 rounded-xl p-4 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none font-medium transition-all shadow-sm"
                    value={editAnalysisText}
                    onChange={(e) => setEditAnalysisText(e.target.value)}
                    placeholder="Ketik narasi analisis di sini..."
                  />
                ) : (
                  previewData.analysis ? (
                    <div className="text-justify font-medium">{previewData.analysis}</div>
                  ) : (
                    <div className="text-center text-slate-400 mt-16 flex flex-col items-center">
                      <div className="bg-white/60 p-4 rounded-full shadow-sm border border-slate-200/50 mb-3"><FileJson className="text-slate-300" size={32}/></div>
                      <p className="text-xs font-semibold">Tidak ada catatan analisis AI.</p>
                    </div>
                  )
                )}
              </div>
              
              {!isEditing && (
                <button 
                  onClick={handleCopyText} 
                  disabled={!previewData.analysis} 
                  className="mt-4 w-full py-3.5 bg-white/80 backdrop-blur-md border border-slate-200/80 hover:bg-white text-slate-700 font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {isCopied ? <Check className="text-green-600" size={18}/> : <Copy className="text-slate-400" size={18}/>}
                  {isCopied ? 'Teks Tersalin!' : 'Salin Analisis'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ================= MODAL HAPUS ================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/30 backdrop-blur-md p-4 transition-all">
          <div className="bg-white/90 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl flex flex-col w-full max-w-sm border border-white/60 text-center animate-fade-in-up">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 border border-red-100 shadow-sm">
              <AlertTriangle size={32}/>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Hapus Arsip?</h3>
            <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
              Data <strong className="text-slate-800">{deleteTarget.title}</strong> akan dihapus permanen dari sistem.
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-3 rounded-xl font-bold bg-white border border-slate-200/80 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                Batal
              </button>
              <button onClick={executeDelete} className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-md transition-all active:scale-95">
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[10000] px-5 py-3.5 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-3 border backdrop-blur-md ${toast.type === 'error' ? 'bg-red-50/90 text-red-700 border-red-200' : 'bg-slate-800/90 text-white border-slate-700'}`}>
          {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 className="text-emerald-400" size={18}/>}
          {toast.message}
        </div>
      )}
    </div>
  );
}