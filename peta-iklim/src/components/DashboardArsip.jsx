import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, Eye, Download, Trash2, ArrowLeft, Archive, CloudRain, 
  Wind, RefreshCw, FileJson, FileSpreadsheet, AlertTriangle, Bot, Edit3,
  CheckCircle2, AlertCircle, X, Check, Copy, ChevronDown 
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL;

// Gembok rahasia yang sama dengan di routes.py backend
const API_KEY = "Administrator96607"; 
const axiosConfig = {
  headers: {
    "x-api-key": API_KEY
  }
};

const CATEGORY_MAP = {
  prakiraan_hujan_dasarian: { label: "Prakiraan Hujan Dasarian" },
  prakiraan_hujan_bulanan: { label: "Prakiraan Hujan Bulanan" },
  prakiraan_sifat_dasarian: { label: "Prakiraan Sifat Dasarian" },
  prakiraan_sifat_bulanan: { label: "Prakiraan Sifat Bulanan" },
  analisis_hujan_dasarian: { label: "Analisis Hujan Dasarian" },
  analisis_hujan_bulanan: { label: "Analisis Hujan Bulanan" },
  analisis_sifat_bulanan: { label: "Analisis Sifat Hujan Bulanan" },
  analisis_hari_hujan_bulanan: { label: "Analisis Hari Hujan Bulanan" },
};

