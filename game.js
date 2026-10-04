/* ==========================================================================
   14. Quiz Engine (9 Presentation & Gameplay Modes: 1 ~ 9)
       + 支援區域/年份/月份/最愛篩選、照片即時預覽勾選、左右拉動捲軸連動
   ========================================================================== */
const ALLOWED_MODES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const GAME_MODES_CATALOG = [
  { value: 'all', label: '🎲 全部 9 種模式隨機輪播 (1~9)' },
  { value: '1',   label: '模式 1：原圖提問' },
  { value: '2',   label: '模式 2：九宮格遮蔽' },
  { value: '3',   label: '模式 3：刮刮樂除污' },
  { value: '4',   label: '模式 4：手電筒夜視（暗房探照）' },
  { value: '5',   label: '模式 5：鏡像萬花筒（空間顛倒）' },
  { value: '6',   label: '模式 6：負片／老照片褪色（色彩干擾）' },
  { value: '7',   label: '模式 7：8-Bit 像素馬賽克（動態解析）' },
  { value: '8',   label: '模式 8：滑塊拼圖／九宮格錯位（可點擊交換）' },
  { value: '9',   label: '模式 9：素描線稿化（邊緣偵測）' }
];

let gameType = 'casual';
let quizPool = [];
let currentQuizIndex = 0;
let score = 80;
let consecutiveErrors = 0;
let questionStartTime = 0;
let currentQuizItem = null;
let usedMetasForReview = [];
let currentQuizObjectUrl = null;
let reviewThumbUrls = [];
let failAutoExitTimer = null;
let failCountdownInterval = null;

// 休閒/挑戰模式：篩選與即時預覽勾選狀態
let gameFilteredPhotos = [];
let gameSelectedPhotoIds = new Set();
let gameConfigThumbUrls = [];

// Active Mode Resource Tracker (Cleaned up before every question & exit)
let activeModeInterval = null;

function buildGameModeOptionsHTML(selectedVal = 'all') {
  const safeVal = (selectedVal === 'all' || ALLOWED_MODES.includes(parseInt(selectedVal, 10)))
    ? String(selectedVal)
    : 'all';
  return GAME_MODES_CATALOG.map(m =>
    `<option value="${m.value}" ${safeVal === m.value ? 'selected' : ''}>${m.label}</option>`
  ).join('');
}

function injectExtendedGameModeOptions() {
  ensureGameConfigModalUpgraded();
  const sel = document.getElementById('gameModeSelection');
  if (sel) sel.innerHTML = buildGameModeOptionsHTML('all');
}

// 自動檢查並升級 #gameConfigModal，確保「篩選器 + 照片即時預覽勾選 + 左右拉動捲軸」100% 呈現
function ensureGameConfigModalUpgraded() {
  const modal = document.getElementById('gameConfigModal');
  if (!modal) return;

  if (!document.getElementById('gamePhotoPreviewGrid')) {
    modal.innerHTML = `
      <div class="modal-card tall-modal" style="max-width: 900px;">
        <div class="modal-header">
          <h3 id="gameModalTitle">小遊戲設定</h3>
          <button class="close-btn" onclick="closeGameConfigModal()">&times;</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 10px; flex-shrink: 0;">
          <div>
            <label style="font-size:12px; font-weight:700; color:#57606f; display:block; margin-bottom:4px;">1. 篩選地區</label>
            <button type="button" id="btnGameRegion" class="btn" style="width:100%; justify-content:space-between; padding:7px; border-radius:6px; border:1px solid #ced6e0;" onclick="openSharedMsModal('game', 'region')">全部地區 ▼</button>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#57606f; display:block; margin-bottom:4px;">2. 篩選年份</label>
            <button type="button" id="btnGameYear" class="btn" style="width:100%; justify-content:space-between; padding:7px; border-radius:6px; border:1px solid #ced6e0;" onclick="openSharedMsModal('game', 'year')">全部年份 ▼</button>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#57606f; display:block; margin-bottom:4px;">3. 篩選月份</label>
            <button type="button" id="btnGameMonth" class="btn" style="width:100%; justify-content:space-between; padding:7px; border-radius:6px; border:1px solid #ced6e0;" onclick="openSharedMsModal('game', 'month')">全部月份 ▼</button>
          </div>
          <div>
            <label style="font-size:12px; font-weight:700; color:#57606f; display:block; margin-bottom:4px;">4. 最愛篩選</label>
            <select id="gameFilterFav" onchange="onGameFilterChange()" style="width:100%; padding:7px; border-radius:6px; border:1px solid #ced6e0;">
              <option value="all">全部照片</option>
              <option value="fav">僅最愛照片 ❤️</option>
            </select>
          </div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 8px; align-items: center; justify-content: space-between; flex-wrap: wrap; flex-shrink: 0; background: #f1f8f7; padding: 8px 12px; border-radius: 8px; border: 1px solid #b8e0dd;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn" style="padding: 5px 12px; font-size: 12px;" onclick="gameSelectAllPhotos(true)">✓ 全部勾選</button>
            <button type="button" class="btn" style="padding: 5px 12px; font-size: 12px;" onclick="gameSelectAllPhotos(false)">✗ 全部取消勾選</button>
            <span id="gameSelectedPhotoCount" style="font-size: 13px; font-weight: 800; color: var(--primary); margin-left: 4px;">已勾選 0 張作為題庫</span>
          </div>
          <span style="font-size: 11px; color: #57606f;">(點擊下方照片可單獨勾選 / 取消勾選)</span>
        </div>

        <div id="gamePhotoPreviewGrid" class="tall-scroll-area" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); grid-auto-rows: max-content; gap: 10px; margin-bottom: 10px;"></div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; flex-shrink: 0; align-items: end;">
          <div class="form-group" style="margin-bottom: 0;">
            <label id="gameQuestionCountLabel">題目數量 (左右拉動捲軸或點擊快捷鍵)</label>
            <div class="slider-control-wrap">
              <input type="range" id="gameQuestionSlider" min="1" max="50" value="10" oninput="syncGameQuestionCount('slider')" style="flex:1; width:100% !important; padding:0 !important; border:none !important; height:8px !important; accent-color:var(--primary); cursor:pointer;">
              <input type="number" id="gameQuestionCount" min="1" max="50" value="10" oninput="syncGameQuestionCount('number')" style="width:82px !important; text-align:center; font-weight:700; color:var(--primary); padding:6px 8px !important;">
            </div>
            <div class="quick-count-btns">
              <button type="button" onclick="setQuickQuestionCount('default')">預設題數 (10)</button>
              <button type="button" onclick="setQuickQuestionCount('half')">半數 (50%)</button>
              <button type="button" onclick="setQuickQuestionCount('max')">全部已勾選照片 (Max)</button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label>題型呈現方式 (共 9 種視覺與解謎特效)</label>
            <select id="gameModeSelection">
              ${buildGameModeOptionsHTML('all')}
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 12px; flex-shrink: 0;">
          <button type="button" class="btn" onclick="closeGameConfigModal()">取消返回</button>
          <button type="button" class="btn btn-primary" id="gameLaunchBtn" style="min-width: 220px; justify-content: center;" onclick="launchGame()">🚀 開始遊戲</button>
        </div>
      </div>
    `;
  }
}

