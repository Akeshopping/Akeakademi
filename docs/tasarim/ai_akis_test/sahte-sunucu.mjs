import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.env.REPO||process.cwd(), PORT=+process.env.PORT||8795;
const kisa='Zincir kuralı, iç içe fonksiyonların türevini alırken dıştan içe doğru çarpma yapmanı sağlar.\n\nÖrnek: **f(x) = (3x+1)²** için türev 2·(3x+1)·3 = 6(3x+1).';
const par=i=>`### Adım ${i}\n\nBu adımda **önemli bir fikir** var: ${'parça parça gelen uzun açıklama cümlesi, '.repeat(3)}sonuç olarak ${i}. adım tamamlanır.\n\n- madde bir ${i}\n- madde iki ${i}\n\n`;
const uzun=Array.from({length:26},(_,i)=>par(i+1)).join('')+'```\nx = 2\ny = x**2\n```\n\nSon cümle: bu uzun yanıtın bittiği yer.';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://x');
 if(u.pathname==='/api/hesap/ben'){res.writeHead(401,{'content-type':'application/json'});return res.end('{}')}
 if(u.pathname==='/api/ai'&&req.method==='POST'){
  let b='';for await(const c of req)b+=c;let j={};try{j=JSON.parse(b)}catch{}
  const last=(j.messages||[]).slice(-1)[0]?.content||'';const txt=/UZUN/.test(last)?uzun:kisa;
  res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store'});
  const gap=+process.env.GAP||35;
  const ev=(t)=>`event: content_block_delta\ndata: ${JSON.stringify({type:'content_block_delta',index:0,delta:{type:'text_delta',text:t}})}\n\n`;
  res.write('event: message_start\ndata: {"type":"message_start"}\n\n');await sleep(700);
  let raw='';const step=txt===uzun?24:9;
  for(let i=0;i<txt.length;i+=step){raw=ev(txt.slice(i,i+step));
   const cut=(i/step)%3===0?Math.floor(raw.length/2):raw.length; // her 3 olaydan biri okuma sınırında bölünür
   res.write(raw.slice(0,cut));await sleep(gap);if(cut<raw.length){res.write(raw.slice(cut));await sleep(gap/2)}}
  res.write('event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n');return res.end()}
 let f=path.join(ROOT,u.pathname==='/'?'index.html':u.pathname);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end()}
 const ext=path.extname(f);res.writeHead(200,{'content-type':{'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'}[ext]||'application/octet-stream'});fs.createReadStream(f).pipe(res)
}).listen(PORT,()=>console.log('hazir',PORT));
