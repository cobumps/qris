(() => {
  const $ = (id) => document.getElementById(id);
  const payloadInput = $('payloadInput');
  const qrImage = $('qrImage');
  const dropzone = $('dropzone');
  const merchantName = $('merchantName');
  const cityName = $('cityName');
  const postalCode = $('postalCode');
  const amount = $('amount');
  const feeType = $('feeType');
  const feeValue = $('feeValue');
  const canvas = $('qrCanvas');
  let originalPayload = '';
  let loadedTags = [];
  let currentNMID = '';
  let lastGeneratedPayload = '';

  function showStatus(el, text, type='success') {
    el.textContent = text;
    el.className = `status ${type}`;
  }
  function hideStatus(el){el.className='status hidden';}
  function normalizePayload(v){
    // Jangan hapus spasi di dalam payload. Pada QRIS/EMV, spasi dapat menjadi
    // bagian dari Merchant Name/City dan ikut dihitung dalam panjang TLV.
    return String(v||'').replace(/^\uFEFF/, '').trim();
  }
  function crc16ccitt(str){
    let crc=0xFFFF;
    for(let i=0;i<str.length;i++){
      crc ^= str.charCodeAt(i)<<8;
      for(let j=0;j<8;j++) crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);
      crc &= 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4,'0');
  }
  function parseTLV(payload){
    const tags=[]; let i=0;
    while(i<payload.length){
      if(i+4>payload.length) throw new Error('Payload TLV terpotong.');
      const id=payload.slice(i,i+2); const lenText=payload.slice(i+2,i+4);
      if(!/^\d{2}$/.test(id)||!/^\d{2}$/.test(lenText)) throw new Error(`Format TLV tidak valid di posisi ${i}.`);
      const len=parseInt(lenText,10); const start=i+4; const end=start+len;
      if(end>payload.length) throw new Error(`Panjang tag ${id} tidak sesuai payload.`);
      tags.push({id,value:payload.slice(start,end)}); i=end;
    }
    return tags;
  }
  function encodeTag(id,value){
    const s=String(value??''); if(s.length>99) throw new Error(`Nilai tag ${id} terlalu panjang.`);
    return id+s.length.toString().padStart(2,'0')+s;
  }
  function getTag(tags,id){return tags.find(t=>t.id===id)?.value ?? '';}
  function setTag(tags,id,value,removeWhenEmpty=false){
    const idx=tags.findIndex(t=>t.id===id);
    if(removeWhenEmpty && (value===''||value==null)) { if(idx>=0) tags.splice(idx,1); return; }
    if(idx>=0) tags[idx].value=String(value); else {
      const crcIndex=tags.findIndex(t=>t.id==='63');
      tags.splice(crcIndex>=0?crcIndex:tags.length,0,{id,value:String(value)});
    }
  }
  function removeTag(tags,id){const i=tags.findIndex(t=>t.id===id); if(i>=0) tags.splice(i,1);}
  function validateCRC(payload){
    const m=payload.match(/6304([0-9A-Fa-f]{4})$/); if(!m) return false;
    const base=payload.slice(0,-4); return crc16ccitt(base)===m[1].toUpperCase();
  }
  function extractNMID(payload){
    // NMID QRIS umumnya berbentuk ID diikuti digit dan berada di Merchant
    // Account Information. Cari dari payload asli agar identitas pada template
    // selalu mengikuti QRIS yang benar-benar dimuat, bukan dibuat acak.
    const candidates=String(payload||'').match(/ID\d{10,20}/g) || [];
    if(!candidates.length) return '';
    // Hindari duplikat lalu pilih kandidat pertama sesuai urutan payload.
    return [...new Set(candidates)][0];
  }

  function loadPayload(raw){
    const p=normalizePayload(raw); if(!p) throw new Error('Payload QRIS masih kosong.');
    const tags=parseTLV(p);
    if(getTag(tags,'00')!=='01') throw new Error('Payload bukan format EMV/QRIS yang dikenali.');
    if(!tags.some(t=>t.id==='63')) throw new Error('Tag CRC (63) tidak ditemukan.');
    if(!validateCRC(p)) throw new Error('CRC payload tidak valid. Pastikan QRIS original terbaca lengkap.');
    originalPayload=p; loadedTags=tags;
    currentNMID=extractNMID(p);
    $('originalPayload').textContent=p;
    if($('nmidValue')) $('nmidValue').value=currentNMID || 'Tidak ditemukan';
    merchantName.value=getTag(tags,'59'); cityName.value=getTag(tags,'60'); postalCode.value=getTag(tags,'61');
    amount.value=getTag(tags,'54');
    const feeInd=getTag(tags,'55');
    if(feeInd==='02'){feeType.value='fixed'; feeValue.value=getTag(tags,'56'); feeValue.disabled=false;}
    else if(feeInd==='03'){feeType.value='percent'; feeValue.value=getTag(tags,'57'); feeValue.disabled=false;}
    else {feeType.value='none'; feeValue.value=''; feeValue.disabled=true;}
    updateCounts();
    return p;
  }
  function formatAmount(v){
    if(!v) return '';
    const cleaned=String(v).replace(/[^0-9]/g,''); if(!cleaned) return '';
    const n=parseInt(cleaned,10); if(n<1) throw new Error('Nominal minimal Rp1.'); if(n>10000000) throw new Error('Nominal maksimal Rp10.000.000.');
    return String(n);
  }
  function buildPayload(){
    if(!originalPayload||!loadedTags.length) throw new Error('Load QRIS original terlebih dahulu.');
    const tags=loadedTags.filter(t=>t.id!=='63').map(t=>({...t}));
    const name=merchantName.value.trim().toUpperCase(); const city=cityName.value.trim().toUpperCase(); const zip=postalCode.value.trim();
    if(!name) throw new Error('Merchant Name wajib diisi.'); if(name.length>25) throw new Error('Merchant Name maksimal 25 karakter.');
    if(!city) throw new Error('City Name wajib diisi.'); if(city.length>15) throw new Error('City Name maksimal 15 karakter.');
    if(zip && !/^\d{1,10}$/.test(zip)) throw new Error('Postal Code harus berupa angka maksimal 10 digit.');
    setTag(tags,'59',name); setTag(tags,'60',city); setTag(tags,'61',zip,true);

    const amountValue=formatAmount(amount.value);
    if(amountValue){ setTag(tags,'01','12'); setTag(tags,'54',amountValue); }
    else { removeTag(tags,'54'); }

    removeTag(tags,'55'); removeTag(tags,'56'); removeTag(tags,'57');
    if(feeType.value==='fixed'){
      const fv=formatAmount(feeValue.value); if(!fv) throw new Error('Masukkan nilai biaya tetap.');
      setTag(tags,'55','02'); setTag(tags,'56',fv);
    } else if(feeType.value==='percent'){
      const raw=feeValue.value.trim().replace(',','.'); const n=Number(raw);
      if(!Number.isFinite(n)||n<=0||n>99.99) throw new Error('Persentase biaya harus lebih dari 0 dan maksimal 99,99%.');
      const val=n.toFixed(2).replace(/\.00$/,''); setTag(tags,'55','03'); setTag(tags,'57',val);
    }
    let base=tags.map(t=>encodeTag(t.id,t.value)).join('')+'6304';
    return base+crc16ccitt(base);
  }
  function fitText(ctx,text,maxWidth,startSize,minSize,weight='700'){
    const value=String(text||'').trim();
    let size=startSize;
    while(size>minSize){
      ctx.font=`${weight} ${size}px Arial, Helvetica, sans-serif`;
      if(ctx.measureText(value).width<=maxWidth) break;
      size-=0.5;
    }
    return size;
  }

  async function composeTemplate(text, targetCanvas, exportScale=1){
    const qr=new window.QRCodeModel(0,1); qr.addData(text); qr.make();
    const count=qr.getModuleCount();

    // Template poster asli pengguna: 1448 x 2048 px.
    // Hanya area QR di tengah yang ditimpa setiap kali Generate QRIS.
    const baseW=1448, baseH=2048;
    const outW=Math.round(baseW*exportScale), outH=Math.round(baseH*exportScale);
    targetCanvas.width=outW; targetCanvas.height=outH;
    const ctx=targetCanvas.getContext('2d');
    ctx.clearRect(0,0,outW,outH);

    const img=new Image();
    img.src='assets/qris-template.png';
    await new Promise((resolve,reject)=>{
      if(img.complete && img.naturalWidth) return resolve();
      img.onload=resolve;
      img.onerror=()=>reject(new Error('Template poster gagal dimuat.'));
    });
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,outW,outH);

    const S=exportScale;

    // Area QR dibuat putih untuk menutup tulisan placeholder "TEMPATKAN QR CODE DISINI"
    // tanpa menutupi bingkai sudut hitam pada desain asli.
    const qrArea={x:388*S,y:858*S,w:672*S,h:672*S};
    ctx.fillStyle='#ffffff';
    ctx.fillRect(qrArea.x,qrArea.y,qrArea.w,qrArea.h);

    // Render QR langsung dari modul agar tetap tajam saat dicetak.
    // Quiet zone 4 modul dipertahankan agar mudah dipindai.
    const quiet=4;
    const total=count+quiet*2;
    const inner=620*S;
    const qx=414*S, qy=884*S;
    const module=inner/total;
    ctx.fillStyle='#000000';
    ctx.imageSmoothingEnabled=false;
    for(let r=0;r<count;r++){
      for(let c=0;c<count;c++){
        if(qr.isDark(r,c)){
          const x=Math.floor(qx+(c+quiet)*module);
          const y=Math.floor(qy+(r+quiet)*module);
          const x2=Math.ceil(qx+(c+quiet+1)*module);
          const y2=Math.ceil(qy+(r+quiet+1)*module);
          ctx.fillRect(x,y,x2-x,y2-y);
        }
      }
    }
  }

  async function renderQR(text){
    lastGeneratedPayload=text;
    await composeTemplate(text,canvas,1);
    $('emptyPreview').classList.add('hidden');
    canvas.classList.remove('hidden');
    $('downloadBtn').classList.remove('hidden'); if($('printBtn')) $('printBtn').classList.remove('hidden');
  }
  async function scanWithJsQR(file){
    if(typeof window.jsQR !== 'function') throw new Error('Library scanner QR gagal dimuat. Pastikan internet aktif saat membuka halaman, lalu refresh.');
    const bitmap=await createImageBitmap(file);
    const maxDim=1800;
    let w=bitmap.width, h=bitmap.height;
    const scale=Math.min(1, maxDim/Math.max(w,h));
    w=Math.max(1,Math.round(w*scale)); h=Math.max(1,Math.round(h*scale));
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(bitmap,0,0,w,h); bitmap.close();
    const img=ctx.getImageData(0,0,w,h);
    let code=window.jsQR(img.data,w,h,{inversionAttempts:'attemptBoth'});
    if(!code){
      const rotations=[90,180,270];
      for(const deg of rotations){
        const rc=document.createElement('canvas');
        if(deg===90||deg===270){rc.width=h;rc.height=w;}else{rc.width=w;rc.height=h;}
        const rctx=rc.getContext('2d',{willReadFrequently:true});
        rctx.translate(rc.width/2,rc.height/2); rctx.rotate(deg*Math.PI/180); rctx.drawImage(c,-w/2,-h/2);
        const rimg=rctx.getImageData(0,0,rc.width,rc.height);
        code=window.jsQR(rimg.data,rc.width,rc.height,{inversionAttempts:'attemptBoth'});
        if(code) break;
      }
    }
    return code?.data || '';
  }
  async function scanImage(file){
    hideStatus($('scanStatus'));
    if(!file) return;
    try{
      let value='';
      if('BarcodeDetector' in window){
        try{
          const detector=new BarcodeDetector({formats:['qr_code']});
          const bitmap=await createImageBitmap(file); const codes=await detector.detect(bitmap); bitmap.close();
          if(codes.length) value=codes[0].rawValue;
        }catch(_){ /* fallback ke jsQR */ }
      }
      if(!value) value=await scanWithJsQR(file);
      if(!value) throw new Error('QR tidak ditemukan pada gambar. Coba gunakan foto yang lebih tajam, lurus, dan QR memenuhi sebagian besar gambar.');
      // Setelah QR berhasil dibaca, langsung masukkan payload lalu auto-load data QRIS.
      payloadInput.value=value;
      $('payloadCount').textContent=`${value.length} karakter`;
      originalPayload='';
      loadedTags=[];
      currentNMID='';
      if($('nmidValue')) $('nmidValue').value='';
      $('originalPayload').textContent=value;
      merchantName.value=''; cityName.value=''; postalCode.value=''; amount.value='';
      feeType.value='none'; feeValue.value=''; feeValue.disabled=true;
      updateCounts();

      try {
        loadPayload(value);
        showStatus($('scanStatus'),'QR berhasil dibaca dan QRIS otomatis dimuat.','success');
        showStatus($('loadStatus'),'QRIS berhasil dibaca. Silakan atur data merchant dan nominal.','success');
      } catch (loadErr) {
        const raw=normalizePayload(value);
        const hint=/^https?:\/\//i.test(raw) ? ' QR yang dibaca berisi URL/link, bukan payload QRIS EMV.' : '';
        showStatus($('scanStatus'),'QR berhasil dibaca, tetapi data QRIS tidak dapat dimuat otomatis.','error');
        showStatus($('loadStatus'),loadErr.message+hint,'error');
      }
    }catch(e){showStatus($('scanStatus'),e.message,'error');}
  }
  function updateCounts(){
    $('payloadCount').textContent=`${payloadInput.value.length} karakter`;
    $('merchantCount').textContent=`${merchantName.value.length} / 25`;
    $('cityCount').textContent=`${cityName.value.length} / 15`;
    $('postalCount').textContent=`${postalCode.value.length} / 10`;
  }
  let manualLoadTimer=null;
