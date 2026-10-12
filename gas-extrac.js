(function (global) {
  'use strict';
  const API = 'https://script.googleapis.com/v1/projects/';
  const TMP = '_SetProps';
  let cfg, tab = 'pending';

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').replace(/\r\n/g, '\n').replace(/\s+$/, '');

  async function api(path, method, body) {
    const token = await cfg.getToken();
    const res = await fetch(API + cfg.getScriptId() + path, {
      method: method || 'GET',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
    return data;
  }

  // ---------- Chờ đẩy ----------
  async function getPending() {
    const remote = (await api('/content')).files || [];
    const rmap = {};
    remote.forEach(f => { rmap[f.name] = f.source || ''; });
    const local = cfg.getLocalFiles() || [];
    const lnames = {};
    const rows = [];
    local.forEach(f => {
      lnames[f.name] = true;
      if (!(f.name in rmap)) rows.push({ name: f.name, status: 'new' });
      else if (norm(rmap[f.name]) !== norm(f.source)) rows.push({ name: f.name, status: 'modified' });
    });
    Object.keys(rmap).forEach(n => { if (!lnames[n]) rows.push({ name: n, status: 'deleted' }); });
    return { rows: rows, total: local.length };
  }

  // ---------- Deploy ----------
  async function deploy(description, deploymentId) {
    const desc = description || 'Deploy từ web';
    const ver = await api('/versions', 'POST', { description: desc });
    const config = { versionNumber: ver.versionNumber, manifestFileName: 'appsscript', description: desc };
    if (deploymentId) return api('/deployments/' + deploymentId, 'PUT', { deploymentConfig: config });
    return api('/deployments', 'POST', config);
  }

  // ---------- Script properties (qua file tạm) ----------
  async function putFiles(files) {
    return api('/content', 'PUT', { files: files.map(f => ({ name: f.name, type: f.type, source: f.source })) });
  }

  async function createPropsFile(text) {
    const props = {};
    text.split('\n').forEach(l => {
      const i = l.indexOf('=');
      if (i > 0) { const k = l.slice(0, i).trim(); if (k) props[k] = l.slice(i + 1).trim(); }
    });
    const n = Object.keys(props).length;
    if (!n) throw new Error('Chưa có dòng KEY=giá trị nào');
    const remote = (await api('/content')).files || [];
    const src = 'function setPropsOnce() {\n' +
      '  PropertiesService.getScriptProperties().setProperties(' + JSON.stringify(props, null, 2) + ', false);\n' +
      "  Logger.log('Đã lưu " + n + " properties');\n}\n";
    await putFiles(remote.filter(f => f.name !== TMP).concat([{ name: TMP, type: 'SERVER_JS', source: src }]));
    return n;
  }

  async function removePropsFile() {
    const remote = (await api('/content')).files || [];
    await putFiles(remote.filter(f => f.name !== TMP));
  }

  // ---------- Giao diện ----------
  async function vPending() {
    const r = await getPending();
    if (!r.rows.length) return '<p>✅ Không có file nào chờ đẩy (' + r.total + ' file đã khớp với Apps Script).</p><button data-act="reload">Tải lại</button>';
    const icon = { new: '🆕 Mới', modified: '✏️ Đã sửa', deleted: '🗑️ Sẽ bị xóa' };
    let h = '<p>' + r.rows.length + ' file chờ đẩy:</p><ul>' +
      r.rows.map(x => '<li>' + icon[x.status] + ': <b>' + esc(x.name) + '</b></li>').join('') + '</ul>';
    if (r.rows.some(x => x.status === 'deleted'))
      h += '<p class="gx-warn">⚠️ File 🗑️ chỉ có trên Apps Script, không có trong web. Đẩy code sẽ xóa chúng.</p>';
    return h + '<button data-act="reload">Tải lại</button>';
  }

  async function vDeploy() {
    const all = (await api('/deployments')).deployments || [];
    const list = all.filter(x => x.deploymentConfig && x.deploymentConfig.versionNumber);
    let h = '<p class="gx-warn">Đẩy code lên trước rồi mới deploy (deploy chụp bản code đang có trên Apps Script).</p>' +
      '<input id="gx-desc" placeholder="Mô tả (tuỳ chọn)"><button data-act="new">➕ Tạo deployment mới</button>';
    h += list.map(x => {
      const w = (x.entryPoints || []).find(p => p.webApp);
      const url = w ? w.webApp.url : '';
      return '<div class="gx-card"><b>v' + x.deploymentConfig.versionNumber + '</b> ' + esc(x.deploymentConfig.description || '') +
        '<br><small>' + esc(x.updateTime || '') + '</small>' +
        (url ? '<br><a href="' + esc(url) + '" target="_blank">' + esc(url) + '</a>' : '') +
        '<br><button data-act="upd" data-id="' + esc(x.deploymentId) + '">🔄 Cập nhật version mới</button></div>';
    }).join('');
    return h || '<p>Chưa có deployment nào.</p>';
  }

  function vProps() {
    return '<p>Mỗi dòng một cặp <code>KEY=giá trị</code>:</p>' +
      '<textarea id="gx-props" rows="5" placeholder="BOT_TOKEN=123:ABC"></textarea>' +
      '<button data-act="mkprops">1) Tạo file _SetProps</button>' +
      '<p>2) Mở Apps Script → chọn file <b>_SetProps</b> → chạy hàm <b>setPropsOnce</b> (1 lần).</p>' +
      '<button data-act="rmprops">3) Xóa file _SetProps</button>' +
      '<p class="gx-warn">⚠️ Token nằm trong file tạm đến khi bạn xóa. Đừng deploy khi file này còn tồn tại.</p>';
  }

  async function render(msg) {
    const body = $('#gx-body');
    body.innerHTML = '<p>Đang tải...</p>';
    try {
      const html = tab === 'pending' ? await vPending() : tab === 'deploy' ? await vDeploy() : vProps();
      body.innerHTML = (msg ? '<p class="gx-msg">' + esc(msg) + '</p>' : '') + html;
    } catch (err) {
      body.innerHTML = '<p class="gx-err">Lỗi: ' + esc(err.message) + '</p>';
    }
  }

  async function onAct(b) {
    const act = b.dataset.act;
    if (act === 'reload') return render();
    if (act === 'new' || act === 'upd') {
      if (act === 'upd' && !confirm('Tạo version mới và cập nhật deployment này?')) return;
      const desc = (($('#gx-desc') || {}).value || '').trim() || ('Deploy ' + new Date().toLocaleString('vi-VN'));
      $('#gx-body').innerHTML = '<p>Đang deploy...</p>';
      const r = await deploy(desc, act === 'upd' ? b.dataset.id : null);
      return render('✅ Deploy xong (deploymentId: ' + r.deploymentId + ')');
    }
    if (act === 'mkprops') {
      const n = await createPropsFile($('#gx-props').value);
      return render('✅ Đã tạo file _SetProps với ' + n + ' property. Giờ chạy setPropsOnce trong Apps Script.');
    }
    if (act === 'rmprops') {
      await removePropsFile();
      return render('✅ Đã xóa file _SetProps.');
    }
  }

  function build() {
    const st = document.createElement('style');
    st.textContent =
      '#gx-fab{position:fixed;right:14px;bottom:14px;z-index:9998;padding:10px 14px;border:0;border-radius:24px;background:#1a73e8;color:#fff;font-size:15px}' +
      '#gx-sheet{position:fixed;left:0;right:0;bottom:0;max-height:80vh;overflow:auto;z-index:9999;background:#fff;color:#202124;border-radius:16px 16px 0 0;box-shadow:0 -4px 20px #0004;padding:12px;display:none;font:14px/1.4 system-ui,sans-serif}' +
      '#gx-sheet button{padding:8px 12px;margin:4px 4px 4px 0;border:1px solid #1a73e8;border-radius:8px;background:#fff;color:#1a73e8;font-size:14px}' +
      '#gx-sheet .on{background:#1a73e8;color:#fff}' +
      '#gx-sheet input,#gx-sheet textarea{width:100%;box-sizing:border-box;padding:8px;margin:4px 0;font-size:14px}' +
      '.gx-head{display:flex;justify-content:space-between;align-items:center}' +
      '.gx-card{border:1px solid #ddd;border-radius:8px;padding:8px;margin:8px 0;word-break:break-all}' +
      '.gx-warn{background:#fff8e1;padding:6px;border-radius:6px}.gx-err{color:#c5221f}.gx-msg{color:#188038}';
    document.head.appendChild(st);

    const fab = document.createElement('button');
    fab.id = 'gx-fab'; fab.textContent = '⚙️ GAS+';
    const sheet = document.createElement('div');
    sheet.id = 'gx-sheet';
    sheet.innerHTML = '<div class="gx-head"><b>GAS+</b><button id="gx-close">✕</button></div>' +
      '<div id="gx-tabs"><button data-t="pending" class="on">Chờ đẩy</button><button data-t="deploy">Deploy</button><button data-t="props">Properties</button></div>' +
      '<div id="gx-body"></div>';
    document.body.appendChild(fab);
    document.body.appendChild(sheet);

    fab.onclick = () => { sheet.style.display = 'block'; fab.style.display = 'none'; render(); };
    $('#gx-close').onclick = () => { sheet.style.display = 'none'; fab.style.display = 'block'; };
    $('#gx-tabs').onclick = e => {
      const t = e.target.dataset.t; if (!t) return;
      tab = t;
      document.querySelectorAll('#gx-tabs button').forEach(x => x.classList.toggle('on', x.dataset.t === t));
      render();
    };
    $('#gx-body').onclick = async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      try { await onAct(b); } catch (err) { $('#gx-body').innerHTML = '<p class="gx-err">Lỗi: ' + esc(err.message) + '</p>'; }
    };
  }

  global.GasExtra = {
    init: function (c) { cfg = c; build(); }
  };
})(window);
GasExtra.init({
  getToken: () => accessToken,        // access token OAuth hiện có
  getScriptId: () => scriptId,        // ID dự án Apps Script
  getLocalFiles: () => files          // [{name:'Code', type:'SERVER_JS', source:'...'}]
});