export default function DashboardArsip() {
  const [archiveData, setArchiveData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  
  // State untuk Pagination
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
    // Ambil data pertama kali (reset = true)
    fetchArchives(true); 
  }, []);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    try {
      // ⚠️ Sisipkan axiosConfig biar bisa nembus gembok
      const response = await axios.delete(`${API_URL}/archives/${deleteTarget.id}`, axiosConfig);
      if (response.data.status === "success") {
        showToast(`Arsip "${deleteTarget.title}" berhasil dihapus.`, "success");
        setDeleteTarget(null); 
        fetchArchives(true); // Reset tampilan setelah hapus
      }
    } catch (error) { 
      showToast("Akses ditolak atau server bermasalah.", "error"); 
    }
  };

  const handleSaveEdit = async () => {
    if (!previewData) return;
    setIsSavingEdit(true);
    try {
      // ⚠️ Sisipkan axiosConfig biar bisa nembus gembok
      await axios.put(`${API_URL}/archives/${previewData.id}/analysis`, {
        analysis_text: editAnalysisText
      }, axiosConfig);
      
      setPreviewData({...previewData, analysis: editAnalysisText});
      setIsEditing(false);
      
      // Update data di tabel lokal tanpa perlu fetch ulang semua
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
          <ArrowLeft size={16} /> Kembali ke Beranda
        </Link>
        <button onClick={() => fetchArchives(true)} title="Muat Ulang Data" className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 shadow-sm px-4 py-2 rounded-xl transition-all">
          <RefreshCw size={14} className={isLoading && skip === 0 ? "animate-spin text-blue-600" : ""} /> Refresh
        </button>
      </div>

      <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in-up">
        
        {/* STATISTIK DASHBOARD */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Database Peta</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Card 1: Total Arsip */}
            <div className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 relative overflow-hidden flex justify-between items-center cursor-default">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 z-0"></div>
              <div className="relative z-10">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Total Arsip</p>
                <h3 className="text-4xl font-black text-slate-800">{totalData || archiveData.length}</h3>
              </div>
              <div className="relative z-10 h-14 w-14 bg-blue-50 text-blue-600 border border-blue-100/50 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <Archive size={26} strokeWidth={2} />
              </div>
            </div>
            
            {/* Card 2: Peta Hujan (Lokal Data) */}
            <div className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 relative overflow-hidden flex justify-between items-center cursor-default">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 z-0"></div>
              <div className="relative z-10">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Dimuat</p>
                <h3 className="text-4xl font-black text-slate-800">{archiveData.length}</h3>
              </div>
              <div className="relative z-10 h-14 w-14 bg-slate-50 text-slate-500 border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors duration-300">
                <CloudRain size={26} strokeWidth={2} />
              </div>
            </div>
            
            {/* Card 3: Peta Sifat (Kosong/Lainnya) */}
            <div className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 relative overflow-hidden flex justify-between items-center cursor-default">
              <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 z-0"></div>
              <div className="relative z-10">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sisa Data</p>
                <h3 className="text-4xl font-black text-slate-800">{Math.max(0, totalData - archiveData.length)}</h3>
              </div>
              <div className="relative z-10 h-14 w-14 bg-slate-50 text-slate-500 border border-slate-100 rounded-2xl flex items-center justify-center shadow-sm group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors duration-300">
                <Wind size={26} strokeWidth={2} />
              </div>
            </div>
          </div>
        </div>

        {/* KOLOM PENCARIAN & FILTER */}
        <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-2 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all duration-300">
          <div className="relative flex-1 w-full flex items-center">
            <Search className="absolute left-4 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Cari peta yang sudah dimuat (judul/periode)..." 
              className="w-full pl-12 pr-4 py-3.5 bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
          <div className="w-full sm:w-auto relative pr-1.5 pb-1.5 pt-1 sm:pt-0 sm:pb-0 sm:pr-0">
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)} 
              className="w-full sm:w-64 text-sm font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-100 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer appearance-none transition-colors"
            >
              <option value="ALL">Semua Kategori</option>
              {Object.keys(CATEGORY_MAP).map(k => (
                <option key={k} value={k}>{CATEGORY_MAP[k].label}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* TABEL ARSIP */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-6 py-5">Informasi Dokumen</th>
                  <th className="px-6 py-5">Kategori & Waktu Update</th>
                  <th className="px-6 py-5 text-center">Unduh File Resmi</th>
                  <th className="px-6 py-5 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading && skip === 0 ? (
                  <tr><td colSpan="4" className="p-12 text-center text-slate-400 font-medium animate-pulse">Memuat database arsip...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="p-16 text-center text-slate-400 font-medium flex flex-col items-center gap-3 w-full">
                      <div className="bg-slate-50 p-4 rounded-full border border-slate-100"><Search size={24} className="text-slate-300"/></div>
                      Data arsip tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredData.map(item => {
                    const labelStr = CATEGORY_MAP[item.category]?.label || item.category;
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-800 text-base mb-1 group-hover:text-blue-700 transition-colors">{item.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-600 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{item.period}</span>
                            <span className="text-[10px] text-slate-400 font-medium">Oleh: {item.creator}</span>
                            {item.analysis_text && (
                              <span className="flex items-center gap-1 text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 font-bold">
                                <Bot size={10}/> AI Teks
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 font-bold border border-slate-200 text-[10px] uppercase tracking-wider mb-1.5">
                            {labelStr}
                          </span>
                          <p className="text-[11px] font-semibold text-slate-400">{item.update_time}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => handleDownloadFile('png', item.filename_base)} className="text-[11px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm">
                              <Download size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors"/> PNG
                            </button>
                            <button onClick={() => handleDownloadFile('geojson', item.filename_base)} className="text-[11px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm">
                              <FileJson size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors"/> JSON
                            </button>
                            <button onClick={() => handleDownloadFile('csv', item.filename_base)} className="text-[11px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm">
                              <FileSpreadsheet size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors"/> CSV
                            </button>
                            
                            {item.category !== "hari_tanpa_hujan" && (
                              <button onClick={() => handleDownloadFile('tif', item.filename_base)} className="text-[11px] font-bold text-slate-600 bg-white hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-sm" title="Download GeoTIFF">
                                <Download size={14} className="text-slate-400 group-hover:text-blue-500 transition-colors"/> TIF
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center gap-2">
                            <button 
                              onClick={() => {
                                setPreviewData({ 
                                  id: item.id, 
                                  url: `${API_URL}/archives/download/png/${item.filename_base}`, 
                                  title: item.title, 
                                  analysis: item.analysis_text 
                                });
                                setIsEditing(false); 
                                setEditAnalysisText(item.analysis_text || "");
                              }} 
                              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center transition-colors shadow-sm"
                              title="Lihat Detail & Teks AI"
                            >
                              <Eye size={16}/>
                            </button>
                            <button 
                              onClick={() => setDeleteTarget({ id: item.id, title: item.title })} 
                              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-colors shadow-sm"
                              title="Hapus Arsip"
                            >
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          
          {/* TOMBOL LOAD MORE (PAGINATION) */}
          {hasMore && (
            <div className="p-4 border-t border-slate-100 flex justify-center bg-slate-50/50">
              <button 
                onClick={() => fetchArchives(false)} 
                disabled={isLoading}
                className="text-xs font-bold bg-white text-slate-600 border border-slate-200 px-6 py-2.5 rounded-xl shadow-sm hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                {isLoading ? 'Memuat...' : 'Muat Lebih Banyak Arsip'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PREVIEW & EDIT (TETAP SAMA) */}
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
                        onClick={() => { 
                          setIsEditing(false); 
                          setEditAnalysisText(previewData.analysis); 
                        }} 
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

      {/* MODAL HAPUS PERMANEN (TETAP SAMA) */}
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
              <button 
                onClick={() => setDeleteTarget(null)} 
                className="flex-1 py-3 rounded-xl font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
              >
                Batal
              </button>
              <button 
                onClick={executeDelete} 
                className="flex-1 py-3 rounded-xl font-bold bg-slate-900 text-white hover:bg-red-600 shadow-md transition-all active:scale-95"
              >
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