(function(){
  const $ = id => document.getElementById(id);
  const KEY = () => 'gas_propsurl_' + sid();

  async function call(payload){
    const url = localStorage[KEY()];
    if (!url) throw new Error('Chưa nhập URL web app (kết thúc bằng /exec)');
    if (!token || Date.now() > tokenExp) throw new Error('Chưa đăng nhập hoặc phiên hết hạn, bấm "Đăng nhập"');
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + '__props=1', {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify(Object.assign({token}, payload))
    });
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); } catch(e){ throw new Error('Web app không trả JSON. Kiểm tra đã thêm PropsAdmin.gs, thêm dòng vào doPost và deploy bản mới.'); }
    if (!j.ok) throw new Error(j.error || 'Lỗi không rõ');
    return j;
  }

  function show(){
    const b = kit.panel('Script Properties');
    b.innerHTML = '<input id="pu" placeholder="URL web app (kết thúc bằng /exec)" value="' + kit.esc(localStorage[KEY()] || '') + '">' +
      '<div class="row"><button id="pus">Lưu URL & Tải</button></div><div id="pl"></div>';
    $('pus').onclick = () => { localStorage[KEY()] = $('pu').value.trim(); load(); };
    if (localStorage[KEY()]) load();
  }

  async function load(){
    const L = $('pl'); L.textContent = 'Đang tải...';
    try {
      const j = await call({action: 'list'});
      const ks = Object.keys(j.props).sort();
      let h = '';
      ks.forEach((k, i) => {
        h += '<div style="margin:10px 0"><b style="word-break:break-all">' + kit.esc(k) + '</b>' +
          '<textarea id="pv' + i + '" rows="2" style="width:100%;padding:6px">' + kit.esc(j.props[k]) + '</textarea>' +
          '<div class="row"><button class="ps" data-i="' + i + '">Lưu</button><button class="pd r" data-i="' + i + '">Xoá</button></div></div>';
      });
      h += '<hr><b>Thêm mới</b><input id="nk" placeholder="Tên (key)">' +
        '<textarea id="nv" rows="2" style="width:100%;padding:6px" placeholder="Giá trị"></textarea>' +
        '<div class="row"><button id="pa" class="o">Thêm</button></div>';
      L.innerHTML = h;
      L.querySelectorAll('.ps').forEach(btn => btn.onclick = async () => {
        const k = ks[btn.dataset.i];
        try { await call({action: 'set', props: {[k]: $('pv' + btn.dataset.i).value}}); say('Đã lưu ' + k); } catch(e){ say('Lỗi: ' + e.message); }
      });
      L.querySelectorAll('.pd').forEach(btn => btn.onclick = async () => {
        const k = ks[btn.dataset.i];
        if (!confirm('Xoá property "' + k + '"? Code đang dùng nó có thể bị lỗi.')) return;
        try { await call({action: 'delete', key: k}); say('Đã xoá ' + k); load(); } catch(e){ say('Lỗi: ' + e.message); }
      });
      $('pa').onclick = async () => {
        const k = $('nk').value.trim();
        if (!k) return say('Nhập tên property');
        try { await call({action: 'set', props: {[k]: $('nv').value}}); say('Đã thêm ' + k); load(); } catch(e){ say('Lỗi: ' + e.message); }
      };
    } catch(e){ L.textContent = ''; say('Lỗi: ' + e.message); }
  }

  kit.btn('Script Properties', show);
})();