function clearGameConfigThumbs() {
  gameConfigThumbUrls.forEach(u => URL.revokeObjectURL(u));
  gameConfigThumbUrls = [];
}

function closeGameConfigModal() {
  clearGameConfigThumbs();
  closeModal('gameConfigModal');
}

async function openGameConfig(type) {
  closeMenu();
  if (allPhotoMetas.length === 0) {
    alert('請先上傳照片建立足跡！');
    return;
  }

  ensureGameConfigModalUpgraded();
  gameType = type;
  document.getElementById('gameModalTitle').innerText =
    type === 'challenge' ? '⚡ 猜謎小遊戲 (挑戰模式設定)' : '🎮 猜謎小遊戲 (休閒模式設定)';

  // 1. 初始化複選資料
  if (typeof initSharedMultiSelectFilters === 'function') initSharedMultiSelectFilters();
  globalFilters.game = { region: [], year: [], month: [] };

  // 2. 重置按鈕文字
  ['region', 'year', 'month'].forEach(t => {
    const btnId = `btnGame${t.charAt(0).toUpperCase() + t.slice(1)}`; 
    const btn = document.getElementById(btnId);
    if (btn) btn.innerText = `全部${t === 'region' ? '地區' : t === 'year' ? '年份' : '月份'} ▼`;
  });

  // 3. 重置最愛篩選
  const favSel = document.getElementById('gameFilterFav');
  if (favSel) favSel.value = 'all';

  await onGameFilterChange();
  openModal('gameConfigModal');
}

async function onGameFilterChange() {
  clearGameConfigThumbs();
  
  // 從複選引擎取得資料
  const { region: selectedRegions, year: selectedYears, month: selectedMonths } = globalFilters.game;
  
  // 檢查是否選擇了「全部」（陣列為空代表沒特別限制）
  const isAllRegions = selectedRegions.length === 0 || selectedRegions.length === [...new Set(allPhotoMetas.map(p => p.location))].length;
  const isAllYears = selectedYears.length === 0 || selectedYears.length === [...new Set(allPhotoMetas.map(p => String(p.year)))].length;
  const isAllMonths = selectedMonths.length === 0 || selectedMonths.length === 12;

  const fav = document.getElementById('gameFilterFav') ? document.getElementById('gameFilterFav').value : 'all';

  gameFilteredPhotos = allPhotoMetas.filter(p => {
    if (!isAllRegions && !selectedRegions.includes(p.location)) return false;
    if (!isAllYears && !selectedYears.includes(String(p.year))) return false;
    if (!isAllMonths && !selectedMonths.includes(String(p.month))) return false;
    if (fav === 'fav' && !p.isFavorite) return false;
    return true;
  });

  // 預設將符合篩選條件的照片全部勾選
  gameSelectedPhotoIds = new Set(gameFilteredPhotos.map(p => p.id));

  await renderGamePhotoPreviewGrid();
  syncSliderBoundsWithSelectedPhotos(true);
}

async function renderGamePhotoPreviewGrid() {
  const grid = document.getElementById('gamePhotoPreviewGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (gameFilteredPhotos.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #888;">無符合此篩選條件的照片，請調整上方篩選條件。</div>';
    return;
  }

  for (const p of gameFilteredPhotos) {
    const isChecked = gameSelectedPhotoIds.has(p.id);
    const blobRec = await dbGet('photoBlobs', p.id);
    let imgHtml = '<div style="height:78px; background:#eee; border-radius:4px;"></div>';
    if (blobRec && blobRec.thumbBlob) {
      const u = URL.createObjectURL(blobRec.thumbBlob);
      gameConfigThumbUrls.push(u);
      imgHtml = `<img src="${u}" style="width:100%; height:78px; object-fit:cover; border-radius:4px; display:block;">`;
    }

    const card = document.createElement('div');
    card.id = `game-photo-card-${p.id}`;
    card.style.cssText = `border: 2px solid ${isChecked ? 'var(--primary)' : '#dfe4ea'}; background: ${isChecked ? '#f1f8f7' : '#ffffff'}; border-radius: 8px; padding: 6px; text-align: center; font-size: 12px; cursor: pointer; transition: all 0.15s ease; user-select: none;`;
    
    card.onclick = (e) => {
      if (e.target.closest('label')) return;
      const cb = card.querySelector('.game-photo-cb');
      if (cb) {
        cb.checked = !cb.checked;
        toggleGamePhotoSelection(p.id, cb.checked);
        card.style.borderColor = cb.checked ? 'var(--primary)' : '#dfe4ea';
        card.style.background = cb.checked ? '#f1f8f7' : '#ffffff';
      }
    };

    card.innerHTML = `
      ${imgHtml}
      <div style="margin-top:5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${p.location}</div>
      <div style="font-size:11px; color:#666; margin-bottom:4px;">${p.year}年${p.month}月 ${p.isFavorite ? '❤️' : ''}</div>
      <label style="display:inline-flex; align-items:center; justify-content:center; gap:5px; cursor:pointer; font-weight:700; color:var(--primary); margin:0;">
        <input type="checkbox" class="game-photo-cb" data-id="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleGamePhotoSelection('${p.id}', this.checked); const c = this.parentNode.parentNode; c.style.borderColor = this.checked ? 'var(--primary)' : '#dfe4ea'; c.style.background = this.checked ? '#f1f8f7' : '#ffffff';" style="width:15px !important; height:15px !important; margin:0 !important; accent-color:var(--primary); cursor:pointer;">
        <span>納入題庫</span>
      </label>
    `;
    grid.appendChild(card);
  }
}

function toggleGamePhotoSelection(photoId, isChecked) {
  if (isChecked) gameSelectedPhotoIds.add(photoId);
  else gameSelectedPhotoIds.delete(photoId);
  syncSliderBoundsWithSelectedPhotos(false);
}

