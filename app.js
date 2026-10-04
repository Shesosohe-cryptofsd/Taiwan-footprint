/* ==========================================================================
   0. 全域共用：複選過濾器引擎 (Shared Multi-Select Popup)
   ========================================================================== */
let globalFilters = {
  slide: { region: [], year: [], month: [] },
  dyn: { region: [], year: [], month: [] },
  del: { region: [], year: [], month: [] },
  game: { region: [], year: [], month: [] },
  wizard: { region: [], year: [], month: [] }
};
let currentMsContext = '';
let currentMsType = '';

function initSharedMultiSelectFilters() {
  if (!document.getElementById('sharedMsModal')) {
    const m = document.createElement('div');
    m.id = 'sharedMsModal';
    m.className = 'modal-overlay';
    m.style.zIndex = '6500';
    m.innerHTML = `
      <div class="modal-card" style="max-width: 320px; padding: 16px;">
        <div class="modal-header">
          <h3 id="sharedMsTitle" style="font-size: 16px;">選擇</h3>
          <button class="close-btn" onclick="closeModal('sharedMsModal')">&times;</button>
        </div>
        <div id="sharedMsContent" style="display: flex; flex-direction: column; gap: 8px; max-height: 40vh; overflow-y: auto; margin-bottom: 14px;"></div>
        <div style="display: flex; gap: 8px; justify-content: space-between;">
          <button class="btn" style="flex: 1; padding: 6px;" onclick="sharedMsSelectAll(true)">全選</button>
          <button class="btn" style="flex: 1; padding: 6px;" onclick="sharedMsSelectAll(false)">全不選</button>
          <button class="btn btn-primary" style="flex: 1; padding: 6px;" onclick="sharedMsConfirm()">確定</button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
  }
}

function openSharedMsModal(context, type) {
  currentMsContext = context;
  currentMsType = type;
  const title = document.getElementById('sharedMsTitle');
  const content = document.getElementById('sharedMsContent');
  content.innerHTML = '';

  const { region, year, month } = globalFilters[context];
  
  // 新增：根據目前已選擇的其他條件，動態濾除無效選項以達連動合理化
  let filtered = allPhotoMetas.filter(p => {
    if (type !== 'region' && region.length > 0 && !region.includes(p.location)) return false;
    if (type !== 'year' && year.length > 0 && !year.includes(String(p.year))) return false;
    if (type !== 'month' && month.length > 0 && !month.includes(String(p.month))) return false;
    return true;
  });

  let options = [];
  let label = '';
  if (type === 'region') {
    label = '地區';
    options = [...new Set(filtered.map(p => p.location))];
  } else if (type === 'year') {
    label = '年份';
    options = [...new Set(filtered.map(p => String(p.year)))].sort((a,b)=>a-b);
  } else if (type === 'month') {
    label = '月份';
    options = [...new Set(filtered.map(p => String(p.month)))].sort((a,b)=>a-b);
  }

  title.innerText = `選擇${label} (可複選)`;
  const currentSelected = globalFilters[context][type];
  const isAll = currentSelected.length === 0 || currentSelected.length === options.length;

  options.forEach(opt => {
    const checked = isAll || currentSelected.includes(opt) ? 'checked' : '';
    content.innerHTML += `
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 4px; background: #f8f9fa; border-radius: 4px;">
        <input type="checkbox" class="shared-ms-cb" value="${opt}" ${checked} style="width: 16px; height: 16px; cursor: pointer;">
        <span style="font-size: 14px; font-weight: 600; color: #2d3436;">${opt}</span>
      </label>
    `;
  });

  openModal('sharedMsModal');
}

function sharedMsSelectAll(select) {
  document.querySelectorAll('.shared-ms-cb').forEach(cb => cb.checked = select);
}

async function sharedMsConfirm() {
  const cbs = Array.from(document.querySelectorAll('.shared-ms-cb:checked'));
  const values = cbs.map(cb => cb.value);
  globalFilters[currentMsContext][currentMsType] = values;

  const btnId = `${currentMsContext}Btn_${currentMsType}`;
  const btn = document.getElementById(btnId);
  if (btn) {
    const allOptionsLen = document.querySelectorAll('.shared-ms-cb').length;
    if (values.length === 0 || values.length === allOptionsLen) {
      btn.innerText = `全部${currentMsType === 'region' ? '地區' : currentMsType === 'year' ? '年份' : '月份'}`;
    } else {
      btn.innerText = `已選擇 (${values.length})`;
    }
  }

  closeModal('sharedMsModal');

  if (currentMsContext === 'dyn') await onDynamicFilterChange();
  else if (currentMsContext === 'del') await renderBatchDeleteList();
  else if (currentMsContext === 'game') {
    if (typeof onGameFilterChange === 'function') onGameFilterChange();
  } else if (currentMsContext === 'wizard') {
    if (typeof filterWizardPhotos === 'function') filterWizardPhotos();
  }
}

/* ==========================================================================
   12. Batch Delete Photos Feature (批次刪除照片 - 升級複選支援)
   ========================================================================== */
let batchDeleteSelectedIds = new Set();
let batchDeleteTempThumbUrls = [];

async function openBatchDeleteModal() {
  closeMenu();
  batchDeleteSelectedIds.clear();

  initSharedMultiSelectFilters();
  globalFilters.del = { region: [], year: [], month: [] };

  ['region', 'year', 'month'].forEach(t => {
    const btn = document.getElementById(`delBtn_${t}`);
    if (btn) btn.innerText = `全部${t === 'region' ? '地區' : t === 'year' ? '年份' : '月份'}`;
  });

  await renderBatchDeleteList();
  openModal('batchDeleteModal');
}

function clearBatchDeleteThumbs() {
  batchDeleteTempThumbUrls.forEach(u => URL.revokeObjectURL(u));
  batchDeleteTempThumbUrls = [];
}

function closeBatchDeleteModal() {
  clearBatchDeleteThumbs();
  batchDeleteSelectedIds.clear();
  closeModal('batchDeleteModal');
}

async function renderBatchDeleteList() {
  clearBatchDeleteThumbs();
  const container = document.getElementById('batchDeleteList');
  if (!container) return;
  container.innerHTML = '';

  const { region, year, month } = globalFilters.del;
  const isAllRegions = region.length === 0 || region.length === [...new Set(allPhotoMetas.map(p => p.location))].length;
  const isAllYears = year.length === 0 || year.length === [...new Set(allPhotoMetas.map(p => String(p.year)))].length;
  const isAllMonths = month.length === 0 || month.length === 12;

  const filtered = allPhotoMetas.filter(p => {
    if (!isAllRegions && !region.includes(p.location)) return false;
    if (!isAllYears && !year.includes(String(p.year))) return false;
    if (!isAllMonths && !month.includes(String(p.month))) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; color:#888; font-size:13px; padding:14px; text-align:center;">無符合篩選條件的照片。</div>';
    updateBatchDeleteCountUI();
    return;
  }

  for (const p of filtered) {
    const checked = batchDeleteSelectedIds.has(p.id) ? 'checked' : '';
    const blobRec = await dbGet('photoBlobs', p.id);
    let imgTag = '<div style="height:80px; background:#ddd; border-radius:4px;"></div>';
    if (blobRec && blobRec.thumbBlob) {
      const u = URL.createObjectURL(blobRec.thumbBlob);
      batchDeleteTempThumbUrls.push(u);
      imgTag = `<img src="${u}" style="width:100%; height:80px; object-fit:cover; border-radius:4px;">`;
    }

    const card = document.createElement('div');
    card.style = 'border:1px solid #dcdde1; padding:6px; border-radius:6px; background:#fff; text-align:center; font-size:12px; cursor:pointer;';
    card.innerHTML = `
      ${imgTag}
      <div style="margin: 4px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><strong>${p.location}</strong></div>
      <div style="color:#666; font-size:11px; margin-bottom:4px;">${p.year}年${p.month}月 ${p.isFavorite ? '❤️' : ''}</div>
      <label style="display:flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; font-weight:bold; color:#c0392b;">
        <input type="checkbox" class="del-photo-check" data-id="${p.id}" ${checked} onchange="toggleBatchDeleteItem('${p.id}', this.checked)"> 勾選刪除
      </label>
    `;
    container.appendChild(card);
  }
  updateBatchDeleteCountUI();
}

function toggleBatchDeleteItem(id, isChecked) {
  if (isChecked) batchDeleteSelectedIds.add(id);
  else batchDeleteSelectedIds.delete(id);
  updateBatchDeleteCountUI();
}

function batchDeleteSelectAll(selectAll) {
  const checkboxes = document.querySelectorAll('.del-photo-check');
  checkboxes.forEach(cb => {
    cb.checked = selectAll;
    const id = cb.getAttribute('data-id');
    if (selectAll) batchDeleteSelectedIds.add(id);
    else batchDeleteSelectedIds.delete(id);
  });
  updateBatchDeleteCountUI();
}

function updateBatchDeleteCountUI() {
  const el = document.getElementById('batchDeleteSelectedCount');
  if (el) el.innerText = `已勾選 ${batchDeleteSelectedIds.size} 張`;
}

async function confirmAndExecuteBatchDelete() {
  const count = batchDeleteSelectedIds.size;
  if (count === 0) {
    alert('請先勾選欲刪除的照片！');
    return;
  }


  const secondConfirm = confirm(`【再次確認刪除】\n刪除這 ${count} 張足跡照片嗎！\n確定立即執行刪除嗎？`);
  if (!secondConfirm) return;

  for (const id of batchDeleteSelectedIds) {
    await dbDelete('photoMeta', id);
    await dbDelete('photoBlobs', id);
  }

  batchDeleteSelectedIds.clear();
  await loadPhotosToMap();

  globalFilters.del = { region: [], year: [], month: [] };
  ['region', 'year', 'month'].forEach(t => {
    const btn = document.getElementById(`delBtn_${t}`);
    if (btn) btn.innerText = `全部${t === 'region' ? '地區' : t === 'year' ? '年份' : '月份'}`;
  });

  await renderBatchDeleteList();
  alert(`已成功刪除 ${count} 張足跡照片！`);
}

/* ==========================================================================
   13. Slideshow Feature (幻燈片輪播 - 升級複選支援)
   ========================================================================== */
let slideQueue = [];
let slideTimer = null;
let slideIndex = 0;
let currentSlideObjectUrl = null;

function openSlideshowConfig() {
  closeMenu();
  initSharedMultiSelectFilters();
  globalFilters.slide = { region: [], year: [], month: [] };

  ['region', 'year', 'month'].forEach(t => {
    const btn = document.getElementById(`slideBtn_${t}`);
    if (btn) btn.innerText = `全部${t === 'region' ? '地區' : t === 'year' ? '年份' : '月份'}`;
  });

  openModal('slideConfigModal');
}

function startSlideshow() {
  closeModal('slideConfigModal');
  const scope = document.getElementById('slideScope').value;
  const order = document.getElementById('slideOrder').value;

  const { region, year, month } = globalFilters.slide;
  const isAllRegions = region.length === 0 || region.length === [...new Set(allPhotoMetas.map(p => p.location))].length;
  const isAllYears = year.length === 0 || year.length === [...new Set(allPhotoMetas.map(p => String(p.year)))].length;
  const isAllMonths = month.length === 0 || month.length === 12;

  slideQueue = allPhotoMetas.filter(p => {
    if (scope === 'fav' && !p.isFavorite) return false;
    if (!isAllRegions && !region.includes(p.location)) return false;
    if (!isAllYears && !year.includes(String(p.year))) return false;
    if (!isAllMonths && !month.includes(String(p.month))) return false;
    return true;
  });

  if (slideQueue.length === 0) {
    alert('無符合條件的照片可供播放！');
    return;
  }

  if (order === 'time') {
    slideQueue.sort((a, b) => (a.year * 100 + a.month) - (b.year * 100 + b.month));
  } else if (order === 'region') {
    slideQueue.sort((a, b) => a.location.localeCompare(b.location));
  } else if (order === 'random') {
    slideQueue.sort(() => Math.random() - 0.5);
  }

  slideIndex = 0;
  document.getElementById('slideshowOverlay').classList.add('active');
  renderSlide();
  slideTimer = setInterval(nextSlide, 3500);
}

async function renderSlide() {
  const p = slideQueue[slideIndex];
  const blobRecord = await dbGet('photoBlobs', p.id);
  if (!blobRecord) return;

  if (currentSlideObjectUrl) URL.revokeObjectURL(currentSlideObjectUrl);
  currentSlideObjectUrl = URL.createObjectURL(blobRecord.displayBlob);

  const img = document.getElementById('slideshowImg');
  img.src = currentSlideObjectUrl;
  document.getElementById('slideInfo').innerText = `${p.location} • ${p.year}年${p.month}月 ${p.isFavorite ? '❤️' : ''}`;
}

function nextSlide() {
  const img = document.getElementById('slideshowImg');
  const info = document.getElementById('slideInfo');

  img.classList.add('fade-out');
  info.classList.add('fade-out');

  setTimeout(async () => {
    slideIndex = (slideIndex + 1) % slideQueue.length;
    await renderSlide();
    img.classList.remove('fade-out');
    info.classList.remove('fade-out');
  }, 400);
}

function closeSlideshow() {
  clearInterval(slideTimer);
  if (currentSlideObjectUrl) {
    URL.revokeObjectURL(currentSlideObjectUrl);
    currentSlideObjectUrl = null;
  }
  document.getElementById('slideshowOverlay').classList.remove('active');
}

/* ==========================================================================
   13-B. Dynamic Action Review Feature (行動態回顧 - 升級複選支援)
   ========================================================================== */
let dynFilteredList = [];
let dynQueue = [];
let dynConfigThumbUrls = [];
let dynActiveUrls = [];
let dynReviewLayer = null;
let dynMarkersMap = new Map();
let dynIsPlaying = false;
let dynAbortFlag = false;
let dynAnimFrameId = null;

let dynEditOrderMode = false;
let dynExcludedIds = new Set();
let dynDraggingPhotoId = null;

const DYN_ARROW_STORAGE_KEY = 'tw_dyn_custom_arrow_png';
const DYN_ARROW_IDB_KEY = '__custom_arrow_png__';
let dynCustomArrowDataUrl = localStorage.getItem(DYN_ARROW_STORAGE_KEY) || null;
const TAIWAN_FULL_BOUNDS = [[21.55, 118.0], [26.35, 122.8]];

function getDefaultArrowSvgHtml(size = 28) {
  return `
    <svg viewBox="0 0 28 28" width="${size}" height="${size}" style="display:block;">
      <path d="M4 20 L14 2 L24 20 M14 2 L14 26" fill="none" stroke="#111111" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function scalePngToFitDataUrl(imgSource, maxDim = 36) {
  const origW = imgSource.naturalWidth || imgSource.width || maxDim;
  const origH = imgSource.naturalHeight || imgSource.height || maxDim;
  let targetW = origW;
  let targetH = origH;

  if (origW > maxDim || origH > maxDim) {
    if (origW >= origH) {
      targetW = maxDim;
      targetH = Math.max(1, Math.round((origH * maxDim) / origW));
    } else {
      targetH = maxDim;
      targetW = Math.max(1, Math.round((origW * maxDim) / origH));
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = maxDim;
  canvas.height = maxDim;
  const ctx = canvas.getContext('2d');

  const offsetX = Math.round((maxDim - targetW) / 2);
  ctx.clearRect(0, 0, maxDim, maxDim);
  ctx.drawImage(imgSource, offsetX, 0, targetW, targetH);

  const dataUrl = canvas.toDataURL('image/png');
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

async function persistCustomArrowDataUrl(dataUrl) {
  dynCustomArrowDataUrl = dataUrl;
  try {
    if (dataUrl) {
      localStorage.setItem(DYN_ARROW_STORAGE_KEY, dataUrl);
      if (typeof db !== 'undefined' && db) {
        await dbPut('photoBlobs', { id: DYN_ARROW_IDB_KEY, customArrowDataUrl: dataUrl });
      }
    } else {
      localStorage.removeItem(DYN_ARROW_STORAGE_KEY);
      if (typeof db !== 'undefined' && db) {
        await dbDelete('photoBlobs', DYN_ARROW_IDB_KEY);
      }
    }
  } catch (e) {
    console.warn('儲存 arrow.png 警告:', e);
  }
  updateDynArrowSettingUI();
}

async function restorePersistedArrowPng() {
  try {
    if (typeof db !== 'undefined' && db) {
      const rec = await dbGet('photoBlobs', DYN_ARROW_IDB_KEY);
      if (rec && rec.customArrowDataUrl) {
        dynCustomArrowDataUrl = rec.customArrowDataUrl;
        localStorage.setItem(DYN_ARROW_STORAGE_KEY, dynCustomArrowDataUrl);
        updateDynArrowSettingUI();
        return;
      }
    }
    const localSaved = localStorage.getItem(DYN_ARROW_STORAGE_KEY);
    if (localSaved) {
      dynCustomArrowDataUrl = localSaved;
      if (typeof db !== 'undefined' && db) {
        await dbPut('photoBlobs', { id: DYN_ARROW_IDB_KEY, customArrowDataUrl: localSaved });
      }
      updateDynArrowSettingUI();
      return;
    }
  } catch (e) {
    console.warn('讀取已保存 arrow.png 略過:', e);
  }
  updateDynArrowSettingUI();
}

function handleDynArrowFileUploadAndSave(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const objUrl = URL.createObjectURL(file);
  const img = new Image();
  img.onload = async () => {
    const scaledDataUrl = scalePngToFitDataUrl(img, 36);
    URL.revokeObjectURL(objUrl);
    await persistCustomArrowDataUrl(scaledDataUrl);
  };
  img.onerror = () => {
    URL.revokeObjectURL(objUrl);
    alert('讀取圖片失敗，請確認檔案格式是否正確！');
  };
  img.src = objUrl;
  event.target.value = '';
}

async function resetDynArrowToDefaultSvg() {
  await persistCustomArrowDataUrl(null);
}

function updateDynArrowSettingUI() {
  const statusEl = document.getElementById('dynArrowStatusText');
  const previewBox = document.getElementById('dynArrowPreviewBox');
  if (!statusEl || !previewBox) return;

  if (dynCustomArrowDataUrl) {
    statusEl.innerText = '目前：自訂箭頭圖片 (已保存)';
    statusEl.style.color = 'var(--primary)';
    previewBox.innerHTML = `<img src="${dynCustomArrowDataUrl}" style="width:28px; height:28px; object-fit:contain; display:block;">`;
  } else {
    statusEl.innerText = '目前：預設箭頭符號';
    statusEl.style.color = '#57606f';
    previewBox.innerHTML = getDefaultArrowSvgHtml(24);
  }
}

function injectDynamicReviewUI() {
  let style = document.getElementById('dynReviewInjectedStyle');
  if (!style) {
    style = document.createElement('style');
    style.id = 'dynReviewInjectedStyle';
    document.head.appendChild(style);
  }
  style.textContent = `
    .dyn-card-item { border: 2px solid #dfe4ea; border-radius: 10px; padding: 6px; background: #fff; text-align: center; font-size: 12px; cursor: pointer; transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease; position: relative; user-select: none; }
    .dyn-card-item:hover { border-color: var(--primary); transform: translateY(-2px); }
    .dyn-card-item.is-start { border: 5px solid #2ecc71 !important; background: #f0fff4 !important; box-shadow: 0 0 0 3px rgba(46, 204, 113, 0.35), 0 6px 14px rgba(46, 204, 113, 0.22) !important; }
    .dyn-card-item.is-end { border: 5px solid #e74c3c !important; background: #fff5f5 !important; box-shadow: 0 0 0 3px rgba(231, 76, 60, 0.35), 0 6px 14px rgba(231, 76, 60, 0.22) !important; }
    .dyn-card-item.in-range { border: 2px solid #38ada9; background: #f4fbfb; }
    .dyn-badge-tag { position: absolute; left: 6px; border-radius: 6px; font-weight: 900 !important; color: #ffffff; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35); z-index: 6; pointer-events: none; letter-spacing: 0.5px; white-space: nowrap; }
    .dyn-badge-start { background: #27ae60; border: 2px solid #ffffff; }
    .dyn-badge-end { background: #c0392b; border: 2px solid #ffffff; }
    .dyn-forbid-btn { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 50%; background: rgba(255, 255, 255, 0.92); border: 1.5px solid #dcdde1; display: flex; align-items: center; justify-content: center; font-size: 15px; line-height: 1; cursor: pointer; z-index: 8; box-shadow: 0 2px 6px rgba(0,0,0,0.22); transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease; }
    .dyn-forbid-btn:hover { transform: scale(1.15); border-color: #e74c3c; background: #fff0f0; }
    .dyn-forbid-btn.active { background: #e74c3c; color: #ffffff; border-color: #ffffff; }
    .dyn-no-review-overlay { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.52); display: none; align-items: center; justify-content: center; border-radius: 4px; z-index: 5; pointer-events: none; }
    .dyn-card-item.is-excluded .dyn-no-review-overlay { display: flex; }
    .dyn-card-item.is-excluded { opacity: 0.85; border-color: #bdc3c7 !important; background: #f1f2f6 !important; }
    .dyn-no-review-text { color: #ff2e2e; background: rgba(255, 255, 255, 0.95); border: 2px solid #e74c3c; padding: 3px 8px; border-radius: 6px; font-size: 14px; font-weight: 900; letter-spacing: 1px; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4); white-space: nowrap; }
    .dyn-card-item.draggable-mode { cursor: grab !important; border-style: dashed; }
    .dyn-card-item.draggable-mode:active { cursor: grabbing !important; }
    .dyn-card-item.dragging { opacity: 0.42 !important; transform: scale(0.95) !important; border: 3px dashed var(--primary) !important; }
  `;
  ensureDynArrowSettingUIExists();
}

function ensureDynArrowSettingUIExists() {
  const modal = document.getElementById('dynamicReviewConfigModal');
  const previewGrid = document.getElementById('dynPhotoPreviewGrid');
  if (!modal || !previewGrid) return;

  let settingBar = document.getElementById('dynArrowSettingBar');
  if (!settingBar) {
    const existingPreview = document.getElementById('dynArrowPreviewBox');
    if (existingPreview && existingPreview.parentElement && existingPreview.parentElement.parentElement) {
      settingBar = existingPreview.parentElement.parentElement;
      settingBar.id = 'dynArrowSettingBar';
    } else {
      settingBar = document.createElement('div');
      settingBar.id = 'dynArrowSettingBar';
      settingBar.style.cssText = 'display: flex; gap: 10px; background: #fff9eb; padding: 8px 14px; border-radius: 8px; border: 1px solid #f3d19e; margin-bottom: 10px; flex-wrap: wrap; align-items: center; justify-content: space-between; flex-shrink: 0;';
      previewGrid.insertAdjacentElement('beforebegin', settingBar);
    }
  }

  settingBar.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <button type="button" class="btn" id="dynEditOrderBtn" style="padding: 5px 12px; font-size: 12px; border: 2px solid var(--primary); color: var(--primary); font-weight: 800;" onclick="toggleDynEditOrderMode()">
        🔀 編輯順序 (開啟拖拉排序)
      </button>
      <span id="dynEditOrderHint" style="font-size: 11px; color: #57606f; font-weight: 600;"></span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <span style="font-size: 12px; font-weight: 800; color: #b7791f;">🖼️ 箭頭圖片：</span>
      <button type="button" class="btn" style="padding: 5px 10px; font-size: 12px;" onclick="document.getElementById('dynArrowFileInput').click()">替換箭頭</button>
      <button type="button" class="btn" style="padding: 5px 10px; font-size: 12px;" onclick="resetDynArrowToDefaultSvg()">↩ 預設符號</button>
      <input type="file" id="dynArrowFileInput" accept=".png,image/png,image/*" style="display: none;" onchange="handleDynArrowFileUploadAndSave(event)">
      <span id="dynArrowStatusText" style="font-size: 11px; font-weight: 600; color: #57606f;">目前：預設箭頭符號</span>
      <div id="dynArrowPreviewBox" style="width: 32px; height: 32px; border-radius: 6px; border: 1px solid #dcdde1; background: #ffffff; display: flex; align-items: center; justify-content: center; overflow: hidden;" title="箭頭前端預覽"></div>
    </div>
  `;

  updateDynArrowSettingUI();
  updateDynEditOrderBtnUI();
  initDynGridDragEvents();
}

function updateDynEditOrderBtnUI() {
  const btn = document.getElementById('dynEditOrderBtn');
  const hint = document.getElementById('dynEditOrderHint');
  if (!btn) return;

  if (dynEditOrderMode) {
    btn.style.background = 'var(--primary)';
    btn.style.color = '#ffffff';
    btn.innerText = '✅ 完成編輯順序 (拖拉模式開啟中)';
    if (hint) {
      hint.style.color = '#d35400';
      hint.innerText = '✋ 請直接按住下方照片任意拖拉移動位置';
    }
  } else {
    btn.style.background = '#ffffff';
    btn.style.color = 'var(--primary)';
    btn.innerText = '🔀 編輯順序 (開啟拖拉排序)';
    if (hint) {
      hint.innerText = '';
    }
  }
}

function toggleDynEditOrderMode() {
  dynEditOrderMode = !dynEditOrderMode;
  updateDynEditOrderBtnUI();

  const cards = document.querySelectorAll('#dynPhotoPreviewGrid .dyn-card-item');
  cards.forEach(card => {
    card.draggable = dynEditOrderMode;
    card.classList.toggle('draggable-mode', dynEditOrderMode);
  });
}

function clearDynamicConfigThumbs() {
  dynConfigThumbUrls.forEach(u => URL.revokeObjectURL(u));
  dynConfigThumbUrls = [];
}

function clearDynamicActiveUrls() {
  dynActiveUrls.forEach(u => URL.revokeObjectURL(u));
  dynActiveUrls = [];
}

async function openDynamicReviewConfig() {
  closeMenu();
  if (allPhotoMetas.length === 0) {
    alert('目前地圖上尚無照片，請先上傳照片建立足跡！');
    return;
  }

  dynEditOrderMode = false;
  dynExcludedIds.clear();

  initSharedMultiSelectFilters();
  globalFilters.dyn = { region: [], year: [], month: [] };

  ['region', 'year', 'month'].forEach(t => {
    const btn = document.getElementById(`dynBtn_${t}`);
    if (btn) btn.innerText = `全部${t === 'region' ? '地區' : t === 'year' ? '年份' : '月份'}`;
  });

  const scSel = document.getElementById('dynScope');
  if (scSel) scSel.value = 'all';

  ensureDynArrowSettingUIExists();
  updateDynArrowSettingUI();
  await onDynamicFilterChange();
  openModal('dynamicReviewConfigModal');
}

function closeDynamicReviewConfig() {
  clearDynamicConfigThumbs();
  closeModal('dynamicReviewConfigModal');
}

async function onDynamicFilterChange() {
  clearDynamicConfigThumbs();
  dynExcludedIds.clear();

  const scope = document.getElementById('dynScope')?.value || 'all';
  const { region, year, month } = globalFilters.dyn;

  const isAllRegions = region.length === 0 || region.length === [...new Set(allPhotoMetas.map(p => p.location))].length;
  const isAllYears = year.length === 0 || year.length === [...new Set(allPhotoMetas.map(p => String(p.year)))].length;
  const isAllMonths = month.length === 0 || month.length === 12;

  dynFilteredList = allPhotoMetas.filter(p => {
    if (scope === 'fav' && !p.isFavorite) return false;
    if (!isAllRegions && !region.includes(p.location)) return false;
    if (!isAllYears && !year.includes(String(p.year))) return false;
    if (!isAllMonths && !month.includes(String(p.month))) return false;
    return true;
  }).sort((a, b) => {
    const timeDiff = (a.year * 100 + a.month) - (b.year * 100 + b.month);
    if (timeDiff !== 0) return timeDiff;
    return a.location.localeCompare(b.location);
  });

  const grid = document.getElementById('dynPhotoPreviewGrid');
  const startBtn = document.getElementById('dynStartPlayBtn');
  const summaryEl = document.getElementById('dynRangeSummary');

  if (dynFilteredList.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #888;">無符合此地區與時間條件的照片，請調整篩選條件。</div>';
    if (summaryEl) summaryEl.innerText = '共播放 0 張照片';
    if (startBtn) startBtn.disabled = true;
    return;
  }

  if (startBtn) startBtn.disabled = false;
  await renderDynamicPreviewGrid();
  updateDynamicHighlightState();
}

function getFirstAndLastActiveIndices() {
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < dynFilteredList.length; i++) {
    if (!dynExcludedIds.has(dynFilteredList[i].id)) {
      if (firstIdx === -1) firstIdx = i;
      lastIdx = i;
    }
  }
  return { firstIdx, lastIdx };
}

async function renderDynamicPreviewGrid() {
  const grid = document.getElementById('dynPhotoPreviewGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (let i = 0; i < dynFilteredList.length; i++) {
    const p = dynFilteredList[i];
    const isExcluded = dynExcludedIds.has(p.id);
    const blobRec = await dbGet('photoBlobs', p.id);

    let imgHtml = '<div style="height:80px; background:#eee; border-radius:4px;"></div>';
    if (blobRec && blobRec.thumbBlob) {
      const u = URL.createObjectURL(blobRec.thumbBlob);
      dynConfigThumbUrls.push(u);
      imgHtml = `<img src="${u}" draggable="false" style="width:100%; height:80px; object-fit:cover; border-radius:4px; display:block; pointer-events:none;">`;
    }

    const card = document.createElement('div');
    card.className = 'dyn-card-item' + (dynEditOrderMode ? ' draggable-mode' : '') + (isExcluded ? ' is-excluded' : '');
    card.id = `dyn-preview-card-${i}`;
    card.dataset.photoId = p.id;
    card.dataset.index = String(i);
    card.draggable = dynEditOrderMode;

    card.onclick = (e) => {
      if (e.target && e.target.closest('.dyn-forbid-btn')) return;
      if (!dynEditOrderMode) toggleDynExcludePhoto(p.id);
    };

    card.innerHTML = `
      <div id="dyn-badge-${i}"></div>
      <button type="button" class="dyn-forbid-btn ${isExcluded ? 'active' : ''}" title="${isExcluded ? '點擊恢復' : '點擊排除'}" onclick="toggleDynExcludePhoto('${p.id}', event)">🚫</button>
      <div style="position:relative; width:100%; height:80px; border-radius:4px; overflow:hidden;">
        ${imgHtml}
        <div class="dyn-no-review-overlay"><span class="dyn-no-review-text">不進行回顧</span></div>
      </div>
      <div class="dyn-card-title" style="margin-top:5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">#${i + 1} ${p.location}</div>
      <div style="font-size:11px; color:#666;">${p.year}年${p.month}月 ${p.isFavorite ? '❤️' : ''}</div>
    `;
    grid.appendChild(card);
  }
}

function toggleDynExcludePhoto(photoId, event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }

  if (dynExcludedIds.has(photoId)) dynExcludedIds.delete(photoId);
  else dynExcludedIds.add(photoId);

  refreshDynCardsDOMIndicesAndState();
  updateDynamicHighlightState();
}

function refreshDynCardsDOMIndicesAndState() {
  const grid = document.getElementById('dynPhotoPreviewGrid');
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('.dyn-card-item'));
  cards.forEach((card, idx) => {
    const pid = card.dataset.photoId;
    const meta = dynFilteredList[idx];
    const isExcluded = dynExcludedIds.has(pid);

    card.id = `dyn-preview-card-${idx}`;
    card.dataset.index = String(idx);
    card.classList.toggle('is-excluded', isExcluded);

    const badgeContainer = card.querySelector('[id^="dyn-badge-"]');
    if (badgeContainer) badgeContainer.id = `dyn-badge-${idx}`;

    const titleEl = card.querySelector('.dyn-card-title');
    if (titleEl && meta) titleEl.innerText = `#${idx + 1} ${meta.location}`;

    const forbidBtn = card.querySelector('.dyn-forbid-btn');
    if (forbidBtn) {
      forbidBtn.classList.toggle('active', isExcluded);
      forbidBtn.title = isExcluded ? '點擊恢復進行動態回顧' : '點擊標記為不進行回顧';
    }
  });
}

function initDynGridDragEvents() {
  const grid = document.getElementById('dynPhotoPreviewGrid');
  if (!grid || grid._hasInitDragEvents) return;
  grid._hasInitDragEvents = true;

  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.dyn-card-item');
    if (!card || !dynEditOrderMode) { e.preventDefault(); return; }
    dynDraggingPhotoId = card.dataset.photoId;
    card.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dynDraggingPhotoId);
    }
  });

  grid.addEventListener('dragover', (e) => {
    if (!dynEditOrderMode || !dynDraggingPhotoId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    const gridRect = grid.getBoundingClientRect();
    const scrollZone = 48;
    if (e.clientY - gridRect.top < scrollZone) grid.scrollTop -= 12;
    else if (gridRect.bottom - e.clientY < scrollZone) grid.scrollTop += 12;

    const draggingEl = grid.querySelector(`.dyn-card-item[data-photo-id="${dynDraggingPhotoId}"]`);
    if (!draggingEl) return;

    const targetCard = e.target.closest('.dyn-card-item');
    if (targetCard && targetCard !== draggingEl) {
      const rect = targetCard.getBoundingClientRect();
      const isAfter = (e.clientX - rect.left) > (rect.width / 2);
      if (isAfter) targetCard.insertAdjacentElement('afterend', draggingEl);
      else targetCard.insertAdjacentElement('beforebegin', draggingEl);
      return;
    }

    const allCards = Array.from(grid.querySelectorAll('.dyn-card-item:not(.dragging)'));
    if (allCards.length === 0) return;
    const firstRect = allCards[0].getBoundingClientRect();
    const lastRect = allCards[allCards.length - 1].getBoundingClientRect();

    if (e.clientY < firstRect.top || (e.clientY <= firstRect.bottom && e.clientX < firstRect.left)) {
      grid.prepend(draggingEl);
    } else if (e.clientY > lastRect.bottom || (e.clientY >= lastRect.top && e.clientX > lastRect.right)) {
      grid.appendChild(draggingEl);
    }
  });

  grid.addEventListener('drop', (e) => {
    if (!dynEditOrderMode || !dynDraggingPhotoId) return;
    e.preventDefault();
    finalizeDynDragReorder();
  });

  grid.addEventListener('dragend', () => {
    if (!dynDraggingPhotoId) return;
    finalizeDynDragReorder();
  });
}

