
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import sqlite3, json, hashlib, secrets, time, re, base64, os, csv, io
from urllib.parse import unquote, urlparse, parse_qs
from urllib import request as urlrequest

ROOT = Path(__file__).resolve().parent
DB = ROOT/'data'/'kokokrunch.db'
UPLOADS = ROOT/'uploads'
TOKENS = {}

ROLE_ADMIN = ('owner','admin')

def hash_pw(pw, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.sha256((salt+pw).encode()).hexdigest()
    return salt+'$'+h

def verify(pw, stored):
    try:
        salt,h = stored.split('$',1)
        return hash_pw(pw,salt).split('$',1)[1] == h
    except Exception:
        return False

def db():
    con=sqlite3.connect(DB); con.row_factory=sqlite3.Row; return con

def rowdict(r): return dict(r) if r else None

def can_admin(user): return str(user.get('role','')).lower() in ROLE_ADMIN

def slugify(v):
    v=(v or '').strip().lower()
    v=re.sub(r'[^a-z0-9]+','-',v).strip('-')
    return v or secrets.token_hex(4)

def save_data_url(data_url, folder='payment'):
    if not data_url: return ''
    m=re.match(r'data:image/(png|jpeg|jpg|webp);base64,(.+)', data_url, re.I)
    if not m: return data_url if str(data_url).startswith('/uploads/') else ''
    ext='jpg' if m.group(1).lower()=='jpeg' else m.group(1).lower()
    raw=base64.b64decode(m.group(2))
    if len(raw)>4*1024*1024: raise ValueError('Ukuran gambar maksimal 4MB.')
    d=UPLOADS/folder; d.mkdir(parents=True, exist_ok=True)
    name=f'{int(time.time())}_{secrets.token_hex(6)}.{ext}'
    (d/name).write_bytes(raw)
    return f'/uploads/{folder}/{name}'

def init_db():
    DB.parent.mkdir(exist_ok=True)
    UPLOADS.mkdir(exist_ok=True)
    con=db(); cur=con.cursor()
    cur.executescript('''
    CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'Staff',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS services(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      short_name TEXT,
      icon TEXT DEFAULT '💎',
      badge TEXT DEFAULT 'Layanan',
      description TEXT NOT NULL,
      delivery TEXT NOT NULL,
      button_style TEXT DEFAULT 'mint',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      type_label TEXT NOT NULL,
      robux INTEGER NOT NULL,
      price INTEGER NOT NULL,
      username TEXT NOT NULL,
      discord TEXT NOT NULL,
      proof TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Menunggu Konfirmasi',
      delivery TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS packages(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      robux INTEGER NOT NULL,
      price INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, robux)
    );
    CREATE TABLE IF NOT EXISTS payments(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_type TEXT NOT NULL DEFAULT 'bank',
      name TEXT NOT NULL,
      account_name TEXT,
      account_number TEXT,
      note TEXT,
      logo TEXT,
      qris_image TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_notes(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL,
      note TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS status_logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT NOT NULL,
      user_id INTEGER,
      user_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity_logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      detail TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    ''')
    order_cols=[r['name'] for r in cur.execute('PRAGMA table_info(orders)').fetchall()]
    if 'roblox_user_id' not in order_cols:
        cur.execute("ALTER TABLE orders ADD COLUMN roblox_user_id TEXT DEFAULT ''")
    if 'roblox_avatar_url' not in order_cols:
        cur.execute("ALTER TABLE orders ADD COLUMN roblox_avatar_url TEXT DEFAULT ''")

    cols=[r['name'] for r in cur.execute('PRAGMA table_info(payments)').fetchall()]
    if 'payment_type' not in cols:
        cur.execute("ALTER TABLE payments ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'bank'")
        cur.execute("UPDATE payments SET payment_type=CASE WHEN lower(name) LIKE '%qris%' THEN 'qris' WHEN lower(name) LIKE '%dana%' OR lower(name) LIKE '%ovo%' OR lower(name) LIKE '%gopay%' OR lower(name) LIKE '%shopee%' OR lower(name) LIKE '%linkaja%' THEN 'wallet' ELSE 'bank' END")

    if cur.execute('SELECT COUNT(*) c FROM users').fetchone()['c']==0:
        cur.execute('INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?)',('Owner KokoKrunch','admin',hash_pw('admin'),'Owner'))
    if cur.execute('SELECT COUNT(*) c FROM services').fetchone()['c']==0:
        services=[
          ('robux','Robux (Estimasi 5 Hari)','Robux 5 Hari','💎','Hemat','Metode resmi lewat Group Payout. Harga lebih hemat, cocok buat kamu yang tidak buru-buru.','Maks. 5 hari kerja','mint',1,1),
          ('gamepass','Robux via Gamepass (Instan)','Gamepass Instan','🚀','Instan','Robux masuk cepat lewat pembelian Gamepass langsung dari akunmu sendiri.','Instan, maks. 30 menit','gold',1,2)
        ]
        cur.executemany('INSERT INTO services(slug,name,short_name,icon,badge,description,delivery,button_style,active,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)', services)
    if cur.execute('SELECT COUNT(*) c FROM packages').fetchone()['c']==0:
        defaults=[('robux',100,14200),('robux',200,28400),('robux',400,56800),('robux',800,113600),('robux',1700,241400),('robux',4500,639000),('gamepass',100,16800),('gamepass',200,33600),('gamepass',400,67200),('gamepass',800,134400),('gamepass',1700,285600),('gamepass',4500,756000)]
        cur.executemany('INSERT OR IGNORE INTO packages(type,robux,price,active) VALUES(?,?,?,1)', defaults)
    if cur.execute('SELECT COUNT(*) c FROM payments').fetchone()['c']==0:
        payments=[('bank','Bank BCA','KokoKrunch','1234567890','Transfer sesuai total pesanan.','','',1,1),('wallet','DANA','KokoKrunch','0812-3456-7890','Kirim bukti pembayaran setelah transfer.','','',1,2),('qris','QRIS','KokoKrunch','','Scan QRIS jika tersedia.','','',1,3)]
        cur.executemany('INSERT INTO payments(payment_type,name,account_name,account_number,note,logo,qris_image,active,sort_order) VALUES(?,?,?,?,?,?,?,?,?)', payments)
    con.commit(); con.close()

def stats(con):
    total=con.execute('SELECT COUNT(*) c FROM orders').fetchone()['c']
    pending=con.execute("SELECT COUNT(*) c FROM orders WHERE status='Menunggu Konfirmasi'").fetchone()['c']
    fin=con.execute("SELECT COUNT(*) c, COALESCE(SUM(robux),0) robux, COALESCE(SUM(price),0) rev FROM orders WHERE status='Terkirim'").fetchone()
    return {'total_orders':total,'pending':pending,'finished_orders':fin['c'],'robux_sold':fin['robux'],'revenue':fin['rev'],'clients':fin['c']}

def log_activity(con, user, action, detail=''):
    try:
        con.execute('INSERT INTO activity_logs(user_id,user_name,action,detail) VALUES(?,?,?,?)',(user.get('id') if user else None, user.get('name') if user else 'System', action, detail))
    except Exception:
        pass

def make_code(con):
    chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    while True:
        code='KK-'+''.join(secrets.choice(chars) for _ in range(6))
        if not con.execute('SELECT 1 FROM orders WHERE code=?',(code,)).fetchone(): return code


def roblox_lookup(username):
    username=(username or '').strip()
    if not re.match(r'^[A-Za-z0-9_]{3,20}$', username):
        return {'found':False,'error':'Format username Roblox tidak valid.'}
    try:
        payload=json.dumps({'usernames':[username], 'excludeBannedUsers':False}).encode('utf-8')
        req=urlrequest.Request('https://users.roblox.com/v1/usernames/users', data=payload, headers={'Content-Type':'application/json','User-Agent':'KokoKrunchStudio/1.0'}, method='POST')
        with urlrequest.urlopen(req, timeout=8) as resp:
            data=json.loads(resp.read().decode('utf-8'))
        users=data.get('data') or []
        if not users:
            return {'found':False,'error':'Username Roblox tidak ditemukan.'}
        u=users[0]
        user_id=str(u.get('id',''))
        avatar=''
        if user_id:
            thumb_url=f'https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={user_id}&size=150x150&format=Png&isCircular=true'
            req2=urlrequest.Request(thumb_url, headers={'User-Agent':'KokoKrunchStudio/1.0'})
            with urlrequest.urlopen(req2, timeout=8) as resp:
                t=json.loads(resp.read().decode('utf-8'))
            rows=t.get('data') or []
            if rows:
                avatar=rows[0].get('imageUrl') or ''
        return {'found':True,'id':user_id,'username':u.get('name') or username,'displayName':u.get('displayName') or '', 'avatar':avatar}
    except Exception as e:
        return {'found':False,'error':'Gagal menghubungi Roblox. Coba cek lagi username atau lanjutkan manual.'}

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def end_headers(self):
        self.send_header('Cache-Control','no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma','no-cache'); self.send_header('Expires','0')
        super().end_headers()
    def send_json(self, data, code=200):
        body=json.dumps(data).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body)
    def body(self):
        n=int(self.headers.get('Content-Length',0));
        if n<=0: return {}
        return json.loads(self.rfile.read(n) or b'{}')
    def user(self):
        auth=self.headers.get('Authorization','')
        if not auth.startswith('Bearer '): return None
        rec=TOKENS.get(auth.split(' ',1)[1])
        if not rec or rec['exp']<time.time(): return None
        return rec['user']
    def need_user(self):
        u=self.user()
        if not u: self.send_json({'error':'Sesi login tidak valid. Silakan login ulang.'},401); return None
        return u
    def need_admin(self):
        u=self.need_user()
        if not u: return None
        if not can_admin(u): self.send_json({'error':'Akses ditolak. Menu ini hanya untuk Admin.'},403); return None
        return u

    def do_POST(self):
        if self.path=='/api/login':
            data=self.body(); con=db(); u=con.execute('SELECT * FROM users WHERE lower(username)=lower(?)',(data.get('username',''),)).fetchone(); con.close()
            if not u or not verify(data.get('password',''),u['password_hash']): return self.send_json({'error':'Username atau password salah.'},401)
            token=secrets.token_urlsafe(32); TOKENS[token]={'user':{'id':u['id'],'name':u['name'],'username':u['username'],'role':u['role']},'exp':time.time()+86400}
            return self.send_json({'token':token})
        if self.path=='/api/orders':
            data=self.body(); typ=data.get('type')
            try: robux=int(data.get('robux',0))
            except: robux=0
            if robux<=0 or not data.get('username') or not data.get('discord') or not data.get('proof'): return self.send_json({'error':'Data pesanan belum lengkap.'},400)
            con=db(); svc=con.execute('SELECT * FROM services WHERE slug=? AND active=1',(typ,)).fetchone()
            if not svc: con.close(); return self.send_json({'error':'Layanan tidak tersedia.'},400)
            p=con.execute('SELECT price FROM packages WHERE type=? AND robux=? AND active=1',(typ,robux)).fetchone()
            if not p: con.close(); return self.send_json({'error':'Nominal Robux tidak tersedia. Silakan pilih nominal yang tersedia.'},400)
            code=make_code(con)
            con.execute('INSERT INTO orders(code,type,type_label,robux,price,username,discord,proof,status,delivery,roblox_user_id,roblox_avatar_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(code,typ,svc['name'],robux,int(p['price']),data['username'],data['discord'],data['proof'],'Menunggu Konfirmasi',svc['delivery'],str(data.get('roblox_user_id','') or ''),str(data.get('roblox_avatar_url','') or '')))
            con.commit(); con.close(); return self.send_json({'code':code})
        if self.path=='/api/team':
            if not self.need_admin(): return
            data=self.body()
            if not all(data.get(k) for k in ['name','username','password']): return self.send_json({'error':'Data anggota tim belum lengkap.'},400)
            try:
                con=db(); con.execute('INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?)',(data['name'],data['username'],hash_pw(data['password']),data.get('role','Staff'))); con.commit(); con.close(); return self.send_json({'ok':True})
            except sqlite3.IntegrityError: return self.send_json({'error':'Username sudah dipakai.'},400)
        if self.path=='/api/packages':
            if not self.need_admin(): return
            data=self.body(); typ=data.get('type')
            try: robux=int(data.get('robux',0)); price=int(data.get('price',0))
            except: return self.send_json({'error':'Nominal Robux dan harga harus angka.'},400)
            con=db(); svc=con.execute('SELECT 1 FROM services WHERE slug=?',(typ,)).fetchone()
            if not svc: con.close(); return self.send_json({'error':'Layanan tidak valid.'},400)
            if robux<=0 or price<=0: con.close(); return self.send_json({'error':'Nominal Robux dan harga wajib lebih dari 0.'},400)
            try:
                con.execute('INSERT INTO packages(type,robux,price,active) VALUES(?,?,?,?)',(typ,robux,price,1 if data.get('active',True) else 0)); con.commit(); con.close(); return self.send_json({'ok':True})
            except sqlite3.IntegrityError: con.close(); return self.send_json({'error':'Nominal tersebut sudah ada pada layanan ini.'},400)
        if self.path=='/api/services':
            if not self.need_admin(): return
            data=self.body(); name=data.get('name','').strip(); slug=slugify(data.get('slug') or name)
            if not name: return self.send_json({'error':'Nama layanan wajib diisi.'},400)
            con=db()
            try:
                con.execute('INSERT INTO services(slug,name,short_name,icon,badge,description,delivery,button_style,active,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?)',(slug,name,data.get('short_name') or name,data.get('icon') or '💎',data.get('badge') or 'Layanan',data.get('description') or '-',data.get('delivery') or '-',data.get('button_style') or 'mint',1 if data.get('active',True) else 0,int(data.get('sort_order') or 1)))
                con.commit(); con.close(); return self.send_json({'ok':True})
            except sqlite3.IntegrityError: con.close(); return self.send_json({'error':'Slug layanan sudah dipakai.'},400)
        if self.path=='/api/payments':
            if not self.need_admin(): return
            data=self.body()
            ptype=(data.get('payment_type') or 'bank').lower()
            if ptype not in ['bank','wallet','qris']: return self.send_json({'error':'Jenis pembayaran tidak valid.'},400)
            if not data.get('name'): return self.send_json({'error':'Nama metode pembayaran wajib diisi.'},400)
            if ptype!='qris' and not data.get('account_number'): return self.send_json({'error':'Nomor rekening/HP wajib diisi.'},400)
            try: qris=save_data_url(data.get('qris_image',''), 'payment')
            except ValueError as e: return self.send_json({'error':str(e)},400)
            con=db(); con.execute('INSERT INTO payments(payment_type,name,account_name,account_number,note,logo,qris_image,active,sort_order) VALUES(?,?,?,?,?,?,?,?,?)',(ptype,data.get('name'),data.get('account_name',''),data.get('account_number',''),data.get('note',''),data.get('logo',''),qris,1 if data.get('active',True) else 0,int(data.get('sort_order') or 1))); con.commit(); con.close(); return self.send_json({'ok':True})
        m=re.match(r'/api/orders/([^/]+)/notes$', self.path)
        if m:
            u=self.need_user()
            if not u: return
            data=self.body(); note=(data.get('note') or '').strip(); code=unquote(m.group(1)).upper()
            if not note: return self.send_json({'error':'Catatan tidak boleh kosong.'},400)
            con=db(); exists=con.execute('SELECT 1 FROM orders WHERE code=?',(code,)).fetchone()
            if not exists: con.close(); return self.send_json({'error':'Pesanan tidak ditemukan.'},404)
            con.execute('INSERT INTO order_notes(order_code,note,user_id,user_name) VALUES(?,?,?,?)',(code,note,u['id'],u['name']))
            log_activity(con,u,'Tambah Catatan',f'{code}: {note[:80]}')
            con.commit(); con.close(); return self.send_json({'ok':True})
        if self.path=='/api/change-password':
            u=self.need_user()
            if not u: return
            data=self.body(); current=data.get('current_password',''); newpw=data.get('new_password','')
            if len(newpw)<6: return self.send_json({'error':'Password baru minimal 6 karakter.'},400)
            con=db(); row=con.execute('SELECT password_hash FROM users WHERE id=?',(u['id'],)).fetchone()
            if not row or not verify(current,row['password_hash']): con.close(); return self.send_json({'error':'Password lama salah.'},400)
            con.execute('UPDATE users SET password_hash=? WHERE id=?',(hash_pw(newpw),u['id']))
            log_activity(con,u,'Ubah Password','Mengubah password sendiri')
            con.commit(); con.close(); return self.send_json({'ok':True})
        return self.send_json({'error':'Not found'},404)

    def do_PUT(self):
        m=re.match(r'/api/orders/([^/]+)/status$',self.path)
        if m:
            u=self.need_user()
            if not u: return
            data=self.body(); status=data.get('status')
            code=unquote(m.group(1)).upper()
            if status not in ['Menunggu Konfirmasi','Diproses','Terkirim','Dibatalkan']: return self.send_json({'error':'Status tidak valid.'},400)
            con=db(); old=con.execute('SELECT status FROM orders WHERE code=?',(code,)).fetchone()
            if not old: con.close(); return self.send_json({'error':'Pesanan tidak ditemukan.'},404)
            con.execute('UPDATE orders SET status=? WHERE code=?',(status,code))
            if old['status']!=status:
                con.execute('INSERT INTO status_logs(order_code,old_status,new_status,user_id,user_name) VALUES(?,?,?,?,?)',(code,old['status'],status,u['id'],u['name']))
                log_activity(con,u,'Ubah Status',f'{code}: {old["status"]} → {status}')
            con.commit(); con.close(); return self.send_json({'ok':True})
        m=re.match(r'/api/team/(\d+)$',self.path)
        if m:
            u=self.need_admin()
            if not u: return
            data=self.body(); user_id=int(m.group(1))
            if not data.get('name') or not data.get('username') or not data.get('role'): return self.send_json({'error':'Nama, username, dan role wajib diisi.'},400)
            con=db()
            try:
                if data.get('password'): con.execute('UPDATE users SET name=?, username=?, password_hash=?, role=? WHERE id=?',(data['name'],data['username'],hash_pw(data['password']),data['role'],user_id))
                else: con.execute('UPDATE users SET name=?, username=?, role=? WHERE id=?',(data['name'],data['username'],data['role'],user_id))
                con.commit(); con.close(); return self.send_json({'ok':True})
            except sqlite3.IntegrityError: con.close(); return self.send_json({'error':'Username sudah dipakai.'},400)
        m=re.match(r'/api/packages/(\d+)$',self.path)
        if m:
            if not self.need_admin(): return
            data=self.body();
            try: robux=int(data.get('robux',0)); price=int(data.get('price',0))
            except: return self.send_json({'error':'Nominal Robux dan harga harus angka.'},400)
            con=db(); svc=con.execute('SELECT 1 FROM services WHERE slug=?',(data.get('type'),)).fetchone()
            if not svc: con.close(); return self.send_json({'error':'Layanan tidak valid.'},400)
            try:
                con.execute('UPDATE packages SET type=?, robux=?, price=?, active=? WHERE id=?',(data.get('type'),robux,price,1 if data.get('active') else 0,int(m.group(1))))
                con.commit(); con.close(); return self.send_json({'ok':True})
            except sqlite3.IntegrityError: con.close(); return self.send_json({'error':'Nominal tersebut sudah ada pada layanan ini.'},400)
        m=re.match(r'/api/services/(\d+)$',self.path)
        if m:
            if not self.need_admin(): return
            data=self.body(); name=data.get('name','').strip()
            if not name: return self.send_json({'error':'Nama layanan wajib diisi.'},400)
            con=db()
            try:
                con.execute('UPDATE services SET name=?, short_name=?, icon=?, badge=?, description=?, delivery=?, button_style=?, active=?, sort_order=? WHERE id=?',(name,data.get('short_name') or name,data.get('icon') or '💎',data.get('badge') or 'Layanan',data.get('description') or '-',data.get('delivery') or '-',data.get('button_style') or 'mint',1 if data.get('active') else 0,int(data.get('sort_order') or 1),int(m.group(1))))
                con.commit(); con.close(); return self.send_json({'ok':True})
            except sqlite3.IntegrityError: con.close(); return self.send_json({'error':'Gagal menyimpan layanan.'},400)
        m=re.match(r'/api/payments/(\d+)$',self.path)
        if m:
            if not self.need_admin(): return
            data=self.body()
            ptype=(data.get('payment_type') or 'bank').lower()
            if ptype not in ['bank','wallet','qris']: return self.send_json({'error':'Jenis pembayaran tidak valid.'},400)
            if not data.get('name'): return self.send_json({'error':'Nama metode pembayaran wajib diisi.'},400)
            if ptype!='qris' and not data.get('account_number'): return self.send_json({'error':'Nomor rekening/HP wajib diisi.'},400)
            con=db(); old=con.execute('SELECT qris_image FROM payments WHERE id=?',(int(m.group(1)),)).fetchone()
            try: qris=save_data_url(data.get('qris_image',''), 'payment') or (old['qris_image'] if old else '')
            except ValueError as e: con.close(); return self.send_json({'error':str(e)},400)
            con.execute('UPDATE payments SET payment_type=?, name=?, account_name=?, account_number=?, note=?, logo=?, qris_image=?, active=?, sort_order=? WHERE id=?',(ptype,data.get('name'),data.get('account_name',''),data.get('account_number',''),data.get('note',''),data.get('logo',''),qris,1 if data.get('active') else 0,int(data.get('sort_order') or 1),int(m.group(1))))
            con.commit(); con.close(); return self.send_json({'ok':True})
        return self.send_json({'error':'Not found'},404)

    def do_DELETE(self):
        m=re.match(r'/api/team/(\d+)$',self.path)
        if m:
            u=self.need_admin()
            if not u: return
            user_id=int(m.group(1))
            if user_id==u['id']: return self.send_json({'error':'Akun yang sedang login tidak boleh dihapus.'},400)
            con=db(); con.execute('DELETE FROM users WHERE id=?',(user_id,)); con.commit(); con.close(); return self.send_json({'ok':True})
        m=re.match(r'/api/packages/(\d+)$',self.path)
        if m:
            if not self.need_admin(): return
            con=db(); con.execute('DELETE FROM packages WHERE id=?',(int(m.group(1)),)); con.commit(); con.close(); return self.send_json({'ok':True})
        m=re.match(r'/api/services/(\d+)$',self.path)
        if m:
            if not self.need_admin(): return
            con=db(); svc=con.execute('SELECT slug FROM services WHERE id=?',(int(m.group(1)),)).fetchone()
            if svc: con.execute('DELETE FROM packages WHERE type=?',(svc['slug'],))
            con.execute('DELETE FROM services WHERE id=?',(int(m.group(1)),)); con.commit(); con.close(); return self.send_json({'ok':True})
        m=re.match(r'/api/payments/(\d+)$',self.path)
        if m:
            if not self.need_admin(): return
            con=db(); con.execute('DELETE FROM payments WHERE id=?',(int(m.group(1)),)); con.commit(); con.close(); return self.send_json({'ok':True})
        return self.send_json({'error':'Not found'},404)

    def do_GET(self):
        parsed=urlparse(self.path)
        if parsed.path=='/api/roblox/lookup':
            username=(parse_qs(parsed.query).get('username') or [''])[0]
            return self.send_json(roblox_lookup(username))
        if parsed.path=='/api/public/success-popups':
            try:
                limit=int((parse_qs(parsed.query).get('limit') or ['8'])[0])
            except Exception:
                limit=8
            limit=max(1,min(limit,20))
            con=db()
            rows=[rowdict(r) for r in con.execute('SELECT code,type_label,robux,username,roblox_avatar_url,created_at FROM orders WHERE status=? ORDER BY id DESC LIMIT ?',('Terkirim',limit)).fetchall()]
            con.close()
            return self.send_json({'orders':rows})
        if self.path=='/api/stats':
            con=db(); s=stats(con); con.close(); return self.send_json(s)
        if self.path=='/api/services':
            con=db(); rows=[rowdict(r) for r in con.execute('SELECT * FROM services ORDER BY sort_order,id').fetchall()]; con.close(); return self.send_json({'services':rows})
        if self.path=='/api/payments':
            con=db(); rows=[rowdict(r) for r in con.execute('SELECT * FROM payments ORDER BY sort_order,id').fetchall()]; con.close(); return self.send_json({'payments':rows})
        if self.path=='/api/packages':
            con=db(); rows=[rowdict(r) for r in con.execute('SELECT * FROM packages ORDER BY type, robux').fetchall()]; con.close(); return self.send_json({'packages':rows})
        if self.path=='/api/me':
            u=self.need_user(); return None if not u else self.send_json(u)
        if self.path=='/api/dashboard':
            u=self.need_user()
            if not u: return
            con=db(); orders=[rowdict(r) for r in con.execute('SELECT * FROM orders ORDER BY id DESC').fetchall()]
            notes=[rowdict(r) for r in con.execute('SELECT * FROM order_notes ORDER BY id DESC LIMIT 300').fetchall()]
            status_logs=[rowdict(r) for r in con.execute('SELECT * FROM status_logs ORDER BY id DESC LIMIT 300').fetchall()]
            activity=[rowdict(r) for r in con.execute('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 300').fetchall()]
            data={'orders':orders,'stats':stats(con),'can_admin':can_admin(u),'team':[],'packages':[],'services':[],'payments':[],'notes':notes,'status_logs':status_logs,'activity_logs':activity}
            if can_admin(u):
                data['team']=[{k:r[k] for k in ['id','name','username','role','created_at']} for r in con.execute('SELECT * FROM users ORDER BY id ASC').fetchall()]
                data['packages']=[rowdict(r) for r in con.execute('SELECT * FROM packages ORDER BY type, robux').fetchall()]
                data['services']=[rowdict(r) for r in con.execute('SELECT * FROM services ORDER BY sort_order,id').fetchall()]
                data['payments']=[rowdict(r) for r in con.execute('SELECT * FROM payments ORDER BY sort_order,id').fetchall()]
            con.close(); return self.send_json(data)
        if self.path.startswith('/api/export/orders'):
            u=self.need_user()
            if not u: return
            con=db(); rows=con.execute('SELECT code,created_at,type_label,robux,price,username,discord,status,delivery FROM orders ORDER BY id DESC').fetchall(); con.close()
            out=io.StringIO(); w=csv.writer(out)
            w.writerow(['Kode','Tanggal','Layanan','Robux','Total','Username Roblox','Discord','Status','Estimasi'])
            for r in rows: w.writerow([r['code'],r['created_at'],r['type_label'],r['robux'],r['price'],r['username'],r['discord'],r['status'],r['delivery']])
            body=out.getvalue().encode('utf-8-sig'); self.send_response(200); self.send_header('Content-Type','text/csv; charset=utf-8'); self.send_header('Content-Disposition','attachment; filename="laporan-pesanan-kokokrunch.csv"'); self.send_header('Content-Length',str(len(body))); self.end_headers(); self.wfile.write(body); return
        m=re.match(r'/api/orders/([^/]+)$',self.path)
        if m:
            con=db(); r=con.execute('SELECT code,type,type_label,robux,price,username,discord,status,delivery,created_at,roblox_user_id,roblox_avatar_url FROM orders WHERE code=?',(unquote(m.group(1)).upper(),)).fetchone(); con.close(); return self.send_json(rowdict(r) if r else {'error':'Kode pesanan tidak ditemukan.'}, 200 if r else 404)
        return super().do_GET()

if __name__=='__main__':
    init_db(); print('KokoKrunch CMS v2.1: http://localhost:8000'); print('Admin awal: admin / admin'); ThreadingHTTPServer(('0.0.0.0',8000),Handler).serve_forever()

import os

PORT = int(os.environ.get("PORT", 8000))
server = HTTPServer(("0.0.0.0", PORT), Handler)
print(f"KokoKrunch server running on port {PORT}")
server.serve_forever()
