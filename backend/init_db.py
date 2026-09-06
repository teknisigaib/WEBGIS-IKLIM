from config import engine, Base
import models  # <--- INI KUNCINYA! Kita paksa Python baca file models.py

print("Menghubungkan ke server PostgreSQL di Proxmox...")

# Perintah ini akan mengecek models.py dan menciptakan tabelnya
Base.metadata.create_all(bind=engine)

print("Tabel berhasil dibuat dengan sempurna! 🚀")