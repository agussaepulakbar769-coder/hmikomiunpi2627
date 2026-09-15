
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");
if(menuToggle){
  menuToggle.addEventListener("click",()=>navMenu.classList.toggle("open"));
}
document.querySelectorAll(".nav-menu a").forEach(a=>{
  a.addEventListener("click",()=>navMenu.classList.remove("open"));
});
const tahun=document.getElementById("tahun");
if(tahun) tahun.textContent=new Date().getFullYear();

/* DATABASE KADER - data diambil dari server, bukan ditulis manual di kode */
const daftarKader=document.getElementById("daftarKader");
if(daftarKader){
  const cari=document.getElementById("cariKader");
  const fa=document.getElementById("filterAngkatan");
  const fs=document.getElementById("filterStatus");

  let dataKader=[];

  function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

  async function loadKader(){
    daftarKader.innerHTML="<p>Memuat data kader...</p>";
    try{
      const r=await fetch("/api/kader");
      if(!r.ok) throw new Error("Gagal mengambil data kader.");
      dataKader=await r.json();

      const angkatan=[...new Set(dataKader.map(k=>String(k.angkatan||"")).filter(Boolean))].sort();
      fa.innerHTML='<option value="semua">Semua Angkatan</option>';
      angkatan.forEach(a=>{
        const opt=document.createElement("option");
        opt.value=a; opt.textContent="Angkatan "+a; fa.appendChild(opt);
      });

      tampil();
    }catch(err){
      daftarKader.innerHTML="<p>Database kader belum dapat diakses. Pastikan server sudah dijalankan.</p>";
    }
  }

  function tampil(){
    const q=(cari.value||"").toLowerCase().trim();
    const a=fa.value, s=fs.value;
    const hasil=dataKader.filter(k=>
      String(k.nama||"").toLowerCase().includes(q) &&
      (a==="semua" || String(k.angkatan||"")===a) &&
      (s==="semua" || String(k.status||"")===s)
    );

    daftarKader.innerHTML=hasil.length ? hasil.map(k=>`
      <div class="kader-card">
        <img src="${esc(k.foto||"assets/kader.jpg")}" alt="Foto ${esc(k.nama||"kader")}" loading="lazy">
        <div>
          <h3>${esc(k.nama)}</h3>
          <p>Angkatan ${esc(k.angkatan||"-")}</p>
          <p>${esc(k.jabatan||"Jabatan belum diisi")}</p>
          <span class="status">${esc(k.status||"-")}</span>
        </div>
      </div>`).join("") : "<p>Data kader tidak ditemukan.</p>";

    document.getElementById("totalKader").textContent=dataKader.length;
    document.getElementById("aktifKader").textContent=dataKader.filter(k=>k.status==="Aktif").length;
    document.getElementById("jumlahAngkatan").textContent=new Set(dataKader.map(k=>k.angkatan).filter(Boolean)).size;
  }

  cari.addEventListener("input",tampil);
  fa.addEventListener("change",tampil);
  fs.addEventListener("change",tampil);
  loadKader();
}

/* Form pendaftaran: tersambung ke backend */
const form=document.getElementById("formDaftar");
if(form){
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const pesan=document.getElementById("pesanForm");
    pesan.textContent="Mengirim pendaftaran...";
    try{
      const r=await fetch("/api/pendaftaran",{method:"POST",body:new FormData(form)});
      const d=await r.json();
      if(!r.ok) throw new Error(d.message||"Pendaftaran gagal.");
      pesan.innerHTML=`Pendaftaran berhasil. <b>Nomor pendaftaran: ${d.registration_no}</b>. Simpan nomor ini untuk mengecek hasil penerimaan.`;
      form.reset();
    }catch(err){pesan.textContent=err.message;}
  });
}
