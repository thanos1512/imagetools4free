var imgs={}, files={};
function loadImg(file, key, cb) {
  if(!file||!file.type.match(/^image\//)){toast('Please choose an image file, such as a JPG or PNG.');return;}
  files[key]=file;
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
    if(input.multiple||!input.files||!input.files[0])return;
    var t=box.querySelector('.upload-title'),s=box.querySelector('.upload-sub');
    if(t){t.textContent='';var sp=document.createElement('span');sp.textContent=input.files[0].name;t.appendChild(sp);}
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
