V7 Client Stats Fix

Perbaikan:
- Client Puas di homepage kini mengikuti jumlah pesanan berstatus Terkirim.
- Sebelumnya memakai COUNT(DISTINCT username), sehingga jika 2 pesanan dari username sama tetap dihitung 1 client.

Jalankan: python server.py
Refresh browser: CTRL + F5
