const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'GANTI_SECRET_JWT_YANG_PANJANG_DAN_ACAK';
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'GANTI_SECRET_JWT_YANG_PANJANG_DAN_ACAK') throw new Error('JWT_SECRET wajib diatur pada production.');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const root = __dirname;
const dataDir = path.join(root, 'data');
fs.mkdirSync(dataDir, { recursive: true });

// Supabase is the production source of truth. Local JSON is retained only for localhost/offline fallback.
const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const SUPABASE_MEDIA_BUCKET = String(process.env.SUPABASE_MEDIA_BUCKET || 'kader-poto');
const CLOUD = !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
if (process.env.NODE_ENV === 'production' && !CLOUD) throw new Error('Supabase belum dikonfigurasi. Isi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, dan SUPABASE_MEDIA_BUCKET di Vercel.');

const localFiles = {
  applicants: path.join(dataDir, 'applicants.json'),
  kader: path.join(dataDir, 'kader.json'),
  rejected: path.join(dataDir, 'rejected.json'),
  cms: path.join(dataDir, 'cms.json'),
  media: path.join(dataDir, 'media.json')
};
for (const f of Object.values(localFiles)) if (!fs.existsSync(f)) fs.writeFileSync(f, f.endsWith('cms.json') ? JSON.stringify({site:{},berita:[],galeri:[],agenda:[],tentang:{},struktur:[],pages:{}},null,2) : '[]');

function localRead(file, fallback=[]) { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return fallback; } }
function localWrite(file, value) { const tmp=file+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(value,null,2),'utf8'); fs.renameSync(tmp,file); }