function finalizeDynDragReorder() {
  const grid = document.getElementById('dynPhotoPreviewGrid');
  if (!grid) return;

  const draggingEl = grid.querySelector('.dyn-card-item.dragging');
  if (draggingEl) draggingEl.classList.remove('dragging');
  dynDraggingPhotoId = null;

  const orderedIds = Array.from(grid.querySelectorAll('.dyn-card-item')).map(c => c.dataset.photoId);
  const metaMap = new Map(dynFilteredList.map(p => [p.id, p]));
  const newList = [];
  orderedIds.forEach(id => { if (metaMap.has(id)) newList.push(metaMap.get(id)); });

  if (newList.length === dynFilteredList.length) dynFilteredList = newList;

  refreshDynCardsDOMIndicesAndState();
  updateDynamicHighlightState();
}

function updateDynamicHighlightState() {
  if (dynFilteredList.length === 0) return;
  const { firstIdx, lastIdx } = getFirstAndLastActiveIndices();
  const startBtn = document.getElementById('dynStartPlayBtn');
  const summaryEl = document.getElementById('dynRangeSummary');

  let activeCount = 0;
  for (let i = 0; i < dynFilteredList.length; i++) {
    if (!dynExcludedIds.has(dynFilteredList[i].id)) activeCount++;
  }

  if (activeCount === 0 || firstIdx === -1) {
    if (summaryEl) summaryEl.innerText = '共播放 0 張';
    if (startBtn) startBtn.disabled = true;
  } else {
    if (summaryEl) summaryEl.innerText = `共播放 ${activeCount} 張`;
    if (startBtn) startBtn.disabled = false;
  }

  for (let i = 0; i < dynFilteredList.length; i++) {
    const card = document.getElementById(`dyn-preview-card-${i}`);
    const badge = document.getElementById(`dyn-badge-${i}`);
    if (!card || !badge) continue;

    const isExcluded = dynExcludedIds.has(dynFilteredList[i].id);
    card.classList.remove('is-start', 'is-end', 'in-range');
    card.classList.toggle('is-excluded', isExcluded);
    badge.innerHTML = '';

    if (isExcluded) continue;

    // 加入 width: max-content 防止「最後一張」折行
    if (i === firstIdx && i === lastIdx) {
      card.classList.add('is-start', 'is-end');
      badge.innerHTML = `<span class="dyn-badge-tag dyn-badge-start" style="top: 6px;">🚩 第一張</span><span class="dyn-badge-tag dyn-badge-end" style="top: auto; bottom: 6px; left: 6px; width: max-content;">🏁 最後一張</span>`;
    } else if (i === firstIdx) {
      card.classList.add('is-start');
      badge.innerHTML = '<span class="dyn-badge-tag dyn-badge-start" style="top: 6px;">🚩 第一張</span>';
	} else if (i === lastIdx) {
      card.classList.add('is-end');
      // 加上 bottom: auto; 覆蓋 CSS，解除 top 與 bottom 同時存在的垂直拉伸
      badge.innerHTML = '<span class="dyn-badge-tag dyn-badge-end" style="top: 6px; bottom: auto; width: max-content;">🏁 最後一張</span>';
    } else if (i > firstIdx && i < lastIdx) {
      card.classList.add('in-range');
    }
  }
}

function dynSleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function showDynamicBannerText(text, holdDuration = 1300) {
  const banner = document.getElementById('dynBannerBox');
  if (!banner) return;
  banner.innerText = text;
  banner.classList.add('show');
  await dynSleep(holdDuration);
  banner.classList.remove('show');
  await dynSleep(480);
}

function computePngTiltAngle(dLatDt, dLngDt, t) {
  const totalSpeed = Math.hypot(dLatDt, dLngDt) || 1e-6;
  const horizRatio = dLngDt / totalSpeed;
  const arcPitch = (0.5 - t) * 0.65;
  const rawTilt = (horizRatio * 12) + (horizRatio >= 0 ? arcPitch * 6 : -arcPitch * 6);
  return Math.max(-15, Math.min(15, rawTilt));
}

function createDynamicArrowHeadIcon(angleDeg) {
  const innerVisual = dynCustomArrowDataUrl
    ? `<img src="${dynCustomArrowDataUrl}" alt="arrow">`
    : getDefaultArrowSvgHtml(28);

  return L.divIcon({
    className: 'dyn-arrow-icon',
    html: `<div style="width:36px; height:36px; display:flex; align-items:flex-start; justify-content:center; transform-origin: 18px 2px; transform: rotate(${angleDeg}deg);">${innerVisual}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 2]
  });
}

async function startDynamicReviewPlayback() {
  const { firstIdx, lastIdx } = getFirstAndLastActiveIndices();
  if (firstIdx === -1 || lastIdx === -1) { alert('沒有可播放的照片！'); return; }

  dynQueue = dynFilteredList.slice(firstIdx, lastIdx + 1).filter(p => !dynExcludedIds.has(p.id));

  if (dynQueue.length === 0) { alert('沒有可播放的照片！'); return; }

  const startTextEl = document.getElementById('dynStartTextInput');
  const endTextEl = document.getElementById('dynEndTextInput');
  const startText = startTextEl ? startTextEl.value.trim() : '';
  const endText = endTextEl ? endTextEl.value.trim() : '';

  closeDynamicReviewConfig();

  dynIsPlaying = true;
  dynAbortFlag = false;
  clearDynamicActiveUrls();

  const topNav = document.querySelector('.top-nav');
  if (topNav) topNav.style.display = 'none';
  if (clusterGroup && map.hasLayer(clusterGroup)) map.removeLayer(clusterGroup);
  if (typeof unclusteredLayer !== 'undefined' && unclusteredLayer && map.hasLayer(unclusteredLayer)) map.removeLayer(unclusteredLayer);

  if (dynReviewLayer) map.removeLayer(dynReviewLayer);
  dynReviewLayer = L.layerGroup().addTo(map);
  dynMarkersMap.clear();

  for (const p of dynQueue) {
    const m = L.marker([p.lat, p.lng], { icon: createMarkerIcon(p.markerType || currentMarkerType), interactive: false }).addTo(dynReviewLayer);
    dynMarkersMap.set(p.id, m);
  }

  const hud = document.getElementById('dynPlaybackHUD');
  const topBar = document.getElementById('dynTopBar');
  const progText = document.getElementById('dynProgressText');
  hud.classList.add('active');
  topBar.style.display = 'flex';

  const firstPhoto = dynQueue[0];
  const maxZ = map.getMaxZoom() || 13;
  map.setView([firstPhoto.lat, firstPhoto.lng], maxZ, { animate: true });
  await dynSleep(550);

  progText.innerText = `🧭 準備出發 (${dynQueue.length} 張足跡照片)`;
  if (startText) await showDynamicBannerText(startText, 1400);
  else await showDynamicBannerText('Ready~GO出發', 1350);

  for (let i = 0; i < dynQueue.length; i++) {
    if (dynAbortFlag) break;

    const currentPhoto = dynQueue[i];
    progText.innerText = `📍 足跡 ${i + 1} / ${dynQueue.length}：${currentPhoto.location} (${currentPhoto.year}年${currentPhoto.month}月)`;

    await presentPhotoSchemeB(currentPhoto);
    if (dynAbortFlag) break;

    if (i < dynQueue.length - 1) {
      const nextPhoto = dynQueue[i + 1];
      progText.innerText = `🧭 移動中：${currentPhoto.location} ➔ ${nextPhoto.location}`;
      await animateCurvedArrowTransition(currentPhoto, nextPhoto);
    }
  }

  if (!dynAbortFlag) {
    progText.innerText = `🏁 足跡回顧完成！`;
    if (endText) await showDynamicBannerText(endText, 1450);
    else await showDynamicBannerText('End', 1400);
  }

  await cleanupDynamicReviewState();
}

async function presentPhotoSchemeB(photo) {
  const blobRec = await dbGet('photoBlobs', photo.id);
  if (!blobRec) return;

  const dispUrl = URL.createObjectURL(blobRec.displayBlob);
  const thumbUrl = URL.createObjectURL(blobRec.thumbBlob || blobRec.displayBlob);
  dynActiveUrls.push(dispUrl, thumbUrl);

  const maxZ = map.getMaxZoom() || 13;
  if (map.getZoom() < maxZ) map.setView([photo.lat, photo.lng], maxZ, { animate: true });
  else map.panTo([photo.lat, photo.lng], { animate: true });

  const marker = dynMarkersMap.get(photo.id);
  if (marker) {
    const popupHtml = `
      <div style="width: 145px; text-align: center; font-size: 13px;">
        <img src="${thumbUrl}" style="width: 100%; height: 92px; object-fit: cover; border-radius: 6px; margin-bottom: 6px; display: block;">
        <strong style="font-size: 14px; color: #2d3436;">${photo.location}</strong><br>
        <span style="color: #666; font-size: 11px;">${photo.year}/${photo.month} ${photo.isFavorite ? '❤️' : ''}</span>
      </div>
    `;
    marker.bindPopup(popupHtml, { className: 'dyn-map-popup', closeButton: true, autoPan: false, offset: [0, -28] }).openPopup();
  }

  const fsCard = document.getElementById('dynFullscreenCard');
  const fsImg = document.getElementById('dynFullscreenImg');
  const fsCap = document.getElementById('dynFullscreenCaption');

  fsImg.src = dispUrl;
  fsCap.innerText = `📍 ${photo.location} • ${photo.year}年${photo.month}月 ${photo.isFavorite ? '❤️' : ''}`;
  fsCard.classList.remove('shrink-to-map');
  fsCard.classList.add('show');

  await dynSleep(2100);
  if (dynAbortFlag) { fsCard.classList.remove('show'); return; }

  fsCard.classList.add('shrink-to-map');
  fsCard.classList.remove('show');

  await dynSleep(1250);
}

async function animateCurvedArrowTransition(fromPhoto, toPhoto) {
  const fromMarker = dynMarkersMap.get(fromPhoto.id);
  if (fromMarker) fromMarker.closePopup();

  await dynSleep(250);
  if (dynAbortFlag) return;

  const maxZ = map.getMaxZoom() || 13;
  const isSameRegion = (fromPhoto.location === toPhoto.location);

  if (!isSameRegion) {
    map.flyToBounds(TAIWAN_FULL_BOUNDS, { duration: 0.95, padding: [20, 20] });
    await dynSleep(1050);
    if (dynAbortFlag) return;
  } else {
    if (map.getZoom() < maxZ) map.setView([fromPhoto.lat, fromPhoto.lng], maxZ, { animate: false });
  }

  const lat1 = fromPhoto.lat, lng1 = fromPhoto.lng;
  const lat2 = toPhoto.lat, lng2 = toPhoto.lng;
  const dLat = lat2 - lat1, dLng = lng2 - lng1;
  const dist = Math.hypot(dLat, dLng);
  const midLat = (lat1 + lat2) / 2, midLng = (lng1 + lng2) / 2;
  const minArc = isSameRegion ? 0.008 : 0.14;
  const arcSpan = Math.max(dist * 0.45, minArc);
  const ctrlLat = midLat + arcSpan * 0.85;
  const ctrlLng = midLng + (dLat >= 0 ? -arcSpan * 0.22 : arcSpan * 0.22);

  const trailLine = L.polyline([[lat1, lng1]], { color: '#111111', weight: 3.5, opacity: 0.6, lineCap: 'round', lineJoin: 'round' ,className: 'dyn-trail-line'}).addTo(dynReviewLayer);
  const arrowMarker = L.marker([lat1, lng1], { icon: createDynamicArrowHeadIcon(0), zIndexOffset: 2000, interactive: false }).addTo(dynReviewLayer);

  const duration = isSameRegion ? Math.min(1900, Math.max(1200, dist * 4500)) : Math.min(2400, Math.max(1600, dist * 1300));
  const startTime = performance.now();
  const pathCoords = [[lat1, lng1]];
  let lastAngleDeg = 0;

  await new Promise(resolve => {
    function stepFrame(now) {
      if (dynAbortFlag) { resolve(); return; }

      const rawT = Math.min(1, (now - startTime) / duration);
      const t = rawT < 0.5 ? 2 * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
      const invT = 1 - t;
      
      const curLat = rawT === 1 ? lat2 : (invT * invT * lat1 + 2 * invT * t * ctrlLat + t * t * lat2);
      const curLng = rawT === 1 ? lng2 : (invT * invT * lng1 + 2 * invT * t * ctrlLng + t * t * lng2);
      const dLatDt = 2 * invT * (ctrlLat - lat1) + 2 * t * (lat2 - ctrlLat);
      const dLngDt = 2 * invT * (ctrlLng - lng1) + 2 * t * (lng2 - ctrlLng);

      if (dynCustomArrowDataUrl) {
        lastAngleDeg = rawT === 1 ? 0 : computePngTiltAngle(dLatDt, dLngDt, t);
      } else if (Math.hypot(dLatDt, dLngDt) > 1e-9) {
        lastAngleDeg = Math.atan2(dLngDt, dLatDt) * (180 / Math.PI);
      }

      pathCoords.push([curLat, curLng]);
      trailLine.setLatLngs(pathCoords);
      arrowMarker.setLatLng([curLat, curLng]);
      arrowMarker.setIcon(createDynamicArrowHeadIcon(lastAngleDeg));

      if (isSameRegion) map.panTo([curLat, curLng], { animate: false });

      if (rawT < 1) dynAnimFrameId = requestAnimationFrame(stepFrame);
      else resolve();
    }
    dynAnimFrameId = requestAnimationFrame(stepFrame);
  });

  if (dynAbortFlag) {
    if (dynReviewLayer) { dynReviewLayer.removeLayer(trailLine); dynReviewLayer.removeLayer(arrowMarker); }
    return;
  }

  arrowMarker.setLatLng([lat2, lng2]);
  if (dynCustomArrowDataUrl) arrowMarker.setIcon(createDynamicArrowHeadIcon(0));

  if (!isSameRegion) {
    await dynSleep(260);
    if (!dynAbortFlag) { map.flyTo([lat2, lng2], maxZ, { duration: 0.85 }); await dynSleep(900); }
  } else {
    await dynSleep(350);
  }

  if (dynReviewLayer) { dynReviewLayer.removeLayer(trailLine); dynReviewLayer.removeLayer(arrowMarker); }
}

function stopDynamicReview() {
  dynAbortFlag = true;
  if (dynAnimFrameId) { cancelAnimationFrame(dynAnimFrameId); dynAnimFrameId = null; }
  cleanupDynamicReviewState();
}

async function cleanupDynamicReviewState() {
  dynIsPlaying = false;
  clearDynamicActiveUrls();

  const hud = document.getElementById('dynPlaybackHUD');
  const topBar = document.getElementById('dynTopBar');
  const banner = document.getElementById('dynBannerBox');
  const fsCard = document.getElementById('dynFullscreenCard');
  const fsImg = document.getElementById('dynFullscreenImg');

  if (hud) hud.classList.remove('active');
  if (topBar) topBar.style.display = 'none';
  if (banner) banner.classList.remove('show');
  if (fsCard) fsCard.classList.remove('show', 'shrink-to-map');
  if (fsImg) fsImg.removeAttribute('src');

  if (dynReviewLayer) { map.removeLayer(dynReviewLayer); dynReviewLayer = null; }
  dynMarkersMap.clear();

  const topNav = document.querySelector('.top-nav');
  if (topNav) topNav.style.display = 'flex';
  await loadPhotosToMap();
}

/* ==========================================================================
   16. Settings, Default Marker Sync, Display Mode & Chunked Stream Backup System
   ========================================================================== */
let isExifDebugEnabled = localStorage.getItem('tw_exif_debug_mode') === 'true';

function toggleExifDebugMode() {
  isExifDebugEnabled = !isExifDebugEnabled;
  localStorage.setItem('tw_exif_debug_mode', isExifDebugEnabled);
  const statusEl = document.getElementById('exifDebugStatus');
  if (statusEl) {
    statusEl.innerText = isExifDebugEnabled ? '目前狀態：開啟中 (請按 F12 查看主控台)' : '目前狀態：關閉';
    statusEl.style.color = isExifDebugEnabled ? '#e74c3c' : '#57606f';
  }
  console.log(`[系統] EXIF 除錯模式已${isExifDebugEnabled ? '開啟' : '關閉'}`);
}

function ensureSettingsDisplayModeUIExists() {
  // HTML 已直接更新，此處保留空函式以防報錯
}

function openSettingsModal() {
  closeMenu();
  document.getElementById('defaultMarkerIcon').value = currentMarkerType;
  const modeSel = document.getElementById('markerDisplayModeSelect');
  if (modeSel && typeof markerDisplayMode !== 'undefined') {
    modeSel.value = markerDisplayMode;
  }
  
  const exifStatusEl = document.getElementById('exifDebugStatus');
  if (exifStatusEl) {
    exifStatusEl.innerText = isExifDebugEnabled ? '目前狀態：開啟中 (請按 F12 查看主控台)' : '目前狀態：關閉';
    exifStatusEl.style.color = isExifDebugEnabled ? '#e74c3c' : '#57606f';
  }
  
  openModal('settingsModal');
}

function setDefaultMarker(val) {
  currentMarkerType = val;
  localStorage.setItem('tw_default_marker_type', val);
}

async function setMarkerDisplayMode(mode) {
  markerDisplayMode = (mode === 'all') ? 'all' : 'cluster';
  localStorage.setItem('tw_marker_display_mode', markerDisplayMode);
  await loadPhotosToMap();
}

async function applyDefaultMarkerToAllExisting() {
  const selectedVal = document.getElementById('defaultMarkerIcon').value;
  setDefaultMarker(selectedVal);

  if (allPhotoMetas.length === 0) {
    alert('目前已儲存預設風格（地圖上尚無現有照片）。');
    return;
  }
  if (!confirm(`確定將地圖上現有的 ${allPhotoMetas.length} 張照片標記全部改為此符號風格嗎？`)) return;

  for (const p of allPhotoMetas) {
    p.markerType = selectedVal;
    await dbPut('photoMeta', p);
  }
  await loadPhotosToMap();
  alert('已套用至地圖上所有現有照片！');
}

async function confirmSettingsModal() {
  const selectedVal = document.getElementById('defaultMarkerIcon').value;
  setDefaultMarker(selectedVal);

  const modeSel = document.getElementById('markerDisplayModeSelect');
  if (modeSel) await setMarkerDisplayMode(modeSel.value);
  closeModal('settingsModal');
}

async function exportData() {
  const exportBtn = document.getElementById('exportBtn');
  exportBtn.disabled = true;
  exportBtn.innerText = '⏳ 正在打包備份...';

  try {
    const metas = await dbGetAll('photoMeta');
    const games = await dbGetAll('customGames');
    const blobParts = [];
    blobParts.push(`{"photoMeta":${JSON.stringify(metas)},"customGames":${JSON.stringify(games)},"customArrowPng":${JSON.stringify(dynCustomArrowDataUrl || null)},"exportDate":${JSON.stringify(new Date().toISOString())},"photoBlobs":[`);

    for (let i = 0; i < metas.length; i++) {
      const b = await dbGet('photoBlobs', metas[i].id);
      if (b && b.thumbBlob && b.displayBlob) {
        const itemJson = JSON.stringify({ id: b.id, thumb: await blobToBase64(b.thumbBlob), display: await blobToBase64(b.displayBlob) });
        if (i > 0) blobParts.push(',');
        blobParts.push(itemJson);
      }
      await new Promise(r => setTimeout(r, 5));
    }

    blobParts.push(']}');
    const outBlob = new Blob(blobParts, { type: 'application/json' });
    const url = URL.createObjectURL(outBlob);
	const d = new Date();
    const a = document.createElement('a');
	const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    a.href = url;
    a.download = `taiwan_footprint_backup_${y}/${m}/${day}_${String(Date.now()).slice(-5)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerText = '📥 匯出完整資料 (JSON)';
  }
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64) {
  const parts = b64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) uInt8Array[i] = raw.charCodeAt(i);
  return new Blob([uInt8Array], { type: contentType });
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const json = JSON.parse(evt.target.result);
      if (json.photoMeta) for (const m of json.photoMeta) await dbPut('photoMeta', m);
      if (json.photoBlobs) {
        for (const b of json.photoBlobs) {
          await dbPut('photoBlobs', { id: b.id, thumbBlob: base64ToBlob(b.thumb), displayBlob: base64ToBlob(b.display) });
          await new Promise(r => setTimeout(r, 5));
        }
      }
      if (json.customGames) for (const g of json.customGames) await dbPut('customGames', g);
      if (json.customArrowPng) await persistCustomArrowDataUrl(json.customArrowPng);
      alert('資料成功還原！');
      closeModal('settingsModal');
      await loadPhotosToMap();
    } catch (err) {
      alert('匯入失敗：檔案格式損毀！');
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   17. UI Helpers & App Bootstrap
   ========================================================================== */
function toggleMenu() { document.getElementById('dropdownMenu').classList.toggle('active'); }
function closeMenu() { document.getElementById('dropdownMenu').classList.remove('active'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

window.addEventListener('DOMContentLoaded', async () => {
  if (typeof injectExtendedGameModeOptions === 'function') injectExtendedGameModeOptions();
  await loadAndParseTopoJSON();
  await initDB();
  await restorePersistedArrowPng();
  injectDynamicReviewUI();
  ensureSettingsDisplayModeUIExists();
  initMap();
  await loadPhotosToMap();
});