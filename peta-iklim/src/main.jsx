import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <-- Boleh dibiarkan (karena isinya sudah kita kosongkan)
import './App.css'   // <-- Ini yang memuat Tailwind v4 kita

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)