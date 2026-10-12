const kit = {
  btn(label, fn){
    let bar = document.getElementById('mods');
    if (!bar){
      bar = document.createElement('div');
      bar.id = 'mods'; bar.className = 'row';
      document.querySelector('header').appendChild(bar);
    }
    const b = document.createElement('button');
    b.className = 'g'; b.textContent = label; b.onclick = fn;
    bar.appendChild(b);
  },
  panel(title){
    let o = document.getElementById('kitp'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'kitp';
    o.style.cssText = 'position:fixed;inset:0;background:#111827;z-index:9;overflow:auto;padding:12px';
    o.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:17px">' + title + '</b><button class="r" id="kitx">Đóng</button></div><div id="kitb"></div>';
    document.body.appendChild(o);
    document.getElementById('kitx').onclick = () => o.remove();
    return document.getElementById('kitb');
  },
  esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  },
  async api(method, path, body){
    if (!token || Date.now() > tokenExp) throw new Error('Chưa đăng nhập hoặc phiên hết hạn, bấm "Đăng nhập"');
    if (!sid()) throw new Error('Chưa có Script ID');
    const r = await fetch('https://script.googleapis.com/v1/projects/' + sid() + path, {
      method,
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
    return j;
  }
};