function gameSelectAllPhotos(selectAll) {
  const cbs = document.querySelectorAll('.game-photo-cb');
  cbs.forEach(cb => {
    cb.checked = !!selectAll;
    const id = cb.getAttribute('data-id');
    if (selectAll) gameSelectedPhotoIds.add(id);
    else gameSelectedPhotoIds.delete(id);

    const card = cb.parentNode.parentNode;
    if (card) {
      card.style.borderColor = selectAll ? 'var(--primary)' : '#dfe4ea';
      card.style.background = selectAll ? '#f1f8f7' : '#ffffff';
    }
  });
  syncSliderBoundsWithSelectedPhotos(selectAll);
}

function syncSliderBoundsWithSelectedPhotos(resetToDefault = false) {
  const selectedCount = gameSelectedPhotoIds.size;
  const countSpan = document.getElementById('gameSelectedPhotoCount');
  const launchBtn = document.getElementById('gameLaunchBtn');
  const qSlider = document.getElementById('gameQuestionSlider');
  const qInput = document.getElementById('gameQuestionCount');

  if (countSpan) {
    countSpan.innerText = `已勾選 ${selectedCount} / ${gameFilteredPhotos.length} 張作為題庫`;
    countSpan.style.color = selectedCount > 0 ? 'var(--primary)' : 'var(--accent)';
  }

  if (selectedCount === 0) {
    if (qSlider) { qSlider.min = 0; qSlider.max = 0; qSlider.value = 0; qSlider.disabled = true; }
    if (qInput) { qInput.min = 0; qInput.max = 0; qInput.value = 0; qInput.disabled = true; }
    if (launchBtn) launchBtn.disabled = true;
    updateGameQuestionLabel(0, 0);
    return;
  }

  if (qSlider) qSlider.disabled = false;
  if (qInput) qInput.disabled = false;
  if (launchBtn) launchBtn.disabled = false;

  const defaultVal = selectedCount > 10 ? 10 : selectedCount;
  let currentVal = parseInt(qSlider.value, 10) || defaultVal;
  if (resetToDefault || currentVal <= 0 || currentVal > selectedCount) {
    currentVal = defaultVal;
  }

  qSlider.min = 1;
  qSlider.max = selectedCount;
  qSlider.value = currentVal;

  qInput.min = 1;
  qInput.max = selectedCount;
  qInput.value = currentVal;

  updateGameQuestionLabel(currentVal, selectedCount);
}

function syncGameQuestionCount(source) {
  const totalSelected = Math.max(1, gameSelectedPhotoIds.size);
  const qSlider = document.getElementById('gameQuestionSlider');
  const qInput = document.getElementById('gameQuestionCount');
  if (gameSelectedPhotoIds.size === 0) return;

  let val = source === 'slider' ? parseInt(qSlider.value, 10) : parseInt(qInput.value, 10);
  if (isNaN(val)) val = 1;
  val = Math.max(1, Math.min(totalSelected, val));

  qSlider.value = val;
  qInput.value = val;
  updateGameQuestionLabel(val, totalSelected);
}

function setQuickQuestionCount(mode) {
  if (gameSelectedPhotoIds.size === 0) return;
  const totalSelected = gameSelectedPhotoIds.size;
  let val = 10;
  if (mode === 'default') {
    val = totalSelected > 10 ? 10 : totalSelected;
  } else if (mode === 'half') {
    val = Math.max(1, Math.round(totalSelected / 2));
  } else if (mode === 'max') {
    val = totalSelected;
  }
  document.getElementById('gameQuestionSlider').value = val;
  document.getElementById('gameQuestionCount').value = val;
  updateGameQuestionLabel(val, totalSelected);
}

function updateGameQuestionLabel(currentVal, totalSelected) {
  const label = document.getElementById('gameQuestionCountLabel');
  if (!label) return;
  if (totalSelected === 0) {
    label.innerText = '題目數量：請先於上方勾選至少 1 張照片';
  } else {
    label.innerText = `題目數量：已設定 ${currentVal} 題 (從已勾選的 ${totalSelected} 張照片中出題)`;
  }
}

function launchGame() {
  const selectedPhotos = gameFilteredPhotos.filter(p => gameSelectedPhotoIds.has(p.id));
  if (selectedPhotos.length === 0) {
    alert('請至少勾選 1 張照片作為遊戲題庫！');
    return;
  }

  closeGameConfigModal();

  const totalSelected = selectedPhotos.length;
  const fallbackDefault = totalSelected > 10 ? 10 : totalSelected;
  const rawInput = parseInt(document.getElementById('gameQuestionCount').value, 10) || fallbackDefault;
  const count = Math.max(1, Math.min(totalSelected, rawInput));
  const forcedMode = document.getElementById('gameModeSelection').value;

  const shuffled = [...selectedPhotos].sort(() => Math.random() - 0.5).slice(0, count);
  quizPool = shuffled.map(p => {
    const item = generateQuizFromMeta(p);
    item.style = forcedMode;
    return item;
  });

  startGameLoop(80);
}
function generateQuizFromMeta(photo) {
  const isSpecialLocation = (photo.location === '台灣足跡' || photo.location === '在海上');
  const categories = isSpecialLocation ? ['year', 'month'] : ['year', 'month', 'location'];
  const targetCat = categories[Math.floor(Math.random() * categories.length)];

  let qText = '請問這張照片是在哪裡拍攝的？';
  let correct = photo.location;

  if (targetCat === 'year') {
    qText = '請問這張照片是在哪一年拍攝的？';
    correct = `${photo.year} 年`;
  } else if (targetCat === 'month') {
    qText = '請問這張照片是在幾月份拍攝的？';
    correct = `${photo.month} 月`;
  }

  const distractors = new Set();
  allPhotoMetas.forEach(p => {
    let val = p.location;
    if (targetCat === 'year') val = `${p.year} 年`;
    if (targetCat === 'month') val = `${p.month} 月`;
    if (val !== correct && val !== '台灣足跡' && val !== '在海上') distractors.add(val);
  });

  let c = 1;
  while (distractors.size < 2) {
    if (targetCat === 'year') distractors.add(`${2020 + c} 年`);
    else if (targetCat === 'month') distractors.add(`${((c % 12) + 1)} 月`);
    else distractors.add(['花蓮縣', '臺南市', '南投縣', '小琉球', '澎湖縣'][c % 5]);
    c++;
  }

  const dArr = Array.from(distractors).slice(0, 2);
  return {
    meta: photo,
    questionText: qText,
    correctAnswer: correct,
    options: [correct, dArr[0], dArr[1]].sort(() => Math.random() - 0.5),
    style: 'all'
  };
}

