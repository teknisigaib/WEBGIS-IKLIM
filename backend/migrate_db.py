from sqlalchemy import text
from config import engine

BULAN_ID = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12
}

print("🚀 Memulai Migrasi Data...")

try:
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, period, update_time FROM map_metadata")).fetchall()
        print(f"Total data ditemukan: {len(rows)} baris.")
        
        for row in rows:
            map_id = row.id
            
            # Antisipasi data kosong (Null-safe)
            period_text = str(row.period).lower() if row.period else ""
            update_text = str(row.update_time).lower() if row.update_time else ""
            
            tahun = bulan = tanggal = dasarian = None
            update_date = None
            
            # 1. Bedah period
            words = period_text.split()
            if words and words[-1].isdigit():
                tahun = int(words[-1])
            
            for b_name, b_angka in BULAN_ID.items():
                if b_name in words:
                    bulan = b_angka
                    break
                    
            if "dasarian" in words:
                if "i" in words and "ii" not in words: dasarian = 1
                elif "ii" in words and "iii" not in words: dasarian = 2
                elif "iii" in words: dasarian = 3
            elif "bulan" not in words and words and words[0].isdigit(): 
                tanggal = int(words[0])

            # 2. Bedah update_time ("10 september 2026")
            u_words = update_text.split()
            if len(u_words) >= 3 and u_words[0].isdigit():
                u_tgl = int(u_words[0])
                u_bln = BULAN_ID.get(u_words[1], 1)
                if u_words[2].isdigit():
                    u_thn = int(u_words[2])
                    update_date = f"{u_thn}-{u_bln:02d}-{u_tgl:02d}"
            
            print(f"✅ ID {map_id}: thn={tahun}, bln={bulan}, tgl={tanggal}, dsr={dasarian}, udate={update_date}")
            
            # 3. Update ke Database
            conn.execute(text("""
                UPDATE map_metadata 
                SET tahun = :thn, bulan = :bln, tanggal = :tgl, 
                    dasarian = :dsr, update_time_date = :udate
                WHERE id = :id
            """), {
                "thn": tahun, "bln": bulan, "tgl": tanggal, 
                "dsr": dasarian, "udate": update_date, "id": map_id
            })
            
        conn.commit()
        print("🎉 Migrasi Sukses! Cek pgAdmin lu sekarang 🚀")

except Exception as e:
    print(f"❌ ERROR: {e}")