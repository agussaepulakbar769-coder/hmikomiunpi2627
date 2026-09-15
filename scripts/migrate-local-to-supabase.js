/*
  Migrasi data JSON lokal ke Supabase app_state.
  Jalankan setelah SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY tersedia:
  node scripts/migrate-local-to-supabase.js
*/
const fs=require('fs'),path=require('path');
const base=path.join(__dirname,'..'), data=path.join(base,'data');
const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||'');
if(!url||!key) throw new Error('Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY terlebih dahulu.');
const files={applicants:'applicants.json',kader:'kader.json',rejected:'rejected.json',media:'media.json',cms:'cms.json'};
async function main(){for(const [k,f] of Object.entries(files)){const p=path.join(data,f);if(!fs.existsSync(p))continue;const value=JSON.parse(fs.readFileSync(p,'utf8'));const r=await fetch(`${url}/rest/v1/app_state?on_conflict=key`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key:k,value,updated_at:new Date().toISOString()})});if(!r.ok)throw new Error(`${k}: ${await r.text()}`);console.log('Migrated:',k);}}
main().catch(e=>{console.error(e);process.exit(1);});