function cleanupActiveModeResources() {
  if (activeModeInterval) {
    clearInterval(activeModeInterval);
    activeModeInterval = null;
  }

  const vp = document.getElementById('gameViewport');
  if (vp) {
    vp.onmousemove = null;
    vp.ontouchmove = null;
    vp.ontouchstart = null;
  }

  const canvas = document.getElementById('scratchCanvas');
  if (canvas) {
    canvas.onmousedown = null;
    canvas.onmousemove = null;
    canvas.ontouchstart = null;
    canvas.ontouchmove = null;
    canvas.onclick = null;
    canvas.style.display = 'none';
    canvas.style.cursor = 'default';
    canvas.width = 0;
    canvas.height = 0;
  }

  const img = document.getElementById('gameImg');
  if (img) {
    img.style.display = 'block';
    img.style.width = '';
    img.style.marginRight = '';
    img.style.transform = 'none';
    img.style.transition = 'none';
    img.style.filter = 'none';
    img.style.webkitMaskImage = 'none';
    img.style.maskImage = 'none';
    img.style.backgroundColor = '';
    img.classList.remove('shake');
  }

  const modeBadge = document.getElementById('activeSubModeBadge');
  if (modeBadge) modeBadge.style.display = 'none';
}

function showSubModeBadge(text) {
  const vp = document.getElementById('gameViewport');
  let badge = document.getElementById('activeSubModeBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'activeSubModeBadge';
    badge.style.cssText = 'position:absolute; top:10px; left:10px; background:rgba(0,0,0,0.72); color:#fff; padding:4px 10px; border-radius:14px; font-size:12px; font-weight:bold; z-index:25; pointer-events:none; border:1px solid rgba(255,255,255,0.25);';
    vp.appendChild(badge);
  }
  badge.innerText = text;
  badge.style.display = 'block';
}

function startGameLoop(initialScore) {
  currentQuizIndex = 0;
  score = initialScore || 80;
  consecutiveErrors = 0;
  usedMetasForReview = [];

  document.getElementById('gameOverlay').classList.add('active');
  document.getElementById('gameModeLabel').innerText = gameType === 'challenge' ? '模式: 挑戰' : '模式: 休閒';
  document.getElementById('gameScore').style.display = gameType === 'challenge' ? 'inline' : 'none';

  nextQuestion();
}

async function nextQuestion() {
  cleanupActiveModeResources();

  if (currentQuizIndex >= quizPool.length) {
    finishGame(true);
    return;
  }

  currentQuizItem = quizPool[currentQuizIndex];
  usedMetasForReview.push(currentQuizItem.meta);
  currentQuizIndex++;

  document.getElementById('gameProgress').innerText = `題目: ${currentQuizIndex} / ${quizPool.length}`;
  updateScoreUI();

  if (currentQuizObjectUrl) {
    URL.revokeObjectURL(currentQuizObjectUrl);
    currentQuizObjectUrl = null;
  }

  const blobRec = await dbGet('photoBlobs', currentQuizItem.meta.id);
  if (blobRec && blobRec.displayBlob) {
    currentQuizObjectUrl = URL.createObjectURL(blobRec.displayBlob);
  }

  const img = document.getElementById('gameImg');
  img.src = currentQuizObjectUrl || '';

  document.getElementById('circleMark').classList.remove('show');
  document.getElementById('gridBlockWrap').style.display = 'none';

  let parsedMode = parseInt(currentQuizItem.style, 10);
  let mode = (currentQuizItem.style === 'all' || !ALLOWED_MODES.includes(parsedMode))
    ? ALLOWED_MODES[Math.floor(Math.random() * ALLOWED_MODES.length)]
    : parsedMode;

  document.getElementById('questionText').innerText = currentQuizItem.questionText;

  setupPresentationMode(mode);
  renderStandardOptions(currentQuizItem);

  questionStartTime = Date.now();
}

function renderStandardOptions(quizItem) {
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  quizItem.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.innerText = opt;
    btn.onclick = () => handleAnswer(opt === quizItem.correctAnswer, btn);
    grid.appendChild(btn);
  });
}

function setupPresentationMode(mode) {
  const img = document.getElementById('gameImg');
  const canvas = document.getElementById('scratchCanvas');

  if (mode === 1) {
    showSubModeBadge('🖼️ 模式 1：原圖提問');
  } else if (mode === 2) {
    showSubModeBadge('🧱 模式 2：九宮格遮蔽');
    const wrap = document.getElementById('gridBlockWrap');
    wrap.style.display = 'grid';
    wrap.innerHTML = '';
    const hiddenIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5).slice(0, 4);
    for (let i = 0; i < 9; i++) {
      const b = document.createElement('div');
      b.className = 'grid-block' + (hiddenIdx.includes(i) ? '' : ' hidden');
      wrap.appendChild(b);
    }
  } else if (mode === 3) {
    showSubModeBadge('🧽 模式 3：刮刮樂除污（請塗抹畫面）');
    canvas.style.display = 'block';
    initScratchCard(canvas);
  } else if (mode === 4) {
    showSubModeBadge('🔦 模式 4：手電筒夜視（滑動手指探照）');
    initFlashlightMode(img);
  } else if (mode === 5) {
    const transforms = [
      { css: 'scaleX(-1)', name: '水平鏡像翻轉' },
      { css: 'scaleY(-1)', name: '垂直上下顛倒' },
      { css: 'scale(-1, -1)', name: '180° 空間倒置' }
    ];
    const picked = transforms[Math.floor(Math.random() * transforms.length)];
    showSubModeBadge(`🪞 模式 5：鏡像萬花筒（${picked.name}）`);
    img.style.transform = picked.css;
  } else if (mode === 6) {
    const isNegative = Math.random() > 0.45;
    if (isNegative) {
      showSubModeBadge('🎞️ 模式 6：底片負片色彩反轉');
      img.style.filter = 'invert(100%) hue-rotate(180deg) contrast(120%)';
    } else {
      showSubModeBadge('📜 模式 6：老照片高反差褪色');
      img.style.filter = 'grayscale(100%) sepia(65%) contrast(185%) brightness(85%)';
    }
  } else if (mode === 7) {
    showSubModeBadge('👾 模式 7：8-Bit 像素馬賽克（動態解析中...）');
    canvas.style.display = 'block';
    initPixelMosaicMode(img, canvas);
  } else if (mode === 8) {
    showSubModeBadge('🧩 模式 8：九宮格錯位拼圖（可點擊兩塊交換還原）');
    canvas.style.display = 'block';
    initTileSwapPuzzleMode(img, canvas);
  } else if (mode === 9) {
    showSubModeBadge('✏️ 模式 9：素描線稿化（邊緣輪廓偵測）');
    canvas.style.display = 'block';
    initSketchEdgeMode(img, canvas);
  }
}

