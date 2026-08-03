import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Map, Archive, Activity, FileText, ChevronRight, BarChart2, CheckCircle2, XCircle, Clock } from 'lucide-react';
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
        const response = await axios.get(`${API_URL}/archives`);
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
    <div style={{ fontFamily: "'Poppins', sans-serif" }} className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800">
      
      {/* NAVBAR (CLEAN & PROFESSIONAL) */}
      <nav className="w-full px-6 py-4 flex flex-col md:flex-row justify-between items-center bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="flex items-center gap-3 mb-4 md:mb-0">
          <img src="/logo_bmkg.png" alt="BMKG" className="h-9 w-9 object-contain" onError={(e) => e.target.style.display='none'} />
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 text-lg leading-tight tracking-tight">WebGIS Iklim</span>
            <span className="text-[10px] text-slate-500 font-medium tracking-wide">STAMET KELAS III APT PRANOTO</span>
          </div>
        </div>
        
        <div className="flex items-center gap-5 text-sm font-semibold">
          {/* Status Indikator yang lebih rapi */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${isServerOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {isServerOnline ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            <span className="text-xs">{isServerOnline ? 'System Online' : 'System Offline'}</span>
          </div>

          <div className="hidden md:block w-px h-6 bg-slate-200"></div>
          
          <div className="flex items-center gap-4 bg-slate-50 px-4 py-1.5 rounded-md border border-slate-200">
            <Clock size={16} className="text-slate-400" />
            <div className="flex flex-col md:flex-row md:gap-4 items-center">
              <div className="font-bold text-slate-700">{formatWITA} <span className="text-[10px] text-slate-500">WITA</span></div>
              <div className="font-bold text-slate-700">{formatUTC} <span className="text-[10px] text-slate-500">UTC</span></div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-start pt-10 p-6 md:p-10 w-full max-w-5xl mx-auto">
        
        {/* HEADER SECTION (CENTERED & AUTHORITATIVE) */}
        <div className="w-full text-center flex flex-col items-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-100 text-blue-800 text-xs font-bold mb-4">
            <BarChart2 size={14}/> Dasbor Operasional
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-3">
            WEBGIS Pemetaan Data Iklim
          </h1>
          <p className="text-sm text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
            Sistem otomatisasi pengolahan prakiraan dan analisis menggunakan algoritma interpolasi IDW spasial.
          </p>
        </div>

        {/* WORKSPACE CARDS (FUNCTIONAL & FLAT) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full mb-12">
          
          <Link to="/buat-peta" className="group flex flex-col p-6 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:ring-1 hover:ring-blue-400 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 bg-blue-50 text-blue-600 flex items-center justify-center rounded-lg border border-blue-100">
                <Map size={24} strokeWidth={2} />
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Buat Peta Baru</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
              Buka ruang kerja untuk mengunggah data stasiun, mengatur parameter sebaran spasial, dan merender peta cuaca.
            </p>
            <div className="mt-auto text-blue-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              Mulai Render Spasial <ChevronRight size={16} />
            </div>
          </Link>

          <Link to="/arsip" className="group flex flex-col p-6 bg-white border border-slate-200 rounded-xl hover:border-emerald-400 hover:ring-1 hover:ring-emerald-400 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 bg-emerald-50 text-emerald-600 flex items-center justify-center rounded-lg border border-emerald-100">
                <Archive size={24} strokeWidth={2} />
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Database Arsip</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-6 font-medium">
              Akses kembali riwayat peta yang pernah diproduksi. Unduh ulang tata letak cetak (PNG) atau data vektor (GeoJSON).
            </p>
            <div className="mt-auto text-emerald-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
              Buka Penyimpanan <ChevronRight size={16} />
            </div>
          </Link>

        </div>

        {/* RECENT ACTIVITY (COMPACT DATA-TABLE STYLE) */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2 text-slate-800">
              <Activity size={18} className="text-slate-600" />
              <h3 className="text-sm font-bold tracking-wide">Aktivitas Render Terakhir</h3>
            </div>
            <Link to="/arsip" className="text-xs font-bold text-blue-600 hover:underline">Lihat Semua</Link>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {recentMaps.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentMaps.map((map) => (
                  <div key={map.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="text-slate-400">
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 mb-0.5">{map.title}</p>
                        <p className="text-xs text-slate-500 font-medium">Periode: {map.period}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700 mb-0.5">{map.update_time}</p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Oleh: {map.creator}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm font-medium flex flex-col items-center gap-2">
                <Archive size={24} className="text-slate-300"/>
                {isServerOnline ? 'Belum ada data arsip peta.' : 'Menunggu koneksi server...'}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* FOOTER DIPERBARUI */}
      <footer className="py-6 flex flex-col items-center gap-1 text-center text-xs text-slate-500 font-medium">
        <span>&copy; 2026 Badan Meteorologi Klimatologi dan Geofisika Provinsi Kalimantan Timur.</span>
        <span>Stasiun Meteorologi APT Pranoto Samarinda</span>
      </footer>
    </div>
  );
}