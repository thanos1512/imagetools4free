var imgs={}, files={};
function loadImg(file, key, cb) {
  if(!file||!file.type.match(/^image\//)){toast('Please choose an image file, such as a JPG or PNG.');return;}
  files[key]=file;lastFile=file;
  var img=new Image();
  img.onload=function(){imgs[key]=img;cb(img,file);};
  img.onerror=function(){toast('This picture could not be opened. Try saving it as JPG or PNG first.');};
  img.src=URL.createObjectURL(file);
}
function fmtSize(b){
  if(b<1024)return b+' B';
  if(b<1048576)return(b/1024).toFixed(1)+' KB';
  return(b/1048576).toFixed(2)+' MB';
}
var toastTimer;
function toast(msg){
  var t=document.getElementById('toast');
  if(!t){t=document.createElement('div');t.id='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.appendChild(t);}
  t.textContent=String(msg).replace(/^[☀-➿️\u{1F300}-\u{1FAFF}\s]+/u,'');
  t.classList.add('on');clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove('on');},3200);
}
function dlBlob(blob,name){
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},4000);
}
function dlUrl(url,name){var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();}
function cv(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function showPreview(id,img,file){
  document.getElementById(id).innerHTML='<img src="'+img.src+'" alt="Preview of your image">'
    +'<div class="img-stats">'
    +'<div class="img-stat"><div class="img-stat-val">'+img.width+' × '+img.height+'</div><div class="img-stat-key">Pixels</div></div>'
    +'<div class="img-stat"><div class="img-stat-val">'+fmtSize(file.size)+'</div><div class="img-stat-key">File size</div></div>'
    +'<div class="img-stat"><div class="img-stat-val">'+(file.type.split('/')[1]||'?').toUpperCase()+'</div><div class="img-stat-key">Format</div></div>'
    +'</div>';
}
function enBtn(id){var b=document.getElementById(id);if(b)b.disabled=false;}

// Save a canvas in the same family of format as the original file.
function saveCanvas(c,file,base){
  var t=file&&file.type,type=/jpe?g/.test(t)?'image/jpeg':(t==='image/webp'?'image/webp':'image/png');
  var ext={'image/jpeg':'jpg','image/webp':'webp','image/png':'png'}[type];
  c.toBlob(function(b){dlBlob(b,base+'.'+ext);toast('Image downloaded.');},type,0.95);
}

// Size a canvas wrapper so the whole image fits on screen.
function fitStage(stage,wrap,w,h){
  function fit(){
    var cs=getComputedStyle(stage),aw=stage.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
    var ah=Math.min(window.innerHeight*0.72,900),s=Math.min(1,aw/w,ah/h);
    wrap.style.width=Math.floor(w*s)+'px';wrap.style.height=Math.floor(h*s)+'px';
  }
  fit();
  if(!stage._fit){stage._fit=true;window.addEventListener('resize',function(){var wp=stage.querySelector('.paint-wrap');if(wp===wrap)fit();});}
}

// Fill masked pixels from their surroundings, layer by layer from the edge inwards.
function inpaint(d,w,h,isMasked){
  var n=w*h,U=new Uint8Array(n),x,y,i,a,b,f;
  for(y=0;y<h;y++)for(x=0;x<w;x++)if(isMasked(x,y))U[y*w+x]=1;
  var D=U.slice();
  for(y=0;y<h;y++)for(x=0;x<w;x++)if(U[y*w+x])for(a=-2;a<=2;a++)for(b=-2;b<=2;b++){var yy=y+a,xx=x+b;if(yy>=0&&yy<h&&xx>=0&&xx<w)D[yy*w+xx]=1;}
  U=D;var filled=U.slice();
  // grain: average difference between neighbouring known pixels next to the mask
  var gs=0,gc=0;
  for(y=0;y<h;y++)for(x=0;x<w-1;x++){i=y*w+x;if(!U[i]&&!U[i+1]){var near=false;for(a=-3;a<=3&&!near;a++){var ry=y+a;if(ry<0||ry>=h)continue;for(b=-3;b<=3;b++){var rx=x+b;if(rx>=0&&rx<w&&U[ry*w+rx]){near=true;break;}}}
    if(near){gs+=Math.abs(d[i*4]-d[i*4+4])+Math.abs(d[i*4+1]-d[i*4+5])+Math.abs(d[i*4+2]-d[i*4+6]);gc+=3;}}}
  var grain=gc?Math.min(14,gs/gc*0.7):0;
  var Q=new Uint8Array(n),front=[];
  function edge(p){var px=p%w,py=(p-px)/w;for(var a=-1;a<=1;a++)for(var b=-1;b<=1;b++){if(!a&&!b)continue;var yy=py+a,xx=px+b;if(yy>=0&&yy<h&&xx>=0&&xx<w&&!U[yy*w+xx])return true;}return false;}
  for(i=0;i<n;i++)if(U[i]&&edge(i)){front.push(i);Q[i]=1;}
  var R=4;
  while(front.length){
    var res=new Float32Array(front.length*4);
    for(f=0;f<front.length;f++){
      var p=front[f],px=p%w,py=(p-px)/w,s0=0,s1=0,s2=0,s3=0,sw=0;
      for(a=-R;a<=R;a++){var yy2=py+a;if(yy2<0||yy2>=h)continue;
        for(b=-R;b<=R;b++){var xx2=px+b;if(xx2<0||xx2>=w)continue;var q=yy2*w+xx2;if(U[q])continue;
          var wt=1/(a*a+b*b),k=q*4;s0+=d[k]*wt;s1+=d[k+1]*wt;s2+=d[k+2]*wt;s3+=d[k+3]*wt;sw+=wt;}}
      res[f*4]=s0/sw;res[f*4+1]=s1/sw;res[f*4+2]=s2/sw;res[f*4+3]=s3/sw;
    }
    for(f=0;f<front.length;f++){var k2=front[f]*4;d[k2]=res[f*4];d[k2+1]=res[f*4+1];d[k2+2]=res[f*4+2];d[k2+3]=res[f*4+3];U[front[f]]=0;}
    var next=[];
    for(f=0;f<front.length;f++){var p2=front[f],qx=p2%w,qy=(p2-qx)/w;
      for(a=-1;a<=1;a++)for(b=-1;b<=1;b++){var ny=qy+a,nx=qx+b;if(ny<0||ny>=h||nx<0||nx>=w)continue;var q2=ny*w+nx;if(U[q2]&&!Q[q2]){Q[q2]=1;next.push(q2);}}}
    front=next;
  }
  // relax the patch into a smooth blend of its edges (removes streaks and seams)
  var idx=[];for(i=0;i<n;i++)if(filled[i])idx.push(i);
  var F=new Float32Array(n*3);for(i=0;i<n;i++){F[i*3]=d[i*4];F[i*3+1]=d[i*4+1];F[i*3+2]=d[i*4+2];}
  var iters=Math.min(400,Math.max(80,Math.round(Math.sqrt(idx.length)*3)));
  for(var it=0;it<iters;it++){
    var fw=it%2===0;
    for(var t=0;t<idx.length;t++){var p3=idx[fw?t:idx.length-1-t],cx=p3%w,cy=(p3-cx)/w;
      var l=cx>0?p3-1:p3,r=cx<w-1?p3+1:p3,u=cy>0?p3-w:p3,dn=cy<h-1?p3+w:p3;
      for(var c=0;c<3;c++)F[p3*3+c]=(F[l*3+c]+F[r*3+c]+F[u*3+c]+F[dn*3+c])/4;}
  }
  for(t=0;t<idx.length;t++){i=idx[t];d[i*4]=F[i*3];d[i*4+1]=F[i*3+1];d[i*4+2]=F[i*3+2];}
  if(grain)for(i=0;i<n;i++)if(filled[i]){var g=(Math.random()-0.5)*grain;d[i*4]+=g;d[i*4+1]+=g;d[i*4+2]+=g;}
}

// ── SAVING: format choice + optional maximum file size ─────────────────
var lastFile=null;
var EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
// Draw src (image or canvas) at a scale and encode it. JPG gets a white background.
function encodeTo(src,scale,fmt,q,cb){
  var w=Math.max(1,Math.round(src.width*scale)),h=Math.max(1,Math.round(src.height*scale)),c=cv(w,h),x=c.getContext('2d');
  if(fmt==='image/jpeg'){x.fillStyle='#fff';x.fillRect(0,0,w,h);}
  x.imageSmoothingQuality='high';x.drawImage(src,0,0,w,h);
  c.toBlob(function(b){cb(b,w,h);},fmt,q);
}
// Find the best version of src that fits under limit bytes.
// JPG/WebP: highest quality that fits, shrinking pixels only if needed. PNG: shrink pixels only.
// opts.keepSize: never change the pixel size (used where the user chose exact pixels).
function fitToSize(src,fmt,limit,cb,opts){
  opts=opts||{};
  if(fmt==='image/png'){
    encodeTo(src,1,fmt,1,function(b,w,h){
      if(b.size<=limit)return cb({b:b,w:w,h:h});
      if(opts.keepSize)return cb({b:b,w:w,h:h,miss:true});
      var lo=0.02,hi=1,best=null,n=0;
      (function step(){var s=(lo+hi)/2;encodeTo(src,s,fmt,1,function(b2,w2,h2){
        if(b2.size<=limit){best={b:b2,w:w2,h:h2};lo=s;}else hi=s;
        if(++n<9)return step();
        if(best)return cb(best);
        encodeTo(src,lo,fmt,1,function(b3,w3,h3){cb({b:b3,w:w3,h:h3,miss:true});});
      });})();
    });
    return;
  }
  var minQ=opts.keepSize?0.1:0.35,scale=opts.keepSize?1:Math.min(1,Math.sqrt(limit*14/(src.width*src.height))),rounds=0;
  (function attempt(){
    var lo=minQ,hi=0.92,best=null,n=0;
    (function step(){var q=(lo+hi)/2;encodeTo(src,scale,fmt,q,function(b,w,h){
      if(b.size<=limit){best={b:b,w:w,h:h,q:q};lo=q;}else hi=q;
      if(++n<7)return step();
      if(best){
        if(!opts.keepSize&&scale<1&&best.q>0.8&&rounds<20){var up=Math.min(1,scale*1.12),keep=best;
          return encodeTo(src,up,fmt,0.8,function(b2){if(b2.size<=limit){scale=up;rounds++;attempt();}else cb(keep);});}
        return cb(best);}
      if(opts.keepSize||++rounds>20){return encodeTo(src,scale,fmt,minQ,function(b,w,h){cb({b:b,w:w,h:h,q:minQ,miss:true});});}
      scale*=0.85;attempt();
    });})();
  })();
}
function sameFormat(file){var t=file&&file.type;return /jpe?g/.test(t)?'image/jpeg':(t==='image/webp'?'image/webp':'image/png');}
function chosenFormat(file){var s=document.getElementById('so-fmt');return s&&s.value!=='same'?s.value:sameFormat(file);}
function kbLimit(id){var el=document.getElementById(id||'so-kb');var v=el&&parseFloat(el.value);return v>0?Math.round(v*1024):0;}
// Save a finished canvas using the page's "Save as" options.
// Encode a finished canvas with format, optional KB limit and optional print DPI. cb({b,w,h,miss})
function produce(c,o,cb){
  function fin(r){if(o.dpi&&o.fmt==='image/jpeg')jpegDpi(r.b,o.dpi,function(b){r.b=b;cb(r);});else cb(r);}
  if(o.limit)fitToSize(c,o.fmt,o.limit,fin,{keepSize:o.keepSize});
  else encodeTo(c,1,o.fmt,o.q||0.92,function(b,w,h){fin({b:b,w:w,h:h});});
}
// Write print resolution into a JPG (JFIF header), so print shops print it at the right size.
function jpegDpi(blob,dpi,cb){
  blob.arrayBuffer().then(function(ab){var u=new Uint8Array(ab);
    if(u[0]===0xFF&&u[1]===0xD8&&u[2]===0xFF&&u[3]===0xE0&&u[6]===0x4A&&u[7]===0x46&&u[8]===0x49&&u[9]===0x46){u[13]=1;u[14]=dpi>>8;u[15]=dpi&255;u[16]=dpi>>8;u[17]=dpi&255;}
    cb(new Blob([u],{type:'image/jpeg'}));});
}
function saveMsg(r,fmt,limit,keep,c){
  if(r.miss&&fmt==='image/png'&&keep)return 'PNG can’t be made smaller without changing the pixel size. Choose JPG or WebP to reach '+fmtSize(limit)+'.';
  if(r.miss)return 'Could not get under '+fmtSize(limit)+'. Downloaded the smallest version: '+fmtSize(r.b.size)+'.';
  return 'Downloaded '+EXT[fmt].toUpperCase()+', '+fmtSize(r.b.size)+(c&&r.w!==c.width?' ('+r.w+' × '+r.h+' px)':'')+'.';
}
// Save a finished canvas using the page's "Save as" options.
function exportImage(c,base,opts){
  opts=opts||{};
  var fmt=opts.fmt||chosenFormat(lastFile),limit=opts.limit!==undefined?opts.limit:kbLimit();
  produce(c,{fmt:fmt,limit:limit,q:opts.q,keepSize:opts.keepSize,dpi:opts.dpi},function(r){
    dlBlob(r.b,base+'.'+EXT[fmt]);toast(saveMsg(r,fmt,limit,opts.keepSize,c));if(opts.done)opts.done(r);
  });
}

// ── ZIP (stored, no extra compression: images are already compressed) ─────────────────
var CRC_T=(function(){var t=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(u){var c=0xFFFFFFFF;for(var i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function makeZip(entries){
  var enc=new TextEncoder(),parts=[],central=[],off=0,d=new Date();
  var tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  entries.forEach(function(e){
    var nm=enc.encode(e.name),crc=crc32(e.data),sz=e.data.length,h=new DataView(new ArrayBuffer(30)),c=new DataView(new ArrayBuffer(46));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(10,tm,true);h.setUint16(12,dt,true);
    h.setUint32(14,crc,true);h.setUint32(18,sz,true);h.setUint32(22,sz,true);h.setUint16(26,nm.length,true);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(12,tm,true);c.setUint16(14,dt,true);
    c.setUint32(16,crc,true);c.setUint32(20,sz,true);c.setUint32(24,sz,true);c.setUint16(28,nm.length,true);c.setUint32(42,off,true);
    parts.push(h.buffer,nm,e.data);central.push(c.buffer,nm);off+=30+nm.length+sz;
  });
  var cd=central.reduce(function(a,b){return a+b.byteLength;},0),end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,entries.length,true);end.setUint16(10,entries.length,true);end.setUint32(12,cd,true);end.setUint32(16,off,true);
  return new Blob(parts.concat(central,[end.buffer]),{type:'application/zip'});
}

// ── BATCH: many images, one list, download each or all as ZIP ─────────────────
var BATCH=null;
function cleanName(n){return (n.replace(/\.[^.]+$/,'').replace(/[^\w\-]+/g,'-').replace(/^-+|-+$/g,'')||'image').slice(0,60);}
function batchActive(key){return !!(BATCH&&BATCH.key===key);}
function batchExit(){if(!BATCH)return;var box=document.getElementById(BATCH.o.box);if(box)box.classList.remove('list-box');BATCH=null;}
// o: {box, btn, label, run(img,file,cb(r)), suffix, zip, ext(file)->extension, onStart}
function batchStart(key,list,o){
  list=[].filter.call(list,function(f){return /^image\//.test(f.type);});
  if(!list.length){toast('Please choose image files, such as JPG or PNG.');return;}
  batchExit();BATCH={key:key,o:o,items:list.map(function(f){return {file:f,img:null,r:null,state:'wait'};}),busy:false};
  var b=BATCH,left=list.length,btn=document.getElementById(o.btn);btn.disabled=true;
  if(o.onStart)o.onStart();
  b.items.forEach(function(it){var im=new Image();im.onload=function(){it.img=im;if(!--left)ready();};im.onerror=function(){it.state='bad';if(!--left)ready();};im.src=URL.createObjectURL(it.file);});
  function ready(){if(BATCH!==b)return;lastFile=b.items[0].file;btn.disabled=false;btn.textContent=o.label+' ('+b.items.filter(function(i){return i.img;}).length+')';batchRender();}
}
function batchRender(){
  var b=BATCH;if(!b)return;var box=document.getElementById(b.o.box);box.classList.add('list-box');
  var done=b.items.filter(function(i){return i.r;}),total=0,orig=0;done.forEach(function(i){total+=i.r.b.size;orig+=i.file.size;});
  var head=b.items.length+' images'+(done.length?' · '+fmtSize(orig)+' → '+fmtSize(total):'');
  box.innerHTML='<div class="list-head">'+head+'</div><ol class="page-list batch-list">'+b.items.map(function(it,i){
    var nm=it.file.name.replace(/[<>&"]/g,''),st;
    if(it.state==='bad')st='<span class="bad">Could not open this file</span>';
    else if(it.state==='work')st='Working…';
    else if(it.r)st=fmtSize(it.file.size)+' → <b>'+fmtSize(it.r.b.size)+'</b>'+(it.r.w?' · '+it.r.w+' × '+it.r.h:'')+(it.r.miss?' <span class="bad">(could not reach the size)</span>':'');
    else st=fmtSize(it.file.size)+(it.img?' · '+it.img.width+' × '+it.img.height:'');
    return '<li>'+(it.img?'<img src="'+it.img.src+'" alt="">':'<span class="pl-ph"></span>')+'<div class="pl-meta"><div class="pl-name">'+nm+'</div><div class="pl-sub">'+st+'</div></div>'
      +'<div class="pl-btns">'+(it.r?'<button class="icon-btn" onclick="batchOne('+i+')" aria-label="Download '+nm+'">↓</button>':'')+'</div></li>';
  }).join('')+'</ol><div class="btn-row">'+(done.length?'<button class="btn-green" style="display:inline-flex" onclick="batchZip()">Download all as ZIP</button>':'')
  +'<button class="btn-ghost" onclick="batchReset()">Start over</button></div>';
}
function batchReset(){var b=BATCH;if(!b)return;var box=document.getElementById(b.o.box),btn=document.getElementById(b.o.btn);batchExit();
  box.innerHTML='<div class="preview-empty">Your preview will appear here after you choose an image.</div>';btn.textContent=b.o.single||b.o.label;btn.disabled=true;
  var inp=document.querySelector('.upload-box input[type=file]');if(inp)inp.value='';
  var bx=document.querySelector('.upload-box');if(bx){bx.classList.remove('has-file');var t=bx.querySelector('.upload-title');if(t)t.innerHTML='<span>Choose images</span>';}}
function batchRun(){
  var b=BATCH;if(!b||b.busy)return;b.busy=true;var btn=document.getElementById(b.o.btn),label=btn.textContent,i=0;
  btn.disabled=true;btn.textContent='Working…';
  (function next(){
    if(BATCH!==b)return;
    while(i<b.items.length&&!b.items[i].img)i++;
    if(i>=b.items.length){b.busy=false;btn.disabled=false;btn.textContent=label;batchRender();
      var n=b.items.filter(function(x){return x.r;}).length;toast(n+' images ready. Download them one by one or all as a ZIP.');return;}
    var it=b.items[i];it.state='work';batchRender();
    b.o.run(it.img,it.file,function(r){it.r=r;it.state='done';it.name=batchName(it,b);i++;setTimeout(next,0);});
  })();
}
function batchName(it,b){var ext=EXT[it.r.b.type]||'jpg',base=cleanName(it.file.name)+(b.o.suffix||''),n=base,k=2,used={};
  b.items.forEach(function(x){if(x!==it&&x.name)used[x.name]=1;});while(used[n+'.'+ext])n=base+'-'+(k++);return n+'.'+ext;}
function batchOne(i){var it=BATCH&&BATCH.items[i];if(it&&it.r)dlBlob(it.r.b,it.name);}
function batchZip(){
  var b=BATCH;if(!b)return;var done=b.items.filter(function(x){return x.r;});
  Promise.all(done.map(function(it){return it.r.b.arrayBuffer().then(function(ab){return {name:it.name,data:new Uint8Array(ab)};});}))
    .then(function(entries){dlBlob(makeZip(entries),b.o.zip||'images.zip');toast('ZIP downloaded with '+entries.length+' images.');});
}

// ── CROPPER: drag a box on the picture; optional fixed ratio ─────────────────
function Cropper(stage,img,opt){
  opt=opt||{};var self=this,W=img.width,H=img.height;self.ratio=opt.ratio||0;
  stage.innerHTML='';var wrap=document.createElement('div');wrap.className='crop-wrap';
  var pic=new Image();pic.src=img.src;pic.alt='';pic.draggable=false;wrap.appendChild(pic);
  var box=document.createElement('div');box.className='crop-box';box.tabIndex=0;box.setAttribute('role','slider');box.setAttribute('aria-label','Crop area. Drag to move, or use the arrow keys.');
  box.innerHTML=(opt.guide?'<div class="crop-guide"></div>':'')+'<i class="cg v1"></i><i class="cg v2"></i><i class="cg h1"></i><i class="cg h2"></i>'+['nw','ne','sw','se'].map(function(c){return '<span class="ch '+c+'" data-c="'+c+'"></span>';}).join('');
  wrap.appendChild(box);stage.appendChild(wrap);fitStage(stage,wrap,W,H);
  self.r={x:0,y:0,w:W,h:H};
  function k(){return wrap.clientWidth/W;}
  function draw(){var s=k(),r=self.r;box.style.left=r.x*s+'px';box.style.top=r.y*s+'px';box.style.width=r.w*s+'px';box.style.height=r.h*s+'px';}
  function emit(){draw();if(opt.onChange)opt.onChange(self.get());}
  self.get=function(){var r=self.r;return {x:Math.round(r.x),y:Math.round(r.y),w:Math.max(1,Math.round(r.w)),h:Math.max(1,Math.round(r.h))};};
  self.set=function(n){var r={x:+n.x||0,y:+n.y||0,w:+n.w||1,h:+n.h||1};r.w=Math.min(Math.max(1,r.w),W);r.h=Math.min(Math.max(1,r.h),H);
    r.x=Math.min(Math.max(0,r.x),W-r.w);r.y=Math.min(Math.max(0,r.y),H-r.h);self.r=r;emit();};
  self.setRatio=function(q){self.ratio=q||0;var r=self.r;if(!q){emit();return;}
    var cx=r.x+r.w/2,cy=r.y+r.h/2,w=Math.min(W,H*q),h=w/q;if(opt.fill===false){w=Math.min(r.w,r.h*q);h=w/q;}
    self.set({x:cx-w/2,y:cy-h/2,w:w,h:h});};
  self.redraw=draw;
  var drag=null;
  wrap.addEventListener('pointerdown',function(e){
    var t=e.target,s=k(),rc=wrap.getBoundingClientRect(),px=(e.clientX-rc.left)/s,py=(e.clientY-rc.top)/s,r=self.r;
    if(t.classList.contains('ch')){var c=t.getAttribute('data-c');drag={mode:'size',ax:c.indexOf('w')>-1?r.x+r.w:r.x,ay:c.indexOf('n')>-1?r.y+r.h:r.y};}
    else if(t===box||box.contains(t))drag={mode:'move',dx:px-r.x,dy:py-r.y};
    else{drag={mode:'size',ax:px,ay:py};}
    try{wrap.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();
  });
  wrap.addEventListener('pointermove',function(e){
    if(!drag)return;var s=k(),rc=wrap.getBoundingClientRect(),px=Math.min(W,Math.max(0,(e.clientX-rc.left)/s)),py=Math.min(H,Math.max(0,(e.clientY-rc.top)/s)),r=self.r;
    if(drag.mode==='move'){self.set({x:px-drag.dx,y:py-drag.dy,w:r.w,h:r.h});return;}
    var ax=drag.ax,ay=drag.ay,dx=px>=ax?1:-1,dy=py>=ay?1:-1,w=Math.abs(px-ax),h=Math.abs(py-ay),mw=dx>0?W-ax:ax,mh=dy>0?H-ay:ay,q=self.ratio;
    if(q){if(w/Math.max(h,1e-6)>q)w=h*q;else h=w/q;w=Math.min(w,mw,mh*q);h=w/q;}else{w=Math.min(w,mw);h=Math.min(h,mh);}
    w=Math.max(w,8);h=q?w/q:Math.max(h,8);
    self.r={x:dx>0?ax:ax-w,y:dy>0?ay:ay-h,w:w,h:h};emit();
  });
  ['pointerup','pointercancel'].forEach(function(ev){wrap.addEventListener(ev,function(){drag=null;});});
  box.addEventListener('keydown',function(e){var st=e.shiftKey?10:1,r=self.r,m={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[e.key];
    if(m){e.preventDefault();self.set({x:r.x+m[0],y:r.y+m[1],w:r.w,h:r.h});}});
  window.addEventListener('resize',function(){setTimeout(draw,50);});
  if(opt.ratio)self.setRatio(opt.ratio);else emit();
}

// ── BEFORE / AFTER slider ─────────────────
function compareView(box,before,after,labels){
  labels=labels||['Original','Result'];
  box.innerHTML='<div class="cmp"><img class="cmp-after" src="'+after+'" alt="'+labels[1]+'"><img class="cmp-before" src="'+before+'" alt="'+labels[0]+'">'
    +'<div class="cmp-line"><span class="cmp-knob">‹ ›</span></div><span class="cmp-tag l">'+labels[0]+'</span><span class="cmp-tag r">'+labels[1]+'</span>'
    +'<input type="range" class="cmp-range" min="0" max="100" value="50" aria-label="Drag to compare '+labels[0].toLowerCase()+' and '+labels[1].toLowerCase()+'"></div>';
  var cmp=box.querySelector('.cmp'),rng=box.querySelector('.cmp-range');
  function set(v){cmp.style.setProperty('--pos',v+'%');}
  rng.addEventListener('input',function(){set(rng.value);});set(50);
  var drag=false;
  function mv(e){var r=cmp.getBoundingClientRect(),v=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));rng.value=v;set(v);}
  cmp.addEventListener('pointerdown',function(e){drag=true;try{cmp.setPointerCapture(e.pointerId);}catch(x){}mv(e);});
  cmp.addEventListener('pointermove',function(e){if(drag)mv(e);});
  ['pointerup','pointercancel'].forEach(function(ev){cmp.addEventListener(ev,function(){drag=false;});});
}

// Quick-pick chips that fill a KB box: <div class="chips" data-for="input-id"><button data-v="50">
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('.chips[data-for] button');if(!b)return;
  var inp=document.getElementById(b.parentNode.getAttribute('data-for'));if(!inp)return;
  inp.value=b.getAttribute('data-v');inp.dispatchEvent(new Event('input',{bubbles:true}));
});
document.addEventListener('input',function(e){
  var inp=e.target;if(!inp.id)return;
  var g=document.querySelector('.chips[data-for="'+inp.id+'"]');if(!g)return;
  g.querySelectorAll('button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-v')===String(inp.value).trim());});
});

// ── UPLOAD BOXES: keyboard access, drag & drop, paste, file name ─────────────────
function feedInput(input,list){
  var dt=new DataTransfer(),n=input.multiple?list.length:1;
  for(var i=0;i<n;i++)dt.items.add(list[i]);
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
}
document.querySelectorAll('.upload-box').forEach(function(box){
  var input = box.querySelector('input[type=file]');
  if(!input) return;
  box.setAttribute('tabindex','0');
  box.setAttribute('role','button');
  box.setAttribute('aria-label',input.multiple?'Choose image files':'Choose an image file');
  box.addEventListener('click', function(e){ if(e.target !== input) input.click(); });
  box.addEventListener('keydown', function(e){ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); input.click(); } });
  ['dragenter','dragover'].forEach(function(ev){
    box.addEventListener(ev, function(e){ e.preventDefault(); box.classList.add('drag'); });
  });
  ['dragleave','drop'].forEach(function(ev){
    box.addEventListener(ev, function(e){ e.preventDefault(); box.classList.remove('drag'); });
  });
  box.addEventListener('drop', function(e){
    var f = e.dataTransfer && e.dataTransfer.files;
    if(f && f.length) feedInput(input,f);
  });
  input.addEventListener('change',function(){
    if(!input.files||!input.files[0]||(input.multiple&&input.hasAttribute('data-add')))return;
    var t=box.querySelector('.upload-title'),s=box.querySelector('.upload-sub'),n=input.files.length;
    if(t){t.textContent='';var sp=document.createElement('span');sp.textContent=n>1?n+' images chosen':input.files[0].name;t.appendChild(sp);}
    if(s)s.textContent='Click or drop to choose a different image';
    box.classList.add('has-file');
  });
});
document.addEventListener('paste',function(e){
  var input=document.querySelector('.upload-box input[type=file]');
  if(!input||!e.clipboardData)return;
  var t=e.target;if(t&&(t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&t.type!=='file')))return;
  var list=[].slice.call(e.clipboardData.files||[]).filter(function(f){return /^image\//.test(f.type);});
  if(list.length){e.preventDefault();feedInput(input,list);}
});

// ── HOME: tool search ─────────────────
(function(){
  var q=document.getElementById('tool-search');if(!q)return;
  var tiles=[].slice.call(document.querySelectorAll('.tile')),groups=[].slice.call(document.querySelectorAll('.tool-group')),empty=document.getElementById('no-tools');
  q.addEventListener('input',function(){
    var v=q.value.trim().toLowerCase(),shown=0;
    tiles.forEach(function(t){var ok=!v||t.getAttribute('data-k').indexOf(v)>-1;t.hidden=!ok;if(ok)shown++;});
    groups.forEach(function(g){g.hidden=!g.querySelector('.tile:not([hidden])');});
    empty.hidden=shown>0;
    if(!shown)empty.querySelector('b').textContent=q.value.trim();
  });
})();