/* --- Mode 3: Scratch Card --- */
function initScratchCard(canvas) {
  const vp = document.getElementById('gameViewport');
  canvas.width = vp.clientWidth;
  canvas.height = vp.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let isDrawing = false;
  function scratch(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  canvas.onmousedown = (e) => { isDrawing = true; scratch(e); };
  canvas.onmousemove = scratch;
  window.onmouseup = () => { isDrawing = false; };
  canvas.ontouchstart = (e) => { isDrawing = true; scratch(e); };
  canvas.ontouchmove = scratch;
  window.ontouchend = () => { isDrawing = false; };
}

/* --- Mode 4: Flashlight Night Vision (Pure CSS Mask) --- */
function initFlashlightMode(img) {
  const vp = document.getElementById('gameViewport');
  const setSpot = (x, y) => {
    const grad = `radial-gradient(circle 68px at ${x}px ${y}px, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 100%)`;
    img.style.webkitMaskImage = grad;
    img.style.maskImage = grad;
  };

  setSpot(vp.clientWidth / 2, vp.clientHeight / 2);

  const handleMove = (e) => {
    const rect = img.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setSpot(clientX - rect.left, clientY - rect.top);
  };

  vp.onmousemove = handleMove;
  vp.ontouchstart = handleMove;
  vp.ontouchmove = (e) => {
    e.preventDefault();
    handleMove(e);
  };
}

/* Helper: Compute Aspect-Fit Draw Rect inside Viewport Canvas */
function getContainRect(srcW, srcH, dstW, dstH) {
  const scale = Math.min(dstW / (srcW || 1), dstH / (srcH || 1));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const x = Math.round((dstW - w) / 2);
  const y = Math.round((dstH - h) / 2);
  return { x, y, w, h };
}

/* --- Mode 7: 8-Bit Dynamic Pixel Mosaic --- */
function initPixelMosaicMode(img, canvas) {
  const runMosaic = () => {
    const vp = document.getElementById('gameViewport');
    canvas.width = vp.clientWidth;
    canvas.height = vp.clientHeight;
    const ctx = canvas.getContext('2d');

    const steps = [10, 16, 26, 42, 68, 120];
    let stepIdx = 0;

    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');

    const drawStep = () => {
      if (canvas.width === 0) return;
      const res = steps[Math.min(stepIdx, steps.length - 1)];
      const aspect = (img.naturalHeight || 1) / (img.naturalWidth || 1);
      offCanvas.width = res;
      offCanvas.height = Math.max(1, Math.round(res * aspect));

      offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);
      offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);

      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      const box = getContainRect(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height);
      ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, box.x, box.y, box.w, box.h);
      offCanvas.width = 0;
      offCanvas.height = 0;
    };

    drawStep();
    activeModeInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        drawStep();
      } else {
        clearInterval(activeModeInterval);
        activeModeInterval = null;
      }
    }, 1800);
  };

  if (img.complete && img.naturalWidth > 0) runMosaic();
  else img.onload = runMosaic;
}

/* --- Mode 8: 3x3 Tile Swap Puzzle (Interactive Click-to-Swap) --- */
function initTileSwapPuzzleMode(img, canvas) {
  const runPuzzle = () => {
    const vp = document.getElementById('gameViewport');
    canvas.width = vp.clientWidth;
    canvas.height = vp.clientHeight;
    canvas.style.cursor = 'pointer';
    const ctx = canvas.getContext('2d');

    const tiles = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    let selectedSlot = null;
    const box = getContainRect(img.naturalWidth, img.naturalHeight, canvas.width, canvas.height);

    const renderTiles = () => {
      if (canvas.width === 0) return;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const srcW = img.naturalWidth / 3;
      const srcH = img.naturalHeight / 3;
      const dstW = box.w / 3;
      const dstH = box.h / 3;

      for (let slot = 0; slot < 9; slot++) {
        const piece = tiles[slot];
        const sx = (piece % 3) * srcW;
        const sy = Math.floor(piece / 3) * srcH;
        const dx = box.x + (slot % 3) * dstW;
        const dy = box.y + Math.floor(slot / 3) * dstH;

        ctx.drawImage(img, sx, sy, srcW, srcH, dx, dy, dstW, dstH);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dstW, dstH);

        if (selectedSlot === slot) {
          ctx.strokeStyle = '#f1c40f';
          ctx.lineWidth = 4;
          ctx.strokeRect(dx + 2, dy + 2, dstW - 4, dstH - 4);
        }
      }
    };

    renderTiles();

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) return;

      const col = Math.min(2, Math.floor(((x - box.x) / box.w) * 3));
      const row = Math.min(2, Math.floor(((y - box.y) / box.h) * 3));
      const clickedSlot = row * 3 + col;

      if (selectedSlot === null) {
        selectedSlot = clickedSlot;
      } else if (selectedSlot === clickedSlot) {
        selectedSlot = null;
      } else {
        [tiles[selectedSlot], tiles[clickedSlot]] = [tiles[clickedSlot], tiles[selectedSlot]];
        selectedSlot = null;
      }
      renderTiles();
    };
  };

  if (img.complete && img.naturalWidth > 0) runPuzzle();
  else img.onload = runPuzzle;
}

/* --- Mode 9: Sketch Line-Art (Low-Memory Sobel Edge Detection) --- */
function initSketchEdgeMode(img, canvas) {
  const runSketch = () => {
    const vp = document.getElementById('gameViewport');
    canvas.width = vp.clientWidth;
    canvas.height = vp.clientHeight;
    const ctx = canvas.getContext('2d');

    const procW = 300;
    const procH = Math.max(1, Math.round(procW * (img.naturalHeight / (img.naturalWidth || 1))));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = procW;
    tempCanvas.height = procH;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, procW, procH);

    const srcData = tempCtx.getImageData(0, 0, procW, procH);
    const outData = tempCtx.createImageData(procW, procH);
    const s = srcData.data;
    const d = outData.data;

    const gray = new Uint8Array(procW * procH);
    for (let i = 0, p = 0; i < s.length; i += 4, p++) {
      gray[p] = (s[i] * 77 + s[i + 1] * 150 + s[i + 2] * 29) >> 8;
    }

    for (let y = 1; y < procH - 1; y++) {
      for (let x = 1; x < procW - 1; x++) {
        const idx = y * procW + x;
        const gx =
          -gray[idx - procW - 1] + gray[idx - procW + 1] +
          -2 * gray[idx - 1]     + 2 * gray[idx + 1] +
          -gray[idx + procW - 1] + gray[idx + procW + 1];
        const gy =
          -gray[idx - procW - 1] - 2 * gray[idx - procW] - gray[idx - procW + 1] +
           gray[idx + procW - 1] + 2 * gray[idx + procW] + gray[idx + procW + 1];

        const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        const val = mag > 38 ? Math.max(0, 255 - mag * 1.35) : 250;
        const outIdx = idx * 4;
        d[outIdx] = val;
        d[outIdx + 1] = val;
        d[outIdx + 2] = val;
        d[outIdx + 3] = 255;
      }
    }

    tempCtx.putImageData(outData, 0, 0);

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const box = getContainRect(procW, procH, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0, procW, procH, box.x, box.y, box.w, box.h);

    tempCanvas.width = 0;
    tempCanvas.height = 0;
  };

  if (img.complete && img.naturalWidth > 0) runSketch();
  else img.onload = runSketch;
}

