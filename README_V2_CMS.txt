KokoKrunch Studio v2.0 CMS

Cara menjalankan:
1. Extract ZIP.
2. Buka terminal di folder kokokrunch_studio_v2_cms.
3. Jalankan: python server.py
4. Buka: http://localhost:8000
5. Login admin: admin / GantiPassword123!

Fitur v2.0:
- Admin dapat custom layanan dari dashboard.
- Admin dapat custom nominal Robux per layanan.
- Admin dapat custom metode pembayaran dan upload gambar QRIS.
- Staff hanya dapat mengakses Ringkasan dan Pesanan Masuk.
- Data layanan, nominal, pembayaran, pesanan, dan tim tersimpan di SQLite database.
- Database otomatis dibuat saat server pertama dijalankan.

Catatan:
- Jangan buka file HTML langsung atau lewat Live Server port 5500.
- Jalankan selalu dari server.py dan akses via port 8000.
