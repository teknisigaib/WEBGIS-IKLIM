import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertCircle } from 'lucide-react';

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
    <div className="bg-slate-100 min-h-screen flex items-center justify-center p-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-blue-600 animate-fade-in-up">
        
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-full mb-3">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Otentikasi Sistem</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Panel Forecaster WebGIS BMKG Kaltim</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 mb-5 animate-fade-in-up text-sm font-bold">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="mb-6">
            <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Kunci Akses (Password)
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all font-medium text-slate-700 placeholder:text-slate-300"
              placeholder="Masukkan password..."
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full text-white font-bold py-3 px-4 rounded-xl transition-all flex justify-center items-center shadow-md active:scale-95 ${
              isLoading ? 'bg-blue-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'
            }`}
          >
            {isLoading ? 'Memverifikasi...' : 'Masuk Sistem'}
          </button>
        </form>
        
      </div>
    </div>
  );
}