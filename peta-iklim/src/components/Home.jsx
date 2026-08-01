import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Map, Archive, ArrowRight, Activity, FileText, ChevronRight, BarChart2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
        const response = await axios.get(`${API_URL}/api/archives`);
        setRecentMaps(response.data.data.slice(0, 3));
        setIsServerOnline(true);
      } catch (error) {
        console.error("Gagal memuat aktivitas:", error);
        setIsServerOnline(false);
      }
    };
    fetchRecent();
  }, []);

  const formatWITA = time.toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour12: false });
  const formatUTC = time.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour12: false });

  return (
    // Style fontFamily diset langsung ke Poppins
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="min-h-screen bg-slate-50 flex flex-col selection:bg-blue-200 text-slate-800">
      
      {/* NAVBAR (GLASSMORPHISM ELEGANT) */}
      <nav className="w-full px-6 py-4 flex flex-col md:flex-row justify-between items-center bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-100">
            <img src="/logo_bmkg.png" alt="BMKG" className="h-8 w-8 object-contain" onError={(e) => e.target.style.display='none'} />
          </div>
          <span className="font-extrabold text-slate-800 text-lg tracking-tight">WebGIS Iklim</span>
        </div>
        <div className="flex items-center gap-6 text-sm font-semibold text-slate-600">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              {isServerOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isServerOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
            </span>
            {isServerOnline ? 'API Connected' : 'API Offline'}
          </div>
          <div className="hidden md:block w-px h-5 bg-slate-300"></div>
          <div className="flex flex-col md:flex-row md:gap-4 items-center">
            <div className="font-bold text-blue-600">{formatWITA} <span className="text-[10px] text-slate-400">WITA</span></div>
            <div className="font-bold text-amber-600">{formatUTC} <span className="text-[10px] text-slate-400">UTC</span></div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-start pt-12 p-6 md:p-12 relative overflow-hidden">
        
        {/* HERO SECTION (MODERN SAAS) */}
        <div className="text-center max-w-3xl mx-auto mb-14 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold mb-6 shadow-sm">
            <BarChart2 size={14}/> Sistem Operasional Stasiun Meteorologi Kelas III
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-5 leading-tight">
            Pusat Kendali <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Pemetaan Iklim Kaltim</span>
          </h1>
          <p className="text-base text-slate-500 leading-relaxed font-medium max-w-xl mx-auto">
            Otomatisasi pengolahan data curah hujan dan sifat hujan menggunakan interpolasi IDW spasial. Cepat, akurat, dan siap rilis.
          </p>
        </div>

        {/* MAIN MENUS (ELEVATED CARDS) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl mb-16 z-10">
          
          {/* Card 1: Buat Peta */}
          <Link to="/buat-peta" className="group flex flex-col justify-between p-8 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-300 transition-all duration-300">
            <div>
              <div className="h-14 w-14 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 flex items-center justify-center rounded-2xl mb-6 shadow-inner border border-blue-100/50">
                <Map size={28} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Buat Peta Baru</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
                Masuk ke ruang kerja (Workspace). Unggah data CSV, atur parameter sebaran, dan render peta cuaca interaktif dengan AI.
              </p>
            </div>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-blue-600 text-sm font-bold">Mulai Generator</span>
              <div className="h-8 w-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ChevronRight size={18} />
              </div>
            </div>
          </Link>

          {/* Card 2: Arsip */}
          <Link to="/arsip" className="group flex flex-col justify-between p-8 bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-emerald-300 transition-all duration-300">
            <div>
              <div className="h-14 w-14 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 flex items-center justify-center rounded-2xl mb-6 shadow-inner border border-emerald-100/50">
                <Archive size={28} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-3">Arsip & Riwayat</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-8 font-medium">
                Akses kembali database peta yang pernah diproduksi. Unduh ulang tata letak cetak (PNG) atau data vektor spasial (GeoJSON).
              </p>
            </div>
            <div className="flex items-center justify-between mt-auto">
              <span className="text-emerald-600 text-sm font-bold">Buka Database</span>
              <div className="h-8 w-8 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ChevronRight size={18} />
              </div>
            </div>
          </Link>

        </div>

        {/* WIDGET RECENT ACTIVITY (MODERN LIST) */}
        <div className="w-full max-w-4xl z-10">
          <div className="flex items-center gap-2 mb-4 px-2 text-slate-800">
            <Activity size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold tracking-wide">Aktivitas Terakhir</h3>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            {recentMaps.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentMaps.map((map) => (
                  <div key={map.id} className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors">
                        <FileText size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 mb-1">{map.title}</p>
                        <p className="text-xs text-slate-500 font-medium">Periode: {map.period}</p>
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-xs font-bold text-slate-700 mb-1">{map.update_time}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center justify-end gap-1">
                        Dibuat oleh: <span className="text-slate-600">{map.creator}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-10 text-center text-slate-500 text-sm font-semibold flex flex-col items-center gap-3">
                <div className="p-4 bg-slate-50 rounded-full"><Archive size={24} className="text-slate-400"/></div>
                Belum ada data arsip atau server sedang offline.
              </div>
            )}
          </div>
        </div>

      </main>

      <footer className="py-8 text-center text-xs text-slate-400 font-semibold tracking-wide">
        &copy; 2026 BMKG Kaltim. Enterprise WebGIS Edition.
      </footer>
    </div>
  );
}