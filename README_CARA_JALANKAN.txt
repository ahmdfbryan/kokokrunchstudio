CARA MENJALANKAN KOKOKRUNCH PRO V3

1. Extract ZIP ini ke folder baru, jangan ditimpa di folder lama.
2. Buka VS Code dari folder kokokrunch_pro_v3.
3. Buka Terminal, jalankan:
   python server.py
   atau:
   py server.py
4. Buka browser:
   http://localhost:8000/login.html
5. Login awal:
   username: admin
   password: GantiPassword123!

Jika muncul error:
- Pastikan server lama dimatikan dulu dengan CTRL + C.
- Jangan buka file HTML langsung. Harus lewat http://localhost:8000/
- Jika masih error, hapus token browser: buka DevTools > Application > Local Storage > hapus kk_token.

Update V5:
- Jika sudah login, tombol Masuk Tim otomatis menjadi Dashboard di halaman publik.
- Di halaman dashboard, tombol tersebut menjadi Keluar.
- Jika sudah login lalu membuka login.html, otomatis diarahkan ke dashboard.html.