payloadInput.addEventListener('input',()=>{
  updateCounts();
  clearTimeout(manualLoadTimer);
  manualLoadTimer=setTimeout(()=>{
    const raw=normalizePayload(payloadInput.value);
    if(!raw) return;
    try{ loadPayload(raw); showStatus($('loadStatus'),'QRIS berhasil dibaca dan data merchant dimuat otomatis.','success'); }
    catch(_){ /* jangan tampilkan error saat pengguna masih mengetik */ }
  },700);
}); merchantName.addEventListener('input',updateCounts); cityName.addEventListener('input',updateCounts);
  postalCode.addEventListener('input',()=>{postalCode.value=postalCode.value.replace(/\D/g,'').slice(0,10);updateCounts();});
  amount.addEventListener('input',()=>{amount.value=amount.value.replace(/\D/g,'');});
  feeType.addEventListener('change',()=>{feeValue.disabled=feeType.value==='none'; if(feeValue.disabled) feeValue.value='';});
  qrImage.addEventListener('change',e=>scanImage(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag')}));
  dropzone.addEventListener('drop',e=>{const f=e.dataTransfer.files?.[0]; if(f) scanImage(f);});
  $('loadBtn').addEventListener('click',()=>{
    try{
      loadPayload(payloadInput.value);
      showStatus($('loadStatus'),'QRIS berhasil dibaca. Silakan atur data merchant dan nominal.','success');
    }catch(e){
      const raw=normalizePayload(payloadInput.value);
      const hint=/^https?:\/\//i.test(raw) ? ' QR yang dibaca berisi URL/link, bukan payload QRIS EMV.' : '';
      showStatus($('loadStatus'),e.message+hint,'error');
    }
  });
  $('generateBtn').addEventListener('click',async()=>{try{const p=buildPayload(); parseTLV(p); if(!validateCRC(p)) throw new Error('CRC hasil generate gagal diverifikasi.'); await renderQR(p); $('generatedPayload').textContent=p; showStatus($('generateStatus'),'QRIS berhasil dibuat pada template. Hanya area barcode yang diganti. Uji scan dengan aplikasi pembayaran sebelum digunakan.','success');}catch(e){showStatus($('generateStatus'),e.message,'error');}});
  $('downloadBtn').addEventListener('click',async()=>{
    if(!lastGeneratedPayload) return;
    try{
      const exportCanvas=document.createElement('canvas');
      await composeTemplate(lastGeneratedPayload,exportCanvas,3);
      const a=document.createElement('a');
      const safe=(merchantName.value||'merchant').trim().replace(/[^a-z0-9_-]+/gi,'-').replace(/-+/g,'-');
      a.download=`QRIS-${safe}.png`;
      a.href=exportCanvas.toDataURL('image/png');
      a.click();
    }catch(e){showStatus($('generateStatus'),e.message,'error');}
  });
  if($('printBtn')) $('printBtn').addEventListener('click',()=>{
    if(!lastGeneratedPayload) return;
    window.print();
  });
  updateCounts();
})();
