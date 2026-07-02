CARA MENJALANKAN
1. Extract folder ini.
2. Buka terminal/CMD di folder kokokrunch_pro.
3. Jalankan: python server.py
4. Buka browser: http://localhost:8000

LOGIN DASHBOARD
Username: admin
Password: GantiPassword123!
Segera ganti/tambahkan akun baru dari menu Tim, lalu ubah/hapus akun default di database jika sudah online.

DATABASE
File database otomatis dibuat di: data/kokokrunch.db
Tabel: users dan orders.

HALAMAN
- index.html
- layanan.html
- order.html
- cek-pesanan.html
- login.html
- dashboard.html

CATATAN DEPLOYMENT
Server ini cocok untuk testing lokal/prototype. Untuk produksi, gunakan HTTPS, hosting backend yang stabil, batasi ukuran upload, dan ganti sistem token in-memory menjadi session/JWT yang persistent.
