(function () {
  const config = window.ShipmentETAConfig || {};
  const productionUrl = (config.apiBaseUrl || 'https://cdcapi.onrender.com/api').replace(/\/$/, '');
  const localUrl = (config.apiBaseUrlLocal || 'http://localhost:3001/api').replace(/\/$/, '');

  function tryUrl(url, options) {
    return fetch(url, options).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || res.statusText);
        return data;
      });
    });
  }

  // Try local API first so local backend logs appear when running npm start; fall back to production if local fails
  function apiRequest(path, optionsOrGetter) {
    const opts = typeof optionsOrGetter === 'function' ? optionsOrGetter() : (optionsOrGetter || {});
    return tryUrl(localUrl + path, opts).catch(function (err) {
      const retryOpts = typeof optionsOrGetter === 'function' ? optionsOrGetter() : opts;
      return tryUrl(productionUrl + path, retryOpts);
    });
  }

  const el = {
    database: document.getElementById('database'),
    file: document.getElementById('file'),
    btnUpload: document.getElementById('btn-upload'),
    btnRefresh: document.getElementById('btn-refresh'),
    statusMessage: document.getElementById('statusMessage'),
    tableBody: document.getElementById('tableBody'),
    emptyState: document.getElementById('emptyState'),
    loadingState: document.getElementById('loadingState'),
    tableWrap: document.getElementById('tableWrap')
  };

  function showStatus(msg, type) {
    el.statusMessage.textContent = msg;
    el.statusMessage.className = 'status-message ' + (type === 'error' ? 'error' : 'success');
    el.statusMessage.classList.remove('hidden');
  }

  function hideStatus() {
    el.statusMessage.classList.add('hidden');
  }

  function setLoading(loading) {
    if (loading) {
      el.loadingState.classList.remove('hidden');
      el.emptyState.classList.add('hidden');
      el.tableWrap.classList.add('hidden');
    } else {
      el.loadingState.classList.add('hidden');
    }
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleString();
    } catch (_) {
      return iso;
    }
  }

  function renderList(rows) {
    setLoading(false);
    if (!rows || rows.length === 0) {
      el.tableWrap.classList.add('hidden');
      el.emptyState.classList.remove('hidden');
      el.tableBody.innerHTML = '';
      return;
    }
    el.emptyState.classList.add('hidden');
    el.tableWrap.classList.remove('hidden');
    el.tableBody.innerHTML = rows.map(function (r) {
      const linkCell = r.link
        ? '<a href="' + escapeHtml(r.link) + '" target="_blank" rel="noopener">' + escapeHtml(truncate(r.link, 50)) + '</a>'
        : '—';
      const statusVal = r.status != null ? Number(r.status) : 0;
      const statusDisplay = statusVal === 1 ? '1 (Matched)' : '0 (Not matched)';
      const rowClass = statusVal === 1 ? ' class="row-matched"' : '';
      return (
        '<tr' + rowClass + '>' +
        '<td>' + escapeHtml(String(r.id)) + '</td>' +
        '<td>' + escapeHtml(r.containerNumber || '—') + '</td>' +
        '<td>' + escapeHtml(r.destinationPort || '—') + '</td>' +
        '<td>' + escapeHtml(r.destinationArrivalOriginalPlannedDate || '—') + '</td>' +
        '<td>' + escapeHtml(r.destinationArrivalPlannedDate || '—') + '</td>' +
        '<td class="col-link">' + linkCell + '</td>' +
        '<td>' + escapeHtml(statusDisplay) + '</td>' +
        '<td>' + escapeHtml(formatDate(r.createdAt)) + '</td>' +
        '</tr>'
      );
    }).join('');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function truncate(s, len) {
    if (!s || s.length <= len) return s || '';
    return s.slice(0, len) + '…';
  }

  function loadList() {
    const db = (el.database && el.database.value) || 'KOL';
    setLoading(true);
    apiRequest('/shipment-eta/list?database=' + encodeURIComponent(db))
      .then(renderList)
      .catch(function (err) {
        setLoading(false);
        el.tableWrap.classList.add('hidden');
        el.emptyState.classList.remove('hidden');
        el.emptyState.textContent = 'Error: ' + (err.message || 'Failed to load');
      });
  }

  el.btnUpload.addEventListener('click', function () {
    const file = el.file && el.file.files[0];
    if (!file) {
      showStatus('Please select an Excel file.', 'error');
      return;
    }
    const db = (el.database && el.database.value) || 'KOL';
    hideStatus();
    el.btnUpload.disabled = true;
    apiRequest('/shipment-eta/upload', function () {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('database', db);
      return { method: 'POST', body: formData };
    })
      .then(function (data) {
        showStatus(data.message || 'Import successful.', 'success');
        el.file.value = '';
        loadList();
      })
      .catch(function (err) {
        showStatus(err.message || 'Upload failed.', 'error');
      })
      .finally(function () {
        el.btnUpload.disabled = false;
      });
  });

  el.btnRefresh.addEventListener('click', function () {
    hideStatus();
    loadList();
  });

  el.database.addEventListener('change', loadList);

  loadList();
})();