async function supa(pathname, options={}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, { ...options, headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', ...(options.headers||{}) } });
  if (!r.ok) { const t=await r.text(); throw new Error(`Supabase Database error: ${t.slice(0,400)}`); }
  return r.status===204 ? null : r.json();
}
async function cloudGet(key, fallback) {
  if (!CLOUD) return localRead(localFiles[key], fallback);
  const rows = await supa(`app_state?key=eq.${encodeURIComponent(key)}&select=value`);
  if (rows[0]?.value !== undefined) return rows[0].value;
  const local = localRead(localFiles[key], fallback);
  const hasData = Array.isArray(local) ? local.length > 0 : Object.keys(local || {}).length > 0;
  if (hasData) { await cloudSet(key, local); return local; }
  return fallback;
}
async function cloudSet(key, value) {
  if (!CLOUD) { localWrite(localFiles[key], value); return value; }
  await supa('app_state?on_conflict=key', {method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=minimal'}, body:JSON.stringify({key,value,updated_at:new Date().toISOString()})});
  return value;
}
const db = {
  applicants: ()=>cloudGet('applicants', []), kader:()=>cloudGet('kader', []), rejected:()=>cloudGet('rejected', []), media:()=>cloudGet('media', []), cms:()=>cloudGet('cms', {site:{},berita:[],galeri:[],agenda:[],tentang:{},struktur:[],pages:{}}),
  setApplicants:v=>cloudSet('applicants',v), setKader:v=>cloudSet('kader',v), setRejected:v=>cloudSet('rejected',v), setMedia:v=>cloudSet('media',v), setCms:v=>cloudSet('cms',v)
};

app.disable('x-powered-by');
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');next();});
app.use(express.json({limit:'1mb'})); app.use(cookieParser()); app.use(express.urlencoded({extended:true}));
app.use(express.static(root));

const upload = multer({ storage: multer.memoryStorage(), limits:{fileSize:5*1024*1024,files:1}, fileFilter:(_,f,cb)=>{const ok=['image/jpeg','image/png','image/webp'].includes(f.mimetype);cb(ok?null:new Error('Foto harus JPG, PNG, atau WEBP.'),ok);} });
async function storageUpload(file, folder='cms') {
  if (!CLOUD) {
    if (process.env.NODE_ENV==='production') throw new Error('Supabase Storage belum dikonfigurasi.');
    const dir=path.join(root,'uploads'); fs.mkdirSync(dir,{recursive:true}); const ext=path.extname(file.originalname||'').toLowerCase()||'.jpg'; const name=`${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`; fs.writeFileSync(path.join(dir,name),file.buffer); return `/uploads/${name}`;
  }
  const ext=path.extname(file.originalname||'').toLowerCase()||'.jpg'; const objectPath=`${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const r=await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${objectPath}`,{method:'POST',headers:{Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,apikey:SUPABASE_SERVICE_ROLE_KEY,'Content-Type':file.mimetype,'x-upsert':'false'},body:file.buffer});
  if(!r.ok) throw new Error(`Supabase Storage upload gagal: ${(await r.text()).slice(0,300)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${objectPath}`;
}
async function storageDelete(url){
  if(!CLOUD || !url?.includes('/storage/v1/object/')) return;
  const marker=`/storage/v1/object/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/`; const i=url.indexOf(marker); if(i<0) return;
  const objectPath=url.slice(i+marker.length).replace(/^public\//,'');
  await fetch(`${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_MEDIA_BUCKET)}/${objectPath}`,{method:'DELETE',headers:{Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,apikey:SUPABASE_SERVICE_ROLE_KEY}});
}

const loginLimiter=rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false});
function auth(req,res,next){const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'')||req.cookies?.hmi_admin||String(req.query.token||'');if(!token)return res.status(401).json({message:'Belum login.'});try{req.admin=jwt.verify(token,JWT_SECRET);next();}catch{return res.status(401).json({message:'Sesi admin tidak valid.'});}}
app.post('/api/auth/login',loginLimiter,(req,res)=>{const {username,password}=req.body;if(username!==ADMIN_USER||password!==ADMIN_PASSWORD)return res.status(401).json({message:'Username atau password salah.'});const token=jwt.sign({username,role:'admin'},JWT_SECRET,{expiresIn:'8h'});res.cookie('hmi_admin',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge:8*60*60*1000,path:'/'});res.json({ok:true});});
app.post('/api/auth/logout',(req,res)=>{res.clearCookie('hmi_admin',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/'});res.json({ok:true});});

function nextId(arr){return arr.length?Math.max(...arr.map(x=>Number(x.id)||0))+1:1;}
function regNo(arr){const y=new Date().getFullYear(),p=`HMI-UNPI-${y}-`;const nums=arr.map(a=>String(a.registration_no||'')).filter(x=>x.startsWith(p)).map(x=>Number(x.slice(p.length))).filter(Number.isFinite);return p+String((nums.length?Math.max(...nums):0)+1).padStart(4,'0');}

app.post('/api/pendaftaran',upload.single('photo'),async(req,res)=>{try{const {nama,wa,prodi,angkatan,alasan}=req.body;if(!nama||!wa||!prodi||!angkatan||!alasan)return res.status(400).json({message:'Semua data wajib diisi.'});const arr=await db.applicants();const now=new Date().toISOString();const photo=req.file?await storageUpload(req.file,'pendaftar'):null;const a={id:nextId(arr),registration_no:regNo(arr),nama:String(nama).trim(),wa:String(wa).trim(),prodi:String(prodi).trim(),angkatan:String(angkatan).trim(),alasan:String(alasan).trim(),photo,status:'Menunggu',admin_note:'',created_at:now,updated_at:now};arr.push(a);await db.setApplicants(arr);res.status(201).json({message:'Pendaftaran berhasil.',registration_no:a.registration_no});}catch(e){res.status(500).json({message:e.message||'Gagal menyimpan pendaftaran.'});}});
app.get('/api/cek/:registration_no',async(req,res)=>{const a=(await db.applicants()).find(x=>x.registration_no===String(req.params.registration_no||'').trim());if(!a)return res.status(404).json({message:'Nomor pendaftaran tidak ditemukan.'});res.json({registration_no:a.registration_no,nama:a.nama,prodi:a.prodi,angkatan:a.angkatan,status:a.status,admin_note:a.admin_note||'',created_at:a.created_at,updated_at:a.updated_at});});
app.get('/api/admin/applicants',auth,async(req,res)=>{const q=String(req.query.q||'').toLowerCase(),status=String(req.query.status||'semua');const data=(await db.applicants()).filter(a=>(!q||[a.nama,a.registration_no,a.prodi,a.wa].some(v=>String(v||'').toLowerCase().includes(q)))&&(status==='semua'||a.status===status)).sort((a,b)=>Number(b.id)-Number(a.id));res.json(data);});
app.get('/api/admin/stats',auth,async(req,res)=>{const a=await db.applicants(),k=await db.kader(),r=await db.rejected();const count=s=>a.filter(x=>x.status===s).length;res.json({total:a.length,menunggu:count('Menunggu'),verifikasi:count('Verifikasi'),diterima:count('Diterima'),ditolak:count('Ditolak'),kader:k.length,riwayat_ditolak:r.length});});

async function upsertKader(a){const arr=await db.kader(),old=arr.find(k=>k.source_applicant_id===a.id||k.registration_no===a.registration_no),now=new Date().toISOString();const item=old||{id:nextId(arr),source_applicant_id:a.id,registration_no:a.registration_no,created_at:now};Object.assign(item,{nama:a.nama,nim:a.nim||'',prodi:a.prodi,angkatan:a.angkatan,tahun_masuk:a.tahun_masuk||'',status:'Aktif',kampus:a.kampus||'',fakultas:a.fakultas||'',lk1:a.lk1||'',lk2:a.lk2||'',lk3:a.lk3||'',jabatan:a.jabatan||'',periode:a.periode||'',email:a.email||'',wa:a.wa||'',keterangan:a.alasan||a.keterangan||'',foto:a.photo||'assets/kader.jpg',applicant_data:a,updated_at:now});if(!old)arr.push(item);await db.setKader(arr);}
async function upsertRejected(a){const arr=await db.rejected(),old=arr.find(r=>r.applicant_id===a.id||r.registration_no===a.registration_no),item={...(old||{}),applicant_id:a.id,registration_no:a.registration_no,nama:a.nama,wa:a.wa,prodi:a.prodi,angkatan:a.angkatan,alasan:a.alasan,photo:a.photo,admin_note:a.admin_note||'',rejected_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(old)arr[arr.findIndex(r=>r.applicant_id===a.id)]=item;else arr.push(item);await db.setRejected(arr);}
app.patch('/api/admin/applicants/:id/status',auth,async(req,res)=>{try{const allowed=['Menunggu','Verifikasi','Diterima','Ditolak'],{status,admin_note=''}=req.body;if(!allowed.includes(status))return res.status(400).json({message:'Status tidak valid.'});const arr=await db.applicants(),a=arr.find(x=>Number(x.id)===Number(req.params.id));if(!a)return res.status(404).json({message:'Pendaftar tidak ditemukan.'});a.status=status;a.admin_note=String(admin_note).slice(0,1000);a.updated_at=new Date().toISOString();await db.setApplicants(arr);if(status==='Diterima')await upsertKader(a);else await db.setKader((await db.kader()).filter(k=>Number(k.source_applicant_id)!==Number(a.id)));if(status==='Ditolak')await upsertRejected(a);else await db.setRejected((await db.rejected()).filter(r=>Number(r.applicant_id)!==Number(a.id)));res.json({message:`Status diubah menjadi ${status}.`,applicant:a});}catch(e){res.status(500).json({message:e.message});}});
app.get('/api/admin/applicants/:id',auth,async(req,res)=>{const a=(await db.applicants()).find(x=>Number(x.id)===Number(req.params.id));if(!a)return res.status(404).json({message:'Pendaftar tidak ditemukan.'});res.json(a);});

// CMS
app.get('/api/cms',async(req,res)=>res.json(await db.cms()));
function cmsCrud(key,fields,max=100){
  app.post('/api/admin/cms/'+key,auth,async(req,res)=>{const c=await db.cms(),b=req.body||{},item={id:nextId(c[key]||[])};fields.forEach(f=>item[f]=String(b[f]??'').trim().slice(0,max));(c[key]||(c[key]=[])).push(item);await db.setCms(c);res.status(201).json({message:'Data berhasil ditambahkan.',item});});
  app.put('/api/admin/cms/'+key+'/:id',auth,async(req,res)=>{const c=await db.cms(),arr=c[key]||[],item=arr.find(x=>Number(x.id)===Number(req.params.id));if(!item)return res.status(404).json({message:'Data tidak ditemukan.'});const b=req.body||{};fields.forEach(f=>item[f]=String(b[f]??'').trim().slice(0,max));await db.setCms(c);res.json({message:'Data berhasil diperbarui.',item});});
  app.delete('/api/admin/cms/'+key+'/:id',auth,async(req,res)=>{const c=await db.cms(),arr=c[key]||[],i=arr.findIndex(x=>Number(x.id)===Number(req.params.id));if(i<0)return res.status(404).json({message:'Data tidak ditemukan.'});arr.splice(i,1);await db.setCms(c);res.json({message:'Data berhasil dihapus.'});});
}
cmsCrud('berita',['judul','tanggal','kategori','ringkas','isi','gambar','status'],5000);cmsCrud('galeri',['judul','tanggal','gambar','deskripsi'],1000);cmsCrud('agenda',['tanggal','judul','lokasi','keterangan','status'],1000);cmsCrud('struktur',['nama','jabatan','periode','foto','bagian','urutan','tampil'],500);
app.put('/api/admin/cms/struktur/reorder',auth,async(req,res)=>{const ids=Array.isArray(req.body?.ids)?req.body.ids:[],c=await db.cms(),map=new Map(ids.map((id,i)=>[Number(id),i+1]));(c.struktur||[]).forEach(x=>{if(map.has(Number(x.id)))x.urutan=map.get(Number(x.id));});await db.setCms(c);res.json({message:'Urutan struktur berhasil diperbarui.'});});
app.put('/api/admin/cms/pages/:slug',auth,async(req,res)=>{const c=await db.cms();c.pages=c.pages||{};const slug=String(req.params.slug||'').replace(/[^a-z0-9-]/gi,'').slice(0,60);if(!slug)return res.status(400).json({message:'Halaman tidak valid.'});const b=req.body||{};c.pages[slug]={title:String(b.title||'').trim().slice(0,180),intro:String(b.intro||'').trim().slice(0,800),body:String(b.body||'').trim().slice(0,8000),link:String(b.link||'').trim().slice(0,1000),linkLabel:String(b.linkLabel||'Buka Materi').trim().slice(0,120)};await db.setCms(c);res.json({message:'Konten halaman tersimpan.',page:c.pages[slug]});});
app.put('/api/admin/cms/tentang',auth,async(req,res)=>{const c=await db.cms(),b=req.body||{};c.tentang={sejarah:String(b.sejarah||'').trim().slice(0,5000),visi:String(b.visi||'').trim().slice(0,2000),misi:String(b.misi||'').trim().slice(0,3000)};await db.setCms(c);res.json({message:'Profil tersimpan.',tentang:c.tentang});});
app.put('/api/admin/cms/site',auth,async(req,res)=>{const c=await db.cms(),b=req.body||{};c.site={...(c.site||{}),title:String(b.title||'').trim().slice(0,120),description:String(b.description||'').trim().slice(0,500),heroTitle:String(b.heroTitle||'').trim().slice(0,120),heroText:String(b.heroText||'').trim().slice(0,500),contactWhatsapp:String(b.contactWhatsapp||'').trim().slice(0,80),contactInstagram:String(b.contactInstagram||'').trim().slice(0,160),contactEmail:String(b.contactEmail||'').trim().slice(0,160),contactAddress:String(b.contactAddress||'').trim().slice(0,300),background:String(b.background||c.site?.background||'/background.jpg').trim().slice(0,500),footerText:String(b.footerText||c.site?.footerText||'Berproses • Berorganisasi • Berkontribusi').trim().slice(0,300),copyright:String(b.copyright||c.site?.copyright||'HMI Komisariat UNPI').trim().slice(0,200)};await db.setCms(c);res.json({message:'Pengaturan website tersimpan.',site:c.site});});
app.put('/api/admin/cms/home-text',auth,async(req,res)=>{const c=await db.cms(),b=req.body||{},s=c.site||{};c.site={...s,heroTitle:String(b.heroTitle??s.heroTitle??'').trim().slice(0,120),heroText:String(b.heroText??s.heroText??'').trim().slice(0,500),homeWelcomeTitle:String(b.homeWelcomeTitle??s.homeWelcomeTitle??'Tempat Berproses dan Bertumbuh').trim().slice(0,180),homeWelcomeText:String(b.homeWelcomeText??s.homeWelcomeText??'').trim().slice(0,1200),homeQuote:String(b.homeQuote??s.homeQuote??'“Yakin Usaha Sampai”').trim().slice(0,180),homeQuoteText:String(b.homeQuoteText??s.homeQuoteText??'').trim().slice(0,500)};await db.setCms(c);res.json({message:'Konten beranda tersimpan.',site:c.site});});

// Media CMS: metadata in Supabase DB, binary in Supabase Storage.
app.post('/api/admin/cms/upload',auth,upload.single('image'),async(req,res)=>{try{if(!req.file)return res.status(400).json({message:'File gambar wajib dipilih.'});const url=await storageUpload(req.file,'cms'),arr=await db.media(),item={id:nextId(arr),name:path.basename(url),url,originalName:String(req.file.originalname||'').slice(0,180),mime:req.file.mimetype,size:req.file.size,storage:CLOUD?'supabase':'local',created_at:new Date().toISOString()};arr.push(item);await db.setMedia(arr);res.status(201).json({message:'Foto berhasil diupload.',item,url:item.url});}catch(e){res.status(500).json({message:e.message});}});
app.get('/api/admin/cms/media',auth,async(req,res)=>res.json((await db.media()).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))));
app.delete('/api/admin/cms/media/:id',auth,async(req,res)=>{const arr=await db.media(),i=arr.findIndex(x=>Number(x.id)===Number(req.params.id));if(i<0)return res.status(404).json({message:'Media tidak ditemukan.'});const item=arr[i];await storageDelete(item.url);arr.splice(i,1);await db.setMedia(arr);res.json({message:'Media berhasil dihapus.'});});

// Public kader: only non-sensitive fields.
app.get('/api/kader',async(req,res)=>{const arr=await db.kader();res.json(arr.map(k=>({id:k.id,nama:k.nama,angkatan:k.angkatan,jabatan:k.jabatan||'',status:k.status,foto:k.foto||'assets/kader.jpg'})).sort((a,b)=>String(a.nama).localeCompare(String(b.nama),'id')));});
app.get('/api/admin/kader',auth,async(req,res)=>{const q=String(req.query.q||'').toLowerCase().trim(),status=String(req.query.status||'semua'),angkatan=String(req.query.angkatan||'semua');res.json((await db.kader()).filter(k=>{const text=[k.nama,k.nim,k.prodi,k.kampus,k.fakultas,k.angkatan].map(v=>String(v||'').toLowerCase()).join(' ');return(!q||text.includes(q))&&(status==='semua'||k.status===status)&&(angkatan==='semua'||String(k.angkatan||'')===angkatan)}).sort((a,b)=>Number(b.id)-Number(a.id)));});
app.get('/api/admin/kader/:id',auth,async(req,res)=>{const k=(await db.kader()).find(k=>Number(k.id)===Number(req.params.id));if(!k)return res.status(404).json({message:'Data kader tidak ditemukan.'});res.json(k);});
app.post('/api/admin/kader',auth,async(req,res)=>{const allowed=['Aktif','Alumni','Tidak Aktif'],b=req.body||{};if(!String(b.nama||'').trim())return res.status(400).json({message:'Nama lengkap wajib diisi.'});if(!allowed.includes(b.status))return res.status(400).json({message:'Status kader tidak valid.'});const arr=await db.kader(),now=new Date().toISOString(),item={id:nextId(arr),nama:String(b.nama).trim(),nim:String(b.nim||'').trim(),prodi:String(b.prodi||'').trim(),angkatan:String(b.angkatan||'').trim(),tahun_masuk:String(b.tahun_masuk||'').trim(),status:b.status,kampus:String(b.kampus||'').trim(),fakultas:String(b.fakultas||'').trim(),lk1:String(b.lk1||'').trim(),lk2:String(b.lk2||'').trim(),lk3:String(b.lk3||'').trim(),jabatan:String(b.jabatan||'').trim(),periode:String(b.periode||'').trim(),email:String(b.email||'').trim(),wa:String(b.wa||'').trim(),keterangan:String(b.keterangan||'').trim(),foto:String(b.foto||'assets/kader.jpg'),created_at:now,updated_at:now};arr.push(item);await db.setKader(arr);res.status(201).json({message:'Data kader berhasil ditambahkan.',kader:item});});
app.put('/api/admin/kader/:id',auth,async(req,res)=>{const allowed=['Aktif','Alumni','Tidak Aktif'],b=req.body||{},arr=await db.kader(),item=arr.find(k=>Number(k.id)===Number(req.params.id));if(!item)return res.status(404).json({message:'Data kader tidak ditemukan.'});if(!String(b.nama||'').trim())return res.status(400).json({message:'Nama lengkap wajib diisi.'});if(!allowed.includes(b.status))return res.status(400).json({message:'Status kader tidak valid.'});['nama','nim','prodi','angkatan','tahun_masuk','kampus','fakultas','lk1','lk2','lk3','jabatan','periode','email','wa','keterangan','foto'].forEach(f=>{if(b[f]!==undefined)item[f]=String(b[f]||'').trim();});item.status=b.status;item.updated_at=new Date().toISOString();await db.setKader(arr);res.json({message:'Data kader berhasil diperbarui.',kader:item});});
app.delete('/api/admin/kader/:id',auth,async(req,res)=>{const arr=await db.kader(),i=arr.findIndex(k=>Number(k.id)===Number(req.params.id));if(i<0)return res.status(404).json({message:'Data kader tidak ditemukan.'});arr.splice(i,1);await db.setKader(arr);res.json({message:'Data kader berhasil dihapus.'});});
app.get('/api/admin/rejected',auth,async(req,res)=>res.json((await db.rejected()).sort((a,b)=>String(b.rejected_at).localeCompare(String(a.rejected_at)))));
app.delete('/api/admin/rejected/:id',auth,async(req,res)=>{const arr=await db.rejected(),i=arr.findIndex(r=>Number(r.applicant_id)===Number(req.params.id));if(i<0)return res.status(404).json({message:'Riwayat tidak ditemukan.'});arr.splice(i,1);await db.setRejected(arr);res.json({message:'Riwayat ditolak dihapus.'});});

function xlsEscape(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function xlsWorkbook(title,rows){const cols=rows.length?Object.keys(rows[0]):[];const h=cols.map(c=>`<Cell><Data ss:Type="String">${xlsEscape(c)}</Data></Cell>`).join('');const b=rows.map(r=>`<Row>${cols.map(c=>`<Cell><Data ss:Type="String">${xlsEscape(r[c])}</Data></Cell>`).join('')}</Row>`).join('');return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${xlsEscape(title).slice(0,31)}"><Table><Row>${h}</Row>${b}</Table></Worksheet></Workbook>`;}
app.get('/api/admin/export/applicants.xls',auth,async(req,res)=>{const status=String(req.query.status||'semua'),a=(await db.applicants()).filter(x=>status==='semua'||x.status===status).map((x,i)=>({No:i+1,Nomor_Pendaftaran:x.registration_no,Nama:x.nama,WhatsApp:x.wa,Prodi:x.prodi,Angkatan:x.angkatan,Status:x.status,Alasan:x.alasan,Catatan_Admin:x.admin_note||'',Tanggal_Daftar:x.created_at}));res.setHeader('Content-Type','application/vnd.ms-excel; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="Data_Pendaftar_HMI_UNPI.xls"');res.send(xlsWorkbook('Pendaftar',a));});
app.get('/api/admin/export/kader.xls',auth,async(req,res)=>{const a=(await db.kader()).map((k,i)=>({No:i+1,Nama:k.nama,NIM:k.nim,Prodi:k.prodi,Angkatan:k.angkatan,Status:k.status,Kampus:k.kampus,Fakultas:k.fakultas,WhatsApp:k.wa,Email:k.email,Tahun_Masuk_HMI:k.tahun_masuk,LK_I:k.lk1,LK_II:k.lk2,LK_III:k.lk3,Jabatan:k.jabatan,Periode:k.periode,Keterangan:k.keterangan}));res.setHeader('Content-Type','application/vnd.ms-excel; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="Database_Kader_HMI_UNPI.xls"');res.send(xlsWorkbook('Database Kader',a));});
app.get('/api/admin/export/rejected.xls',auth,async(req,res)=>{const a=(await db.rejected()).map((r,i)=>({No:i+1,Nomor_Pendaftaran:r.registration_no,Nama:r.nama,WhatsApp:r.wa,Prodi:r.prodi,Angkatan:r.angkatan,Alasan:r.alasan,Catatan_Admin:r.admin_note,Ditolak_Pada:r.rejected_at}));res.setHeader('Content-Type','application/vnd.ms-excel; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="Riwayat_Kader_Ditolak_HMI_UNPI.xls"');res.send(xlsWorkbook('Ditolak',a));});


// Photo/document routes used by the existing admin UI.
async function resolvePhotoUrl(record){
  const v=String(record?.photo||record?.foto||'');
  if(!v) return null;
  if(/^https?:\/\//i.test(v)) return v;
  if(v.startsWith('/uploads/')) return path.join(root,v.replace(/^\//,''));
  const local=path.join(root,v.replace(/^\//,''));
  return local;
}
app.get('/api/admin/applicants/:id/photo',auth,async(req,res)=>{const a=(await db.applicants()).find(x=>Number(x.id)===Number(req.params.id));if(!a?.photo)return res.status(404).send('Foto tidak tersedia.');if(/^https?:\/\//i.test(a.photo))return res.redirect(a.photo);const f=await resolvePhotoUrl(a);if(f&&fs.existsSync(f))return res.sendFile(f);res.status(404).send('File foto tidak ditemukan.');});
app.get('/api/admin/applicants/:id/print',auth,async(req,res)=>{const a=(await db.applicants()).find(x=>Number(x.id)===Number(req.params.id));if(!a)return res.status(404).send('Pendaftar tidak ditemukan.');const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));let photo='Tidak ada foto';if(a.photo){photo=/^https?:\/\//i.test(a.photo)?`<img src="${esc(a.photo)}" style="width:140px;height:170px;object-fit:cover;border-radius:8px">`:'Foto tersimpan di Storage';}res.type('html').send(`<!doctype html><html lang="id"><meta charset="utf-8"><title>Data Pendaftaran HMI UNPI</title><style>body{font-family:Arial;margin:35px}h1{text-align:center}table{width:100%;border-collapse:collapse}td{border:1px solid #ddd;padding:9px}td:first-child{font-weight:bold;width:30%;background:#f5f5f5}.photo{text-align:center;margin:20px}</style><h1>Data Pendaftaran Kader HMI UNPI</h1><div class="photo">${photo}</div><table><tr><td>Nomor Pendaftaran</td><td>${esc(a.registration_no)}</td></tr><tr><td>Nama</td><td>${esc(a.nama)}</td></tr><tr><td>WhatsApp</td><td>${esc(a.wa)}</td></tr><tr><td>Program Studi</td><td>${esc(a.prodi)}</td></tr><tr><td>Angkatan</td><td>${esc(a.angkatan)}</td></tr><tr><td>Alasan</td><td>${esc(a.alasan)}</td></tr><tr><td>Status</td><td>${esc(a.status)}</td></tr><tr><td>Catatan Admin</td><td>${esc(a.admin_note)}</td></tr></table><script>window.onload=()=>setTimeout(()=>window.print(),300)</script></html>`);});
app.get('/api/admin/applicants/:id/word',auth,async(req,res)=>{const a=(await db.applicants()).find(x=>Number(x.id)===Number(req.params.id));if(!a)return res.status(404).send('Pendaftar tidak ditemukan.');const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));res.setHeader('Content-Type','application/msword; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="Pendaftaran_${a.registration_no}.doc"`);res.send(`<!doctype html><html><meta charset="utf-8"><h1>Data Pendaftaran Kader HMI UNPI</h1><table border="1" cellpadding="8"><tr><td>Nomor Pendaftaran</td><td>${esc(a.registration_no)}</td></tr><tr><td>Nama</td><td>${esc(a.nama)}</td></tr><tr><td>WhatsApp</td><td>${esc(a.wa)}</td></tr><tr><td>Program Studi</td><td>${esc(a.prodi)}</td></tr><tr><td>Angkatan</td><td>${esc(a.angkatan)}</td></tr><tr><td>Alasan</td><td>${esc(a.alasan)}</td></tr><tr><td>Status</td><td>${esc(a.status)}</td></tr><tr><td>Catatan Admin</td><td>${esc(a.admin_note)}</td></tr></table></html>`);});
app.get('/api/admin/kader/:id/photo',auth,async(req,res)=>{const k=(await db.kader()).find(x=>Number(x.id)===Number(req.params.id));if(!k?.foto)return res.status(404).send('Foto tidak tersedia.');if(/^https?:\/\//i.test(k.foto))return res.redirect(k.foto);const f=await resolvePhotoUrl(k);if(f&&fs.existsSync(f))return res.download(f,path.basename(f));res.status(404).send('File foto tidak ditemukan.');});
app.get('/api/kader/:id/photo',async(req,res)=>{const k=(await db.kader()).find(x=>Number(x.id)===Number(req.params.id));if(!k?.foto)return res.status(404).send('Foto kader tidak tersedia.');if(/^https?:\/\//i.test(k.foto))return res.redirect(k.foto);const f=await resolvePhotoUrl(k);if(f&&fs.existsSync(f))return res.sendFile(f);res.status(404).send('Foto kader tidak ditemukan.');});

app.use((err,req,res,next)=>res.status(400).json({message:err.message||'Terjadi kesalahan.'}));
if(require.main===module)app.listen(PORT,()=>console.log(`HMI UNPI berjalan di http://localhost:${PORT}`));
module.exports=app;