function handleAnswer(isCorrect, btn) {
  const elapsed = (Date.now() - questionStartTime) / 1000;
  const x = Math.max(1, quizPool.length);
  const B = 20 / x;

  if (isCorrect) {
    if (activeModeInterval) { clearInterval(activeModeInterval); activeModeInterval = null; }

    document.getElementById('circleMark').classList.add('show');

    if (gameType === 'challenge') {
      if (elapsed <= 3) score += Math.round(B * 5);
      else if (elapsed <= 10) score += Math.round(B * 3);
      else score += Math.round(B * 1);
      consecutiveErrors = 0;
      updateScoreUI();
    }

    setTimeout(() => {
      document.getElementById('circleMark').classList.remove('show');
      nextQuestion();
    }, 800);

  } else {
    const img = document.getElementById('gameImg');
    img.classList.remove('shake');
    void img.offsetWidth;
    img.classList.add('shake');
    if (btn && btn.style) btn.style.background = '#c0392b';

    if (gameType === 'challenge') {
      consecutiveErrors++;
      let penalty = 0;

      if (consecutiveErrors < 3) {
        penalty = Math.round(B * 2);
      } else if (consecutiveErrors === 3) {
        penalty = Math.round((B * 2) * 3);
      } else {
        penalty = Math.round((B * 2) * 4 * 5);
      }

      score -= penalty;
      updateScoreUI();

      if (score <= 0) {
        score = 0;
        updateScoreUI();
        setTimeout(() => finishGame(false), 350);
      }
    }
  }
}

function updateScoreUI() {
  document.getElementById('gameScore').innerText = `分數: ${score}`;
}

async function finishGame(isVictory) {
  cleanupActiveModeResources();
  document.getElementById('gameOverlay').classList.remove('active');

  if (currentQuizObjectUrl) {
    URL.revokeObjectURL(currentQuizObjectUrl);
    currentQuizObjectUrl = null;
  }

  if (gameType === 'challenge' && !isVictory) {
    showChallengeFailScreen();
    return;
  }

  const title = document.getElementById('reviewTitle');
  const summary = document.getElementById('reviewScoreSummary');
  title.innerText = gameType === 'challenge' ? '🎉 挑戰成功！足跡回顧' : '🌟 完成答題！足跡回顧';
  summary.innerText = gameType === 'challenge'
    ? `最終獲得積分：${score} 分（共回顧 ${usedMetasForReview.length} 張足跡照片）`
    : `順利探索所有足跡回憶！（共回顧 ${usedMetasForReview.length} 張足跡照片）`;

  const gallery = document.getElementById('reviewGallery');
  gallery.innerHTML = '';
  reviewThumbUrls = [];

  for (const m of usedMetasForReview) {
    const blobRec = await dbGet('photoBlobs', m.id);
    if (blobRec && blobRec.thumbBlob) {
      const u = URL.createObjectURL(blobRec.thumbBlob);
      reviewThumbUrls.push(u);
      const card = document.createElement('div');
      card.className = 'review-card';
      card.innerHTML = `
        <img src="${u}">
        <strong>${m.location}</strong><br>
        <span style="color:#666">${m.year}年${m.month}月</span>
      `;
      gallery.appendChild(card);
    }
  }

  openModal('reviewModal');
}

function showChallengeFailScreen() {
  clearFailTimers();
  const overlay = document.getElementById('failOverlay');
  const hint = document.getElementById('failCountdownText');
  overlay.classList.add('active');

  let remaining = 7;
  hint.innerText = `${remaining} 秒後自動返回地圖主畫面...`;

  failCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining > 0) {
      hint.innerText = `${remaining} 秒後自動返回地圖主畫面...`;
    }
  }, 1000);

  failAutoExitTimer = setTimeout(() => {
    acknowledgeFailAndExit();
  }, 7000);
}

function clearFailTimers() {
  if (failAutoExitTimer) {
    clearTimeout(failAutoExitTimer);
    failAutoExitTimer = null;
  }
  if (failCountdownInterval) {
    clearInterval(failCountdownInterval);
    failCountdownInterval = null;
  }
}

function acknowledgeFailAndExit() {
  clearFailTimers();
  document.getElementById('failOverlay').classList.remove('active');
}

function closeReviewModal() {
  reviewThumbUrls.forEach(u => URL.revokeObjectURL(u));
  reviewThumbUrls = [];
  closeModal('reviewModal');
}

function quitGame() {
  if (confirm('確定放棄當前遊戲？')) {
    cleanupActiveModeResources();
    if (currentQuizObjectUrl) {
      URL.revokeObjectURL(currentQuizObjectUrl);
      currentQuizObjectUrl = null;
    }
    document.getElementById('gameOverlay').classList.remove('active');
  }
}

/* ==========================================================================
   15. Custom Game 3-Step Wizard System (Supports Modes 1 ~ 9)
   ========================================================================== */
let wizardCurrentStep = 1;
let wizardEditingGameId = null;
let wizardSelectedPhotoIds = new Set();
let wizardTemporaryThumbUrls = [];

async function openCustomGameManager() {
  closeMenu();
  const list = await dbGetAll('customGames');
  const wrap = document.getElementById('customGameList');
  wrap.innerHTML = '';

  if (list.length === 0) {
    wrap.innerHTML = '<div style="color: #999; font-size: 13px; padding: 8px;">尚無自訂遊戲，請點擊上方按鈕建立。</div>';
  } else {
    list.forEach(g => {
      const item = document.createElement('div');
      item.style = 'display:flex; justify-content:space-between; align-items:center; background:#f1f2f6; padding:10px 14px; border-radius:6px;';
      item.innerHTML = `
        <div>
          <strong>${g.title}</strong> 
          <span style="font-size:12px; color:#666;">(${g.gameType === 'challenge' ? '挑戰' : '休閒'} | ${g.questions.length} 題)</span>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary" style="padding:4px 8px; font-size:12px;" onclick="playCustomGame('${g.id}')">遊玩</button>
          <button class="btn" style="padding:4px 8px; font-size:12px;" onclick="editCustomGame('${g.id}')">編輯</button>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:12px;" onclick="deleteCustomGame('${g.id}')">刪除</button>
        </div>
      `;
      wrap.appendChild(item);
    });
  }
  openModal('customGameModal');
}

