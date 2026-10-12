(function(){
  const $ = id => document.getElementById(id);

  async function viewRemote(){
    const b = kit.panel('File trên Apps Script');
    b.textContent = 'Đang tải...';
    try {
      const j = await kit.api('GET', '/content');
      const rf = clean(j.files || []);
      b.innerHTML = '<select id="rfs"></select>' +
        '<textarea id="rft" readonly style="width:100%;height:55vh;padding:8px;font-family:monospace;font-size:13px;white-space:pre"></textarea>' +
        '<div class="row"><button id="rfuse" class="o">Nạp vào trình soạn</button></div>' +
        '<div style="font-size:13px">Nạp sẽ thay nội dung file cùng tên đang soạn (chưa đẩy lên cho đến khi bạn bấm "Đẩy lên").</div>';
      const sel = $('rfs');
      rf.forEach((f, i) => { const o = document.createElement('option'); o.value = i; o.textContent = fname(f); sel.appendChild(o); });
      const showSel = () => { $('rft').value = rf[sel.value] ? rf[sel.value].source : ''; };
      sel.onchange = showSel; showSel();
      $('rfuse').onclick = () => {
        const f = rf[sel.value]; if (!f) return;
        syncCur();
        const i = files.findIndex(x => x.name === f.name && x.type === f.type);
        if (i >= 0) { files[i].source = f.source; cur = i; } else { files.push({name: f.name, type: f.type, source: f.source}); cur = files.length - 1; }
        render(); saveDraft();
        $('kitp').remove();
        say('Đã nạp ' + fname(f) + ' vào trình soạn.');
      };
    } catch(e){ b.textContent = ''; say('Lỗi: ' + e.message); }
  }

  async function pushOne(){
    syncCur();
    const f = cur !== null ? files[cur] : null;
    if (!f) return say('Chưa chọn file');
    if (!confirm('Chỉ cập nhật file ' + fname(f) + ' lên Apps Script, các file khác trên server giữ nguyên?')) return;
    try {
      say('Đang tải bản trên server...');
      const j = await kit.api('GET', '/content');
      const remote = clean(j.files || []);
      try { localStorage.gas_backup = JSON.stringify({time: new Date().toISOString(), files: remote}); } catch(e){}
      const item = {name: f.name, type: f.type, source: f.source};
      const i = remote.findIndex(x => x.name === f.name && x.type === f.type);
      if (i >= 0) remote[i] = item; else remote.push(item);
      if (!remote.some(x => x.name === 'appsscript' && x.type === 'JSON')) throw new Error('Server thiếu appsscript.json');
      await kit.api('PUT', '/content', {files: remote});
      say('Đã lưu riêng ' + fname(f) + ' lúc ' + new Date().toLocaleTimeString());
    } catch(e){ say('Lỗi: ' + e.message); }
  }

  kit.btn('Xem file server', viewRemote);
  kit.btn('Lưu file này', pushOne);
})();
