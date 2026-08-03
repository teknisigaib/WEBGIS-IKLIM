import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { Bot, Copy, Download, Check, CheckCircle2, AlertCircle, X, Save, FileText, GripHorizontal, Sparkles, RefreshCw } from 'lucide-react'; 

import MapWorkspace from './components/MapWorkspace';
import SidebarControls from './components/SidebarControls';
import DashboardArsip from './components/DashboardArsip';
import Home from './components/Home';

export const API_URL = import.meta.env.VITE_API_BASE_URL;

export default function App() {
  const [mapData, setMapData] = useState(null);
  const [analysisText, setAnalysisText] = useState(""); 
  const [isLoading, setIsLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0); 

  const [showModal, setShowModal] = useState(false);
  const [exportData, setExportData] = useState({ url: '', filename: '' });
  const [pendingFormData, setPendingFormData] = useState(null);
  
  // STATE BARU: Simpan Form Data Terakhir & Custom Prompt
  const [lastMapParams, setLastMapParams] = useState(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  // === FITUR RESIZE (GESER TINGGI PETA & AI) ===
  const [mapHeight, setMapHeight] = useState(60); 
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      
      if (newHeight >= 20 && newHeight <= 80) {
        setMapHeight(newHeight);
      }
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; 
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isDragging]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleGenerateMap = async (formData) => {
    setIsLoading(true);
    setAnalysisText(""); 
    setLastMapParams(formData); // Simpan input user buat dipakai saat Regenerate AI
    
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      const response = await axios.post(`${API_URL}/api/generate-map`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      setMapData(response.data.data);
      setAnalysisText(response.data.data.analysis_text); 
      setMapHeight(60); 
      showToast('Peta web & Draf Analisis berhasil dimuat!', 'success');
    } catch (error) {
      const detailErr = error.response?.data?.detail;
      const safeMessage = typeof detailErr === 'string' ? detailErr : 'Terjadi kesalahan sistem atau format data ditolak server.';
      showToast(safeMessage, 'error');
    } finally { setIsLoading(false); }
  };

  // FUNGSI BARU: Regenerate Text AI Saja (Tanpa ngulang hitung peta)
  const handleRegenerateAI = async () => {
    if (!lastMapParams) return;
    setIsRegenerating(true);
    try {
      const data = new FormData();
      Object.keys(lastMapParams).forEach(key => data.append(key, lastMapParams[key]));
      data.append("custom_prompt", customPrompt); // Suntik instruksi tambahan

      const response = await axios.post(`${API_URL}/api/regenerate-analysis`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      
      setAnalysisText(response.data.data.analysis_text);
      showToast("Teks AI berhasil diperbarui sesuai instruksi!", "success");
    } catch (error) {
      showToast("Gagal memperbarui analisis AI.", "error");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handlePreviewPrint = async (formData) => {
    setIsLoading(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => data.append(key, formData[key]));
      
      const response = await axios.post(`${API_URL}/api/preview-print`, data, { 
        headers: { 'Content-Type': 'multipart/form-data' },
        responseType: 'blob' 
      });
      
      const formatCategory = (formData.category || 'PETA').toUpperCase();
      const formatPeriod = (formData.period || 'UNKNOWN').replace(/\s+/g, '_').toUpperCase();
      const tempFilename = `PETA_${formatCategory}_${formatPeriod}.png`;

      const imageUrl = URL.createObjectURL(response.data);

      setPendingFormData(formData);
      setExportData({ url: imageUrl, filename: tempFilename });
      
      setShowModal(true);
    } catch (error) {
      showToast('Gagal memuat preview gambar cetak.', 'error');
    } finally { setIsLoading(false); }
  };

  const handleSaveAndDownload = async () => {
    if (!pendingFormData) return;
    setIsSaving(true);
    try {
      const data = new FormData();
      Object.keys(pendingFormData).forEach(key => data.append(key, pendingFormData[key]));
      data.append("analysis_text", analysisText); 

      const response = await axios.post(`${API_URL}/api/save-archive`, data, { headers: { 'Content-Type': 'multipart/form-data' } });

      const link = document.createElement('a');
      link.href = exportData.url; 
      link.download = response.data.filename || exportData.filename; 
      document.body.appendChild(link);
      link.click(); 
      document.body.removeChild(link);
      
      URL.revokeObjectURL(exportData.url);
      
      setShowModal(false); 
      setPendingFormData(null);
      showToast('Berhasil! Peta & Analisis tersimpan di arsip.', 'success');
      
      setResetKey(prev => prev + 1); 
      setMapData(null); 
      setAnalysisText("");
      setCustomPrompt(""); 

    } catch (error) {
      showToast('Gagal menyimpan peta ke Arsip.', 'error');
    } finally { setIsSaving(false); }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(analysisText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    showToast('Teks analisis disalin ke clipboard!', 'success');
  };

  const downloadTxt = () => {
    const element = document.createElement("a");
    const file = new Blob([analysisText], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "Draf_Analisis_Cuaca.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="bg-slate-50 min-h-screen">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/buat-peta" element={
            <div className="flex h-screen overflow-hidden bg-slate-50">
              
              <SidebarControls 
                key={resetKey} 
                onGenerate={handleGenerateMap} 
                onExport={handlePreviewPrint} 
                isLoading={isLoading} 
                hasPreview={!!mapData} 
              />
              
              <div ref={containerRef} className="flex-1 flex flex-col relative h-full bg-white">
                
                <div style={{ height: mapData ? `${mapHeight}%` : '100%' }} className="w-full relative transition-none">
                  <MapWorkspace mapData={mapData} isLoading={isLoading} />
                </div>
                
                {mapData && (
                  <div 
                    onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
                    className={`h-3 w-full bg-slate-100 hover:bg-blue-200 border-y border-slate-200 flex items-center justify-center cursor-row-resize z-30 transition-colors shadow-sm ${isDragging ? 'bg-blue-300' : ''}`}
                    title="Tarik naik/turun"
                  >
                    <GripHorizontal size={16} className={`text-slate-400 ${isDragging ? 'text-blue-700' : ''}`} />
                  </div>
                )}
                
                {mapData && (
                  <div 
                    style={{ height: `calc(${100 - mapHeight}% - 12px)` }} 
                    className="w-full bg-slate-50 p-5 flex flex-col relative z-20 shadow-inner"
                  >
                    <div className="flex items-center justify-between mb-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="bg-white p-1.5 rounded-lg text-blue-600 border border-slate-200 shadow-sm">
                          <Bot size={18} />
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm">Draf Analisis Cuaca AI</h3>
                        <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-bold ml-2 hidden sm:block">Editable</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={copyToClipboard} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-sm">
                          {isCopied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14} />}
                          {isCopied ? 'Tersalin!' : 'Copy'}
                        </button>
                        <button onClick={downloadTxt} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-lg transition-colors shadow-sm">
                          <Download size={14} /> .TXT
                        </button>
                      </div>
                    </div>

                    {/* BAR KUSTOMISASI AI (FITUR BARU ADA DI SINI) */}
                    <div className="flex gap-2 mb-3 shrink-0">
                      <div className="relative flex-1">
                        <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                        <input 
                          type="text" 
                          className="w-full pl-8 pr-4 py-2 text-xs bg-white border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 text-slate-700 placeholder:text-slate-400 font-medium shadow-sm transition-all"
                          placeholder="Beri instruksi khusus AI (Cth: Fokuskan narasi pada Kota Samarinda karena potensi banjir...)"
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRegenerateAI()}
                        />
                      </div>
                      <button 
                        onClick={handleRegenerateAI}
                        disabled={isRegenerating || !customPrompt.trim()}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:grayscale text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                      >
                        {isRegenerating ? <RefreshCw size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                        Regenerate AI
                      </button>
                    </div>

                    <textarea 
                      className="flex-1 w-full h-full bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 leading-relaxed outline-none focus:ring-2 focus:ring-blue-400 transition-all resize-none shadow-sm custom-scrollbar"
                      value={analysisText}
                      onChange={(e) => setAnalysisText(e.target.value)}
                      placeholder="Menunggu analisis AI..."
                    />
                  </div>
                )}
              </div>

              {showModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-all p-4">
                  <div className="bg-white rounded-3xl shadow-2xl flex flex-col w-full max-w-5xl max-h-[95vh] animate-fade-in-up overflow-hidden border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><CheckCircle2 size={20}/></div>
                        <div>
                          <h2 className="text-lg font-black text-slate-800 leading-none">Preview Layout Cetak</h2>
                          <p className="text-xs text-slate-500 font-medium mt-1">Verifikasi hasil sebelum disimpan ke database</p>
                        </div>
                      </div>
                      <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors">
                        <X size={24} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-auto bg-slate-200/50 p-6 flex justify-center items-center">
                      <img src={exportData.url} alt="Preview Peta" className="max-h-[60vh] object-contain shadow-md border border-slate-200 rounded-sm bg-white" />
                    </div>

                    <div className="px-6 py-5 bg-white border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-2 max-w-md w-full">
                        <FileText size={16} className="text-slate-400 shrink-0"/>
                        <p className="text-xs font-semibold text-slate-500 truncate" title={exportData.filename}>
                          File: <span className="text-blue-600">{exportData.filename}</span>
                        </p>
                      </div>
                      <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={() => setShowModal(false)} className="flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                          Batal
                        </button>
                        <button onClick={handleSaveAndDownload} disabled={isSaving} className="flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-md shadow-emerald-500/30 disabled:opacity-70 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                          {isSaving ? <span className="flex items-center gap-2"><Bot size={16} className="animate-bounce"/> Menyimpan...</span> : <span className="flex items-center gap-2"><Save size={16}/> Simpan & Download</span>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          } />
          <Route path="/arsip" element={<DashboardArsip />} />
        </Routes>
      </Router>

      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[10000] px-5 py-3 rounded-2xl shadow-xl font-bold text-sm animate-fade-in-up flex items-center gap-3 border backdrop-blur-md ${toast.type === 'error' ? 'bg-red-50/90 text-red-700 border-red-200' : 'bg-emerald-50/90 text-emerald-700 border-emerald-200'}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}