import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Map, Archive, Activity, FileText, ChevronRight, BarChart2, CheckCircle2, XCircle, Clock, LogOut, Sparkles } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

export default function Home() {
  const [time, setTime] = useState(new Date());
  const [recentMaps, setRecentMaps] = useState([]);
  const [isServerOnline, setIsServerOnline] = useState(true);

  // Efek Jam Real-time
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Ambil 3 Arsip Terakhir dari Database
  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const token = localStorage.getItem('bmkg_token') || "";
        const config = { headers: { "x-api-key": token } };

        const response = await axios.get(`${API_URL}/archives?skip=0&limit=3`, config);
        
        if (response.data.status === "success") {
          setRecentMaps(response.data.data);
          setIsServerOnline(true);
        }
      } catch (error) {
        console.error("Gagal memuat aktivitas:", error);
        setIsServerOnline(false);
      }
    };
    fetchRecent();
  }, []);

  // Fungsi Logout
  const handleLogout = () => {
    localStorage.removeItem('bmkg_token');
    window.location.href = '/login';
  };

  const formatWITA = time.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour12: false });
  const formatUTC = time.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false });

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="min-h-screen bg-slate-50 flex flex-col text-slate-800 relative overflow-hidden">
      
      {/* Background Ornaments (Efek Cahaya Modern) */}
      <div className="fixed top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-400/20 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* NAVBAR (GLASSMORPHISM) */}
      <nav className="w-full px-6 py-4 flex flex-col md:flex-row justify-between items-center bg-white/70 backdrop-blur-xl border-b border-white/50 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3 mb-4 md:mb-0 transform hover:scale-105 transition-transform cursor-default">
          <img src="/logo_bmkg.png" alt="BMKG" className="h-10 w-10 object-contain drop-shadow-md" onError={(e) => e.target.style.display='none'} />
          <div className="flex flex-col">
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-slate-800 text-lg leading-tight tracking-tight">WebGIS Iklim</span>
            <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Stamet APT Pranoto</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 text-sm font-medium">
          {/* Status Indikator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-white/50 backdrop-blur-sm shadow-sm ${isServerOnline ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'}`}>
            {isServerOnline ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span className="text-xs font-semibold">{isServerOnline ? 'Online' : 'Offline'}</span>
          </div>
          
          <div className="flex items-center gap-4 bg-white/50 backdrop-blur-sm px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Clock size={16} className="text-blue-500" />
            <div className="flex flex-col md:flex-row md:gap-4 items-center">
              <div className="font-semibold text-slate-700">{formatWITA} <span className="text-[10px] text-slate-400 font-medium">WITA</span></div>
              <div className="font-semibold text-slate-700 hidden md:block">{formatUTC} <span className="text-[10px] text-slate-400 font-medium">UTC</span></div>
            </div>
          </div>

          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 bg-white/50 backdrop-blur-sm text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-all text-xs font-semibold shadow-sm active:scale-95">
            <LogOut size={16} /> <span className="hidden md:block">Keluar</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-start pt-12 p-6 md:p-10 w-full max-w-5xl mx-auto relative z-10">
        
        {/* HEADER SECTION */}
        <div className="w-full text-center flex flex-col items-center mb-12 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold mb-5 shadow-sm">
            <Sparkles size={14} className="text-blue-500"/> Dasbor WebGIS BMKG Samarinda
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 tracking-tight mb-4 drop-shadow-sm">
            WEBGIS Pemetaan Iklim
          </h1>
          <p className="text-sm md:text-base text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            Sistem otomatisasi pengolahan prediksi dan analisis cuaca menggunakan algoritma interpolasi spasial dan AI.
          </p>
        </div>

        {/* WORKSPACE CARDS (MODERN GLASSMORPHISM) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-14">
          
          <Link to="/buat-peta" className="group flex flex-col p-8 bg-white/80 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(37,99,235,0.1)] hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start justify-between mb-6">
              <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-blue-400 text-white flex items-center justify-center rounded-2xl shadow-lg shadow-blue-500/30 group-hover:rotate-3 transition-transform">
                <Map size={28} strokeWidth={2} />
              </div>
              <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <ChevronRight size={20} className="text-slate-400 group-hover:text-blue-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Render Peta Baru</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
              Buka workspace untuk mengunggah data observasi, mengatur parameter IDW, dan menghasilkan narasi AI.
            </p>
            <div className="mt-auto inline-flex items-center gap-2 text-blue-600 text-sm font-semibold group-hover:gap-3 transition-all">
              Workspace <ArrowRight size={16} />
            </div>
          </Link>

          <Link to="/arsip" className="group flex flex-col p-8 bg-white/80 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(16,185,129,0.1)] hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-start justify-between mb-6">
              <div className="h-14 w-14 bg-gradient-to-br from-emerald-500 to-emerald-400 text-white flex items-center justify-center rounded-2xl shadow-lg shadow-emerald-500/30 group-hover:-rotate-3 transition-transform">
                <Archive size={28} strokeWidth={2} />
              </div>
              <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                <ChevronRight size={20} className="text-slate-400 group-hover:text-emerald-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Database Arsip</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
              Akses kembali riwayat pemetaan yang pernah diproduksi. Unduh aset visual resolusi tinggi (PNG) dan data vektor (JSON).
            </p>
            <div className="mt-auto inline-flex items-center gap-2 text-emerald-600 text-sm font-semibold group-hover:gap-3 transition-all">
              Buka Penyimpanan <ArrowRight size={16} />
            </div>
          </Link>

        </div>

        {/* RECENT ACTIVITY */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-5 px-2">
            <div className="flex items-center gap-2.5 text-slate-800">
              <div className="p-1.5 bg-slate-200/50 rounded-lg"><Activity size={18} className="text-slate-600" /></div>
              <h3 className="text-sm font-semibold tracking-wide">Aktivitas Terakhir</h3>
            </div>
            <Link to="/arsip" className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1">
              Lihat Semua <ChevronRight size={14}/>
            </Link>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl border border-white/60 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden p-2">
            {recentMaps.length > 0 ? (
              <div className="divide-y divide-slate-100/80">
                {recentMaps.map((map) => (
                  <div key={map.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-slate-50/80 rounded-2xl transition-colors gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 shrink-0 border border-slate-200/50">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 mb-1">{map.title}</p>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                          <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">{map.period}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1"><Clock size={12}/> {map.update_time}</span>
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right pl-16 sm:pl-0">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Dibuat Oleh</p>
                      <p className="text-xs font-medium text-slate-700 bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">
                        {map.creator || "TIM FORECASTER"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-3">
                <div className="bg-slate-100 p-4 rounded-full mb-2"><Archive size={28} className="text-slate-400"/></div>
                <p className="text-sm font-medium">{isServerOnline ? 'Belum ada data arsip peta yang tersimpan.' : 'Menunggu koneksi ke server database...'}</p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="py-8 mt-10 relative z-10 flex flex-col items-center gap-1.5 text-center text-xs text-slate-500 font-medium">
        <span className="font-medium text-slate-600">&copy; {new Date().getFullYear()} Badan Meteorologi, Klimatologi dan Geofisika.</span>
        <span>Stasiun Meteorologi Kelas II APT Pranoto Samarinda</span>
      </footer>
    </div>
  );
}

// Komponen pembantu untuk arrow
function ArrowRight(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );
}