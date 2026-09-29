import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Lock, ArrowRight, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate(); 

  useEffect(() => {
    const existingToken = localStorage.getItem('bmkg_token');
    if (existingToken) {
      navigate('/'); 
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('bmkg_token', data.token);
        navigate('/'); 
      } else {
        setError(data.detail || 'Password salah atau tidak valid.');
      }
    } catch (err) {
      setError('Gagal terhubung ke server backend.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden" style={{ fontFamily: "'Poppins', sans-serif" }}>
      
      {/* Background Ornaments (Efek Cahaya Modern) */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-400/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-emerald-400/20 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Card Utama */}
      <div className="bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] w-full max-w-md border border-white/60 relative z-10 animate-fade-in-up">
        
        <div className="text-center mb-8">
          {/* Logo BMKG Resmi */}
          <div className="mx-auto w-20 h-20 mb-5 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
            <img 
              src="/logo_bmkg.png" 
              alt="Logo BMKG" 
              className="w-full h-full object-contain drop-shadow-md" 
              onError={(e) => e.target.style.display='none'} 
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Autentikasi</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">Panel Forecaster WebGIS BMKG Samarinda</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-2.5 mb-6 text-sm font-semibold animate-fade-in-up">
            <AlertCircle size={18} className="shrink-0" /> 
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="password" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
              Password
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock size={18} className="text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                placeholder="Masukkan password..."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-bold py-3.5 px-4 rounded-xl transition-all flex justify-center items-center gap-2 group ${
              isLoading 
                ? 'bg-blue-400 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.98]'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <>
                <span>Masuk</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
        
      </div>

      {/* Footer Minimalis */}
      <div className="mt-8 text-center relative z-10">
        <p className="text-xs font-medium text-slate-400">
          &copy; {new Date().getFullYear()} Stasiun Meteorologi Kelas II Aji Pangeran Tumenggung Pranoto - Samarinda.
        </p>
      </div>

    </div>
  );
}