'use strict';
/* ===== 計算ロジック（純粋関数） ===== */
function parseNum(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim().replace(/,/g, '.');
  if (t === '') return null;
  const v = Number(t);
  return isFinite(v) && v > 0 ? v : null;
}
function calcR(L, f, Sw, Pw) { return (L * 1000 * Sw) / (f * Pw); }
function calcF(L, R, Sw, Pw) { return (L * 1000 * Sw) / (R * Pw); }
function calcL(R, f, Sw, Pw) { return (R * f * Pw) / (Sw * 1000); }
function calc35mmToActual(eq, sw) { return eq * (sw / 36.0); }
function fmt(v, d) {
  let s = Number(v).toFixed(d);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
/* f,L,R: 数値 or null。ちょうど2つ入力されている時のみ計算 */
function compute(cam, f, L, R) {
  const n = [f, L, R].filter(x => x !== null).length;
  if (!cam || n !== 2) return null;
  const Sw = cam.sw, Pw = cam.pw;
  let target, value, Lm, unit, label, dec;
  if (f === null) { value = calcF(L, R, Sw, Pw); target = 'f'; Lm = L; unit = 'mm'; label = '焦点距離 f'; dec = 4; }
  else if (L === null) { value = calcL(R, f, Sw, Pw); target = 'L'; Lm = value; unit = 'm'; label = '撮影距離 L'; dec = 4; }
  else { value = calcR(L, f, Sw, Pw); target = 'R'; Lm = L; unit = 'mm/px'; label = '空間分解能 R'; dec = 6; }
  const warn = Lm * 1000 < cam.min;
  return { target, value, unit, label, dec, warn, diff: warn ? cam.min - Lm * 1000 : 0 };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ===== プリセット ===== */
// [name, mode, Sw, Pw, minFocusMm, defaultFocal]
const PRESETS = [
  ['SONY α7R III', '42MP', 35.9, 7952, 500, null],
  ['SONY α7R IV', '61MP', 35.7, 9504, 500, null],
  ['SONY α7R V', '61MP', 35.7, 9504, 500, null],
  ['SONY α7R VI', '67MP', 35.9, 9984, 500, null],
  ['SONY α7R II', '42MP', 35.9, 7952, 500, null],
  ['SONY α1 II', '50MP', 35.9, 8640, 500, null],
  ['SONY α7C II', '33MP', 35.9, 7008, 500, null],
  ['SONY α7CR', '61MP', 35.7, 9504, 500, null],
  ['SONY ZV-E1', '12MP', 35.6, 4240, 500, null],
  ['Canon EOS R5 II', '45MP', 36.0, 8192, 500, null],
  ['Canon EOS R6 II', '24MP', 36.0, 6000, 500, null],
  ['Canon EOS R1', '24MP', 36.0, 6000, 500, null],
  ['Canon EOS R3', '24MP', 36.0, 6000, 500, null],
  ['Canon EOS R8', '24MP', 36.0, 6000, 500, null],
  ['Canon EOS RP', '26MP', 35.9, 6240, 500, null],
  ['Nikon Z5 II', '24MP', 35.9, 6048, 500, null],
  ['Nikon Z6 III', '24MP', 35.9, 6144, 500, null],
  ['Nikon Z9', '45MP', 35.9, 8256, 500, null],
  ['Nikon Zf', '24MP', 35.9, 6048, 500, null],
  ['LUMIX DC-S1M2', '24MP', 35.6, 6000, 500, null],
  ['LUMIX DC-S1RM2', '44MP', 35.6, 8368, 500, null],
  ['LUMIX DC-S9N', '24MP', 35.6, 6000, 500, null],
  ['LUMIX DC-S5M2', '24MP', 35.6, 6000, 500, null],
  ['Sigma BF', '24MP', 35.9, 6000, 500, null],
  ['SIGMA fp L', '61MP', 35.9, 9520, 500, null],
  ['Zenmuse H20T Zoom', '12MP', 6.4, 4000, 1000, null],
  ['Zenmuse H20T Wide', '12MP', 6.4, 4000, 1000, 4.5],
  ['Zenmuse P1', '45MP', 35.9, 8192, 1000, null],
  ['Zenmuse H30T Wide', '40MP', 9.4, 8000, 1000, 6.72],
  ['Zenmuse H30T Zoom', '48MP', 6.4, 7728, 1000, null],
  ['DJI Pocket 2', '16MP', 7.6, 4000, 600, 4.22],
  ['DJI Pocket 2', '64MP', 7.6, 9216, 600, 4.22],
  ['GoPro 10', '5.3K', 7.7, 5312, 300, 3.04],
  ['GoPro 10', '4K', 7.7, 3840, 300, 3.04],
  ['GoPro MISSION 1', '8K', 13.2, 7680, 300, 6.88]
];
const MAKERS = ['SONY', 'Canon', 'Nikon', 'LUMIX', 'Sigma', 'DJI', 'GoPro'];
function makerOf(name) {
  const n = name.toLowerCase();
  if (n.startsWith('sony')) return 'SONY';
  if (n.startsWith('canon')) return 'Canon';
  if (n.startsWith('nikon')) return 'Nikon';
  if (n.startsWith('lumix')) return 'LUMIX';
  if (n.startsWith('sigma')) return 'Sigma';
  if (n.startsWith('dji') || n.startsWith('zenmuse')) return 'DJI';
  if (n.startsWith('gopro')) return 'GoPro';
  return 'その他';
}
const keyOf = c => c.name + '|' + c.mode;

/* ===== 状態・保存 ===== */
const STORE = 'cracknavi.v1';
const state = { cameras: [], deleted: [], selected: null, f: '', L: '', R: '', committed: false };
let uid = 1;
function presetToCam(p) { return { id: 'p' + (uid++), name: p[0], mode: p[1], sw: p[2], pw: p[3], min: p[4], focal: p[5] }; }
function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { saved = null; }
  if (saved && Array.isArray(saved.cameras)) {
    state.cameras = saved.cameras.filter(validCam).map(c => ({ id: 'c' + (uid++), name: String(c.name), mode: String(c.mode || ''), sw: +c.sw, pw: +c.pw, min: +c.min || 0, focal: c.focal > 0 ? +c.focal : null }));
    state.deleted = Array.isArray(saved.deleted) ? saved.deleted.map(String) : [];
    state.selected = saved.selected || null;
  }
  const have = new Set(state.cameras.map(keyOf));
  PRESETS.forEach(p => {
    const c = presetToCam(p);
    if (!have.has(keyOf(c)) && state.deleted.indexOf(keyOf(c)) < 0) { state.cameras.push(c); have.add(keyOf(c)); }
  });
}
function validCam(c) { return c && typeof c.name === 'string' && c.name.trim() && +c.sw > 0 && +c.pw > 0; }
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      cameras: state.cameras.map(c => ({ name: c.name, mode: c.mode, sw: c.sw, pw: c.pw, min: c.min, focal: c.focal })),
      deleted: state.deleted, selected: state.selected
    }));
  } catch (e) { /* 保存不可でも動作継続 */ }
}
function selectedCam() { return state.cameras.find(c => keyOf(c) === state.selected) || null; }

