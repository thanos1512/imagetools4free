var imgs={}, files={};
function loadImg(file, key, cb) {
  if(!file||!file.type.match(/^image\//)){alert('Please choose an image file.');return;}
  files[key]=file;
  var img=new Image();
  img.onload=function(){imgs[key]=img;cb(img,file);};
  img.src=URL.createObjectURL(file);
}
function fmtSize(b){
  if(b<1024)return b+'B';
  if(b<1048576)return(b/1024).toFixed(1)+' KB';
  return(b/1048576).toFixed(2)+' MB';
}
function toast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('on');
  setTimeout(function(){t.classList.remove('on');},2500);
}
function dlBlob(blob,name){
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
}
function dlUrl(url,name){var a=document.createElement('a');a.href=url;a.download=name;a.click();}
function cv(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function showPreview(id,img,file){
  document.getElementById(id).innerHTML='<img src="'+img.src+'" alt="preview">'
    +'<div class="img-stats">'
    +'<div class="img-stat"><div class="img-stat-val">'+img.width+'×'+img.height+'</div><div class="img-stat-key">Size</div></div>'
    +'<div class="img-stat"><div class="img-stat-val">'+fmtSize(file.size)+'</div><div class="img-stat-key">File Size</div></div>'
    +'<div class="img-stat"><div class="img-stat-val">'+file.type.split('/')[1].toUpperCase()+'</div><div class="img-stat-key">Format</div></div>'
    +'</div>';
}
function enBtn(id){var b=document.getElementById(id);if(b)b.disabled=false;}

// ── UPLOAD BOXES: keyboard access + drag & drop ─────────────────
document.querySelectorAll('.upload-box').forEach(function(box){
  var input = box.querySelector('input[type=file]');
  if(!input) return;
  box.setAttribute('tabindex','0');
  box.setAttribute('role','button');
  box.setAttribute('aria-label','Choose an image file');
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
    if(!f || !f.length) return;
    var dt = new DataTransfer(); dt.items.add(f[0]);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
  });
});