async function openCustomGameWizard(existingGame = null) {
  closeModal('customGameModal');
  wizardEditingGameId = existingGame ? existingGame.id : null;
  wizardSelectedPhotoIds = new Set(existingGame ? existingGame.questions.map(q => q.photoId) : []);

  if (existingGame) {
    document.getElementById('wGameTitle').value = existingGame.title;
    document.getElementById('wGameType').value = existingGame.gameType;
    document.getElementById('wBaseScore').value = existingGame.baseScore || 80;
  } else {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const prefix = `照片回憶錄 ${y}/${m}/${day}`;

    const games = await dbGetAll('customGames');
    let maxSeq = 0;
    games.forEach(g => {
      if (g.title.startsWith(prefix)) {
        const parts = g.title.split(' ');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
    document.getElementById('wGameTitle').value = `${prefix} ${maxSeq + 1}`;
    document.getElementById('wGameType').value = 'casual';
    document.getElementById('wBaseScore').value = 80;
  }

  toggleWizardScoreField();
  goToWizardStep(1);
  openModal('wizardModal');
}

function toggleWizardScoreField() {
  const type = document.getElementById('wGameType').value;
  document.getElementById('wBaseScoreGroup').style.display = type === 'challenge' ? 'block' : 'none';
}

async function goToWizardStep(step) {
  wizardCurrentStep = step;
  document.getElementById('wizardTitle').innerText = `自訂小遊戲精靈 (步驟 ${step} / 3)`;
  document.getElementById('wizardStep1').style.display = step === 1 ? 'flex' : 'none';
  document.getElementById('wizardStep2').style.display = step === 2 ? 'flex' : 'none';
  document.getElementById('wizardStep3').style.display = step === 3 ? 'flex' : 'none';

  if (step === 2) {
    initWizardStep2Filters();
    await renderWizardPhotoSelection();
  } else if (step === 3) {
    if (wizardSelectedPhotoIds.size === 0) {
      alert('請至少勾選一張照片作為題庫！');
      goToWizardStep(2);
      return;
    }
    await renderWizardStep3Review();
  }
}

function initWizardStep2Filters() {
  if (typeof initSharedMultiSelectFilters === 'function') initSharedMultiSelectFilters();
  globalFilters.wizard = { region: [], year: [], month: [] };

  ['region', 'year', 'month'].forEach(t => {
    const btnId = `btnWiz${t.charAt(0).toUpperCase() + t.slice(1)}`;
    const btn = document.getElementById(btnId);
    if (btn) btn.innerText = `全部${t === 'region' ? '地區' : t === 'year' ? '年份' : '月份'} ▼`;
  });

  const favSel = document.getElementById('wFilterFav');
  if (favSel) favSel.value = 'all';

  if (typeof filterWizardPhotos === 'function') filterWizardPhotos();
}

async function filterWizardPhotos() {
  await renderWizardPhotoSelection();
}

async function renderWizardPhotoSelection() {
  clearWizardThumbs();
  
  const { region: selectedRegions, year: selectedYears, month: selectedMonths } = globalFilters.wizard;
  
  const isAllRegions = selectedRegions.length === 0 || selectedRegions.length === [...new Set(allPhotoMetas.map(p => p.location))].length;
  const isAllYears = selectedYears.length === 0 || selectedYears.length === [...new Set(allPhotoMetas.map(p => String(p.year)))].length;
  const isAllMonths = selectedMonths.length === 0 || selectedMonths.length === 12;

  const fav = document.getElementById('wFilterFav') ? document.getElementById('wFilterFav').value : 'all';
  const container = document.getElementById('wizardSelectionList');
  container.innerHTML = '';

  const filtered = allPhotoMetas.filter(p => {
    if (!isAllRegions && !selectedRegions.includes(p.location)) return false;
    if (!isAllYears && !selectedYears.includes(String(p.year))) return false;
    if (!isAllMonths && !selectedMonths.includes(String(p.month))) return false;
    if (fav === 'fav' && !p.isFavorite) return false;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; color:#888; font-size:12px; padding:10px;">無符合條件的照片。</div>';
    updateWizardSelectedCount();
    return;
  }

  for (const p of filtered) {
    const isChecked = wizardSelectedPhotoIds.has(p.id);
    const blobRec = await dbGet('photoBlobs', p.id);
    let imgTag = '<div style="height:75px; background:#ddd; border-radius:4px;"></div>';
    if (blobRec && blobRec.thumbBlob) {
      const u = URL.createObjectURL(blobRec.thumbBlob);
      wizardTemporaryThumbUrls.push(u);
      imgTag = `<img src="${u}" style="width:100%; height:75px; object-fit:cover; border-radius:4px; display:block;">`;
    }

    const card = document.createElement('div');
    card.id = `wizard-photo-card-${p.id}`;
    card.style.cssText = `border: 2px solid ${isChecked ? 'var(--primary)' : '#dfe4ea'}; background: ${isChecked ? '#f1f8f7' : '#ffffff'}; border-radius: 8px; padding: 6px; text-align: center; font-size: 11px; cursor: pointer; transition: all 0.15s ease; user-select: none;`;
    
    card.onclick = (e) => {
      if (e.target.closest('label')) return; 
      const cb = card.querySelector('.w-photo-check');
      if (cb) {
        cb.checked = !cb.checked;
        toggleWizardPhoto(p.id, cb.checked);
        card.style.borderColor = cb.checked ? 'var(--primary)' : '#dfe4ea';
        card.style.background = cb.checked ? '#f1f8f7' : '#ffffff';
      }
    };

    card.innerHTML = `
      ${imgTag}
      <div style="margin: 4px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><strong>${p.location}</strong></div>
      <div style="color:#666; font-size:10px; margin-bottom:4px;">${p.year}/${p.month} ${p.isFavorite ? '❤️' : ''}</div>
      <label style="display:inline-flex; align-items:center; justify-content:center; gap:4px; cursor:pointer; font-weight:bold; color:var(--primary); margin:0;">
        <input type="checkbox" class="w-photo-check" data-id="${p.id}" ${isChecked ? 'checked' : ''} onchange="toggleWizardPhoto('${p.id}', this.checked); const c = this.parentNode.parentNode; c.style.borderColor = this.checked ? 'var(--primary)' : '#dfe4ea'; c.style.background = this.checked ? '#f1f8f7' : '#ffffff';" style="width:15px !important; height:15px !important; margin:0 !important; accent-color:var(--primary); cursor:pointer;">
        <span>選擇</span>
      </label>
    `;
    container.appendChild(card);
  }
  updateWizardSelectedCount();
}

function toggleWizardPhoto(id, isChecked) {
  if (isChecked) wizardSelectedPhotoIds.add(id);
  else wizardSelectedPhotoIds.delete(id);
  updateWizardSelectedCount();
}

function wizardSelectAll(selectAll) {
  const checkboxes = document.querySelectorAll('.w-photo-check');
  checkboxes.forEach(cb => {
    cb.checked = selectAll;
    const id = cb.getAttribute('data-id');
    if (selectAll) wizardSelectedPhotoIds.add(id);
    else wizardSelectedPhotoIds.delete(id);

    const card = cb.parentNode.parentNode;
    if (card) {
      card.style.borderColor = selectAll ? 'var(--primary)' : '#dfe4ea';
      card.style.background = selectAll ? '#f1f8f7' : '#ffffff';
    }
  });
  updateWizardSelectedCount();
}

function updateWizardSelectedCount() {
  document.getElementById('wizardSelectedCount').innerText = `已勾選 ${wizardSelectedPhotoIds.size} 張`;
}

async function renderWizardStep3Review() {
  clearWizardThumbs();
  const container = document.getElementById('wizardReviewList');
  container.innerHTML = '';

  let qIndex = 1;
  for (const id of wizardSelectedPhotoIds) {
    const meta = allPhotoMetas.find(p => p.id === id);
    if (!meta) continue;

    const defaultQ = generateQuizFromMeta(meta);
    const distractors = defaultQ.options.filter(o => o !== defaultQ.correctAnswer);

    const blobRec = await dbGet('photoBlobs', id);
    let imgTag = '<div style="width:68px; height:68px; background:#ddd; border-radius:6px;"></div>';
    if (blobRec && blobRec.thumbBlob) {
      const u = URL.createObjectURL(blobRec.thumbBlob);
      wizardTemporaryThumbUrls.push(u);
      imgTag = `<img src="${u}" style="width:68px; height:68px; object-fit:cover; border-radius:6px;">`;
    }

    const card = document.createElement('div');
    card.style = 'display:flex; align-items:center; gap:10px; background:#ffffff; padding:8px 10px; border-radius:8px; border:1px solid #dcdde1;';
    card.innerHTML = `
      <div style="font-weight:bold; color:var(--primary); width:26px; text-align:center; font-size:13px;">#${qIndex++}</div>
      <div style="flex-shrink:0; text-align:center; width:72px;">
        ${imgTag}
        <div style="font-size:10px; color:#555; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${meta.location}</div>
      </div>
      <div style="flex:1; display:flex; flex-direction:column; gap:6px;">
        <div style="display:flex; gap:6px;">
          <select class="w-style" data-id="${id}" style="width: 220px; padding:6px; font-size:13px; border:1px solid #ced6e0; border-radius:5px;">
            ${buildGameModeOptionsHTML('all')}
          </select>
          <input type="text" class="w-qtext" data-id="${id}" value="${defaultQ.questionText}" style="flex:1; padding:6px 8px; font-size:13px; border:1px solid #ced6e0; border-radius:5px;" placeholder="題目敘述">
        </div>
        <div style="display:flex; gap:6px;">
          <input type="text" class="w-correct" data-id="${id}" value="${defaultQ.correctAnswer}" style="flex:1; padding:6px 8px; font-size:13px; border:2px solid #2ecc71; border-radius:5px; background:#f4fff7;" placeholder="✓ 正確答案">
          <input type="text" class="w-opt1" data-id="${id}" value="${distractors[0] || '干擾項A'}" style="flex:1; padding:6px 8px; font-size:13px; border:1px solid #ced6e0; border-radius:5px;" placeholder="✗ 干擾選項 B">
          <input type="text" class="w-opt2" data-id="${id}" value="${distractors[1] || '干擾項B'}" style="flex:1; padding:6px 8px; font-size:13px; border:1px solid #ced6e0; border-radius:5px;" placeholder="✗ 干擾選項 C">
        </div>
      </div>
    `;
    container.appendChild(card);
  }
}

function clearWizardThumbs() {
  wizardTemporaryThumbUrls.forEach(u => URL.revokeObjectURL(u));
  wizardTemporaryThumbUrls = [];
}

function closeWizard() {
  clearWizardThumbs();
  closeModal('wizardModal');
}

async function saveWizardCustomGame() {
  let title = document.getElementById('wGameTitle').value.trim();
  if (!title) title = '照片回憶錄自訂遊戲';

  const questions = [];
  wizardSelectedPhotoIds.forEach(id => {
    const qText = document.querySelector(`.w-qtext[data-id="${id}"]`).value.trim();
    const correct = document.querySelector(`.w-correct[data-id="${id}"]`).value.trim();
    const opt1 = document.querySelector(`.w-opt1[data-id="${id}"]`).value.trim();
    const opt2 = document.querySelector(`.w-opt2[data-id="${id}"]`).value.trim();
    const style = document.querySelector(`.w-style[data-id="${id}"]`).value;

    questions.push({
      photoId: id,
      questionText: qText,
      correctAnswer: correct,
      options: [correct, opt1, opt2],
      style: style
    });
  });

  const gameObj = {
    id: wizardEditingGameId || ('cg_' + Date.now()),
    title: title,
    gameType: document.getElementById('wGameType').value,
    baseScore: parseInt(document.getElementById('wBaseScore').value, 10) || 80,
    questions: questions
  };

  await dbPut('customGames', gameObj);
  closeWizard();
  openCustomGameManager();
}

async function editCustomGame(id) {
  const list = await dbGetAll('customGames');
  const game = list.find(g => g.id === id);
  if (game) openCustomGameWizard(game);
}

async function deleteCustomGame(id) {
  if (confirm('確定刪除此自訂遊戲題庫？')) {
    await dbDelete('customGames', id);
    openCustomGameManager();
  }
}

async function playCustomGame(id) {
  closeModal('customGameModal');
  const list = await dbGetAll('customGames');
  const game = list.find(g => g.id === id);
  if (!game || game.questions.length === 0) { alert('此遊戲題庫為空！'); return; }

  quizPool = [];
  game.questions.forEach(q => {
    const meta = allPhotoMetas.find(p => p.id === q.photoId);
    if (meta) {
      quizPool.push({
        meta: meta,
        questionText: q.questionText,
        correctAnswer: q.correctAnswer,
        options: [...q.options].sort(() => Math.random() - 0.5),
        style: q.style || 'all'
      });
    }
  });

  if (quizPool.length === 0) { alert('此遊戲綁定的照片已在相簿中被刪除！'); return; }

  gameType = game.gameType;
  startGameLoop(game.baseScore || 80);
}