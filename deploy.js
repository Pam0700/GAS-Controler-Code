(function(){
  const $ = id => document.getElementById(id);

  async function show(){
    const b = kit.panel('Version & Deploy');
    b.textContent = 'Đang tải...';
    try {
      const d = await kit.api('GET', '/deployments');
      let h = '<div style="font-size:13px;margin-bottom:8px">Nhớ bấm "Đẩy lên" ở trang chính trước khi deploy.</div>' +
        '<input id="dpdesc" placeholder="Mô tả phiên bản (không bắt buộc)">' +
        '<div class="row"><button class="o" id="dpnew">+ Tạo deployment mới (web app)</button></div>';
      (d.deployments || []).forEach(x => {
        const c = x.deploymentConfig || {};
        const web = (x.entryPoints || []).find(e => e.entryPointType === 'WEB_APP');
        const url = web && web.webApp && web.webApp.url;
        const head = !c.versionNumber;
        h += '<div style="border:1px solid #374151;border-radius:8px;padding:8px;margin:8px 0;font-size:13px;word-break:break-all">' +
          '<b>' + kit.esc(c.description || '(không mô tả)') + '</b><br>' +
          (head ? '@HEAD (bản đang soạn, không cập nhật được)' : 'Version ' + c.versionNumber) +
          ' · ' + kit.esc((x.updateTime || '').slice(0, 16).replace('T', ' ')) + '<br>' +
          'ID: ' + kit.esc(x.deploymentId) + '<br>' +
          (url ? 'URL: ' + kit.esc(url) + '<br>' : '') +
          (head ? '' : '<button class="dpup" data-id="' + kit.esc(x.deploymentId) + '">Cập nhật lên code mới nhất</button>') +
          '</div>';
      });
      b.innerHTML = h;
      b.querySelectorAll('.dpup').forEach(btn => btn.onclick = () => update(btn.dataset.id));
      $('dpnew').onclick = create;
    } catch(e){ b.textContent = ''; say('Lỗi: ' + e.message); }
  }

  function desc(){
    const v = $('dpdesc') ? $('dpdesc').value.trim() : '';
    return v || ('Deploy ' + new Date().toLocaleString());
  }

  async function newVersion(description){
    const v = await kit.api('POST', '/versions', {description});
    return v.versionNumber;
  }

  async function update(id){
    if (!confirm('Tạo version mới từ code hiện có trên Apps Script và gán cho deployment này?')) return;
    try {
      const description = desc();
      say('Đang tạo version...');
      const n = await newVersion(description);
      await kit.api('PUT', '/deployments/' + id, {
        deploymentConfig: {scriptId: sid(), versionNumber: n, manifestFileName: 'appsscript', description}
      });
      say('Đã deploy version ' + n);
      show();
    } catch(e){ say('Lỗi: ' + e.message); }
  }

  async function create(){
    if (!confirm('Tạo deployment mới? (Sẽ có URL /exec mới, khác URL cũ)')) return;
    try {
      const description = desc();
      say('Đang tạo version...');
      const n = await newVersion(description);
      await kit.api('POST', '/deployments', {
        scriptId: sid(), versionNumber: n, manifestFileName: 'appsscript', description
      });
      say('Đã tạo deployment mới (version ' + n + ')');
      show();
    } catch(e){ say('Lỗi: ' + e.message); }
  }

  kit.btn('Deploy', show);
})();