/* ===== UI ===== */
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let view = 'main', pickMaker = null, editingId = null, convTab = 'cam', convCamKey = null;

  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function show(v) {
    view = v;
    ['main', 'devices', 'help'].forEach(x => $('v-' + x).hidden = x !== v);
    $('btn-back').hidden = v === 'main';
    $('btn-help').hidden = v !== 'main';
    $('btn-dev').hidden = v !== 'main';
    $('sub').textContent = v === 'main' ? '撮影パラメータ計算' : v === 'devices' ? '機材管理' : '使い方';
    window.scrollTo(0, 0);
    if (v === 'devices') renderDevices();
  }

  function currentResult() {
    return compute(selectedCam(), parseNum(state.f), parseNum(state.L), parseNum(state.R));
  }

  function renderMain() {
    const cam = selectedCam();
    $('cam-name').textContent = cam ? cam.name : '機材を選択してください';
    $('cam-mode').textContent = cam ? cam.mode : '';
    $('chips').innerHTML = cam ? `<span class="chip">Sw:${cam.sw}mm</span><span class="chip">Pw:${cam.pw}px</span><span class="chip">最短:${Math.round(cam.min)}mm</span>` : '';
    const prev = currentResult();
    const res = state.committed ? prev : null;
    [['f', 'f', 4], ['L', 'L', 4], ['R', 'R', 6]].forEach(([k, id, dec]) => {
      const inp = $('in-' + id), box = $('box-' + id), pv = $('pv-' + id);
      const isRes = res && res.target === k;
      box.classList.toggle('res', !!isRes);
      box.classList.toggle('warn', !!(isRes && res.warn));
      inp.readOnly = !!isRes;
      const nv = isRes ? fmt(res.value, dec) : state[k];
      if (inp.value !== nv) inp.value = nv;
      const unit = { f: 'mm', L: 'm', R: 'mm/px' }[k];
      pv.textContent = (!isRes && prev && prev.target === k) ? `≈ ${fmt(prev.value, dec)} ${unit}` : '';
    });
    $('btn-calc').disabled = !prev;
    const rc = $('result');
    if (res) {
      rc.hidden = false; rc.classList.toggle('warn', res.warn);
      $('res-label').textContent = res.label + ' — 計算結果';
      $('res-val').textContent = fmt(res.value, res.dec);
      $('res-unit').textContent = res.unit;
      const fv = res.target === 'f' ? fmt(res.value, 4) : (state.f || '—');
      const lv = res.target === 'L' ? fmt(res.value, 4) : (state.L || '—');
      const rv = res.target === 'R' ? fmt(res.value, 6) : (state.R || '—');
      $('res-sum').textContent = `f=${fv}mm  L=${lv}m  R=${rv}mm/px`;
      $('warn').hidden = !res.warn;
      if (res.warn) $('warn-diff').textContent = `最短撮影距離まであと ${res.diff.toFixed(1)} mm です`;
    } else { rc.hidden = true; $('warn').hidden = true; }
    renderConv();
  }

  /* ---- 35mm換算コンバータ ---- */
  function convSw() {
    if (convTab === 'cam') {
      const c = state.cameras.find(x => keyOf(x) === (convCamKey || state.selected));
      return c ? c.sw : null;
    }
    return parseNum($('conv-sw').value);
  }
  function renderConv() {
    $('tab-cam').classList.toggle('on', convTab === 'cam');
    $('tab-man').classList.toggle('on', convTab === 'man');
    $('conv-cam-wrap').hidden = convTab !== 'cam';
    $('conv-man-wrap').hidden = convTab !== 'man';
    const sel = $('conv-cam');
    if (!sel.dataset.built || sel.dataset.n !== String(state.cameras.length)) {
      sel.innerHTML = state.cameras.map(c => `<option value="${escapeHtml(keyOf(c))}">${escapeHtml(c.name)} [${escapeHtml(c.mode)}] Sw:${c.sw}</option>`).join('');
      sel.dataset.built = '1'; sel.dataset.n = String(state.cameras.length);
    }
    if (!convCamKey) convCamKey = state.selected;
    if (convCamKey) sel.value = convCamKey;
    const eq = parseNum($('conv-eq').value), sw = convSw();
    const ok = eq && sw;
    $('conv-out').textContent = ok ? fmt(calc35mmToActual(eq, sw), 4) + ' mm' : '—';
    $('conv-note').textContent = ok ? `${eq}mm × (${sw} ÷ 36)` : '';
    $('btn-usef').disabled = !ok;
  }

  /* ---- 機材選択ピッカー ---- */
  function openPicker() { pickMaker = null; renderPicker(); $('m-pick').hidden = false; }
  function renderPicker() {
    const body = $('pick-body');
    const groups = {};
    state.cameras.forEach(c => (groups[makerOf(c.name)] = groups[makerOf(c.name)] || []).push(c));
    const makers = MAKERS.filter(m => groups[m]).concat(Object.keys(groups).filter(m => MAKERS.indexOf(m) < 0));
    if (!pickMaker) {
      $('pick-title').textContent = 'メーカーを選択';
      $('pick-back').hidden = true;
      body.innerHTML = makers.map(m => `<button class="row" data-maker="${escapeHtml(m)}"><div><b>${escapeHtml(m)}</b><small>${groups[m].length}機材</small></div><span class="chev">›</span></button>`).join('') || '<p class="empty">機材がありません。機材管理から追加してください。</p>';
    } else {
      const list = groups[pickMaker] || [];
      $('pick-title').textContent = `${pickMaker}（${list.length}件）`;
      $('pick-back').hidden = false;
      body.innerHTML = list.map(c => `<button class="row ${keyOf(c) === state.selected ? 'sel' : ''}" data-key="${escapeHtml(keyOf(c))}"><div><b>${escapeHtml(c.name)}</b><small>[${escapeHtml(c.mode)}]  Sw:${c.sw}mm  Pw:${c.pw}px</small></div></button>`).join('');
    }
  }
  function selectCamera(key) {
    const c = state.cameras.find(x => keyOf(x) === key);
    if (!c) return;
    state.selected = key;
    state.committed = false;
    if (c.focal) state.f = fmt(c.focal, 4);
    convCamKey = key;
    save(); renderMain();
  }

  /* ---- 機材管理 ---- */
  function renderDevices() {
    const list = $('dev-list');
    const sorted = state.cameras.slice().sort((a, b) => {
      const ma = makerOf(a.name), mb = makerOf(b.name);
      const ia = MAKERS.indexOf(ma) < 0 ? 99 : MAKERS.indexOf(ma), ib = MAKERS.indexOf(mb) < 0 ? 99 : MAKERS.indexOf(mb);
      return ia - ib || a.name.localeCompare(b.name) || a.mode.localeCompare(b.mode);
    });
    list.innerHTML = sorted.map(c => `<div class="dev"><div class="dev-main"><b>${escapeHtml(c.name)}</b> <span class="mode">${escapeHtml(c.mode)}</span><small>Sw:${c.sw}mm / Pw:${c.pw}px / 最短:${Math.round(c.min)}mm${c.focal ? ' / 初期f:' + c.focal + 'mm' : ''}</small></div><div class="dev-act"><button class="mini" data-edit="${c.id}">編集</button><button class="mini danger" data-del="${c.id}">削除</button></div></div>`).join('') || '<p class="empty">機材がありません</p>';
    $('dev-count').textContent = `${state.cameras.length}件`;
  }
  function openEdit(id) {
    editingId = id || null;
    const c = id ? state.cameras.find(x => x.id === id) : null;
    $('edit-title').textContent = c ? '機材を編集' : '機材を追加';
    $('e-name').value = c ? c.name : '';
    $('e-mode').value = c ? c.mode : '';
    $('e-sw').value = c ? c.sw : '';
    $('e-pw').value = c ? c.pw : '';
    $('e-min').value = c ? c.min : '';
    $('e-focal').value = c && c.focal ? c.focal : '';
    $('e-err').textContent = '';
    $('m-edit').hidden = false;
  }
  function saveEdit() {
    const name = $('e-name').value.trim(), mode = $('e-mode').value.trim();
    const sw = parseNum($('e-sw').value), pw = parseNum($('e-pw').value);
    const minRaw = $('e-min').value.trim(), min = minRaw === '' ? 0 : Number(minRaw.replace(',', '.'));
    const focalRaw = $('e-focal').value.trim(), focal = focalRaw === '' ? null : parseNum(focalRaw);
    const err = m => { $('e-err').textContent = m; };
    if (!name) return err('機材名を入力してください');
    if (!sw) return err('センサー幅(mm)は0より大きい数値で入力してください');
    if (!pw) return err('横ピクセル数は0より大きい数値で入力してください');
    if (!isFinite(min) || min < 0) return err('最短撮影距離は0以上の数値で入力してください');
    if (focalRaw !== '' && !focal) return err('初期焦点距離は0より大きい数値、または空欄にしてください');
    const cand = { name, mode, sw, pw: Math.round(pw), min, focal };
    const dup = state.cameras.find(c => keyOf(c) === keyOf(cand) && c.id !== editingId);
    if (dup) return err('同じ名前・モードの機材が既にあります');
    if (editingId) {
      const c = state.cameras.find(x => x.id === editingId);
      const oldKey = keyOf(c), wasSel = state.selected === oldKey;
      Object.assign(c, cand);
      if (wasSel) state.selected = keyOf(c);
    } else {
      cand.id = 'c' + (uid++); state.cameras.push(cand);
      // 以前削除したプリセットと同名なら削除済みリストから外す
      state.deleted = state.deleted.filter(k => k !== keyOf(cand));
    }
    save(); $('m-edit').hidden = true; renderDevices(); renderMain(); toast('保存しました');
  }
  function deleteCam(id) {
    const c = state.cameras.find(x => x.id === id);
    if (!c || !confirm(`「${c.name} [${c.mode}]」を削除しますか？`)) return;
    const k = keyOf(c);
    state.cameras = state.cameras.filter(x => x.id !== id);
    if (PRESETS.some(p => p[0] + '|' + p[1] === k) && state.deleted.indexOf(k) < 0) state.deleted.push(k);
    if (state.selected === k) { state.selected = state.cameras[0] ? keyOf(state.cameras[0]) : null; state.committed = false; }
    save(); renderDevices(); renderMain(); toast('削除しました');
  }
  function resetPresets() {
    if (!confirm('初期機材リストを復元します。削除したプリセットが再び追加されます（追加・編集した機材はそのまま残ります）。よろしいですか？')) return;
    state.deleted = [];
    const have = new Set(state.cameras.map(keyOf));
    PRESETS.forEach(p => { const c = presetToCam(p); if (!have.has(keyOf(c))) state.cameras.push(c); });
    save(); renderDevices(); renderMain(); toast('復元しました');
  }
  function exportJson() {
    const data = JSON.stringify(state.cameras.map(c => ({ name: c.name, mode: c.mode, sensorWidthMm: c.sw, horizontalPixels: c.pw, minFocusDistanceMm: c.min, defaultFocalLengthMm: c.focal })), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'cracknavi_cameras.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function importJson(file) {
    const r = new FileReader();
    r.onload = () => {
      let arr;
      try { arr = JSON.parse(r.result); } catch (e) { return toast('JSONの形式が正しくありません'); }
      if (!Array.isArray(arr)) return toast('JSONの形式が正しくありません');
      const good = [];
      arr.forEach(o => {
        if (!o || typeof o.name !== 'string' || !o.name.trim()) return;
        const sw = Number(o.sensorWidthMm), pw = Number(o.horizontalPixels);
        if (!(sw > 0) || !(pw > 0)) return;
        good.push({ name: o.name.trim().slice(0, 80), mode: String(o.mode == null ? '' : o.mode).slice(0, 40), sw, pw: Math.round(pw), min: Number(o.minFocusDistanceMm) >= 0 ? Number(o.minFocusDistanceMm) : 0, focal: Number(o.defaultFocalLengthMm) > 0 ? Number(o.defaultFocalLengthMm) : null });
      });
      if (!good.length) return toast('有効な機材がありませんでした');
      if (!confirm(`${good.length}件の機材を取り込みます。同じ名前・モードの機材は上書きされます。よろしいですか？`)) return;
      good.forEach(g => {
        const ex = state.cameras.find(c => keyOf(c) === keyOf(g));
        if (ex) Object.assign(ex, g); else { g.id = 'c' + (uid++); state.cameras.push(g); }
        state.deleted = state.deleted.filter(k => k !== keyOf(g));
      });
      save(); renderDevices(); renderMain(); toast(`${good.length}件を取り込みました`);
    };
    r.readAsText(file);
  }

  /* ---- イベント ---- */
  function init() {
    load();
    if (!selectedCam() && state.cameras.length) state.selected = keyOf(state.cameras[0]);
    const c0 = selectedCam();
    if (c0 && c0.focal && !state.f) state.f = fmt(c0.focal, 4);
    convCamKey = state.selected;

    ['f', 'L', 'R'].forEach(k => $('in-' + k).addEventListener('input', e => { state[k] = e.target.value; state.committed = false; renderMain(); }));
    // 入力中に再描画しても入力欄が失われないよう、結果表示時以外は値のみ更新する
    $('card-cam').addEventListener('click', openPicker);
    $('btn-calc').addEventListener('click', () => { if (currentResult()) { state.committed = true; renderMain(); $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } });
    $('btn-clear').addEventListener('click', () => { state.f = state.L = state.R = ''; state.committed = false; const c = selectedCam(); if (c && c.focal) state.f = fmt(c.focal, 4); renderMain(); });
    $('btn-help').addEventListener('click', () => show('help'));
    $('btn-dev').addEventListener('click', () => show('devices'));
    $('btn-back').addEventListener('click', () => show('main'));
    $('pick-close').addEventListener('click', () => $('m-pick').hidden = true);
    $('pick-back').addEventListener('click', () => { pickMaker = null; renderPicker(); });
    $('pick-body').addEventListener('click', e => {
      const b = e.target.closest('button.row'); if (!b) return;
      if (b.dataset.maker) { pickMaker = b.dataset.maker; renderPicker(); }
      else if (b.dataset.key) { selectCamera(b.dataset.key); $('m-pick').hidden = true; }
    });
    $('m-pick').addEventListener('click', e => { if (e.target === $('m-pick')) $('m-pick').hidden = true; });
    $('tab-cam').addEventListener('click', () => { convTab = 'cam'; renderConv(); });
    $('tab-man').addEventListener('click', () => { convTab = 'man'; renderConv(); });
    $('conv-cam').addEventListener('change', e => { convCamKey = e.target.value; renderConv(); });
    $('conv-eq').addEventListener('input', renderConv);
    $('conv-sw').addEventListener('input', renderConv);
    $('btn-usef').addEventListener('click', () => {
      const eq = parseNum($('conv-eq').value), sw = convSw();
      if (!eq || !sw) return;
      state.f = fmt(calc35mmToActual(eq, sw), 4); state.committed = false; renderMain(); toast('焦点距離に反映しました');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    $('btn-add').addEventListener('click', () => openEdit(null));
    $('dev-list').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) openEdit(b.dataset.edit); else if (b.dataset.del) deleteCam(b.dataset.del);
    });
    $('e-cancel').addEventListener('click', () => $('m-edit').hidden = true);
    $('e-save').addEventListener('click', saveEdit);
    $('btn-export').addEventListener('click', exportJson);
    $('btn-import').addEventListener('click', () => $('file-import').click());
    $('file-import').addEventListener('change', e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ''; });
    $('btn-reset').addEventListener('click', resetPresets);
    renderMain(); show('main');
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  document.addEventListener('DOMContentLoaded', init);
}
if (typeof module !== 'undefined') module.exports = { parseNum, calcR, calcF, calcL, calc35mmToActual, fmt, compute, makerOf, PRESETS, escapeHtml };
