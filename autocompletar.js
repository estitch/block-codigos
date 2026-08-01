/* autocompletar.js — Autocompletado predictivo: Trie (prefijos) + LRU cache.
   Sugiere valores existentes de Marca/Submarca/Producto ordenados por frecuencia. */

const AC_MAX_SUG    = 8;
const AC_MIN_LEN    = 1;
const AC_CACHE_MAX  = 128;

let _acDirty          = true;
let _acObtenerCodigos = null;
let _acTries          = new Map();
let _acCache          = new Map();
let _acDropdown       = null;
let _acCampoActual    = null;
let _acActivo         = -1;
let _acUltimas        = null;

function _acNormalizar(s) {
  return normalizarTexto(s);
}

function _acNodo() {
  return { hijos: new Map(), mejores: [] };
}

function _acPushMejor(nodo, valor, freq) {
  const arr = nodo.mejores;
  const i = arr.findIndex(x => x.valor === valor);
  if (i !== -1) { arr[i].freq = Math.max(arr[i].freq, freq); return; }
  arr.push({ valor, freq });
  arr.sort((a, b) => b.freq - a.freq || a.valor.localeCompare(b.valor));
  if (arr.length > AC_MAX_SUG) arr.length = AC_MAX_SUG;
}

function _acInsertar(raiz, clave, valorOriginal, freq) {
  let nodo = raiz;
  for (const ch of clave) {
    if (!nodo.hijos.has(ch)) nodo.hijos.set(ch, _acNodo());
    nodo = nodo.hijos.get(ch);
    _acPushMejor(nodo, valorOriginal, freq);
  }
}

function construirTrie(codigos, campo) {
  const raiz = _acNodo();
  const grupos = new Map();
  codigos.forEach(c => {
    const v = String(c[campo] || '').trim();
    const k = _acNormalizar(v);
    if (!v || !k) return;
    const g = grupos.get(k);
    if (g) { g.freq++; if (!g.valor) g.valor = v; }
    else grupos.set(k, { valor: v, freq: 1 });
  });
  grupos.forEach((g, k) => _acInsertar(raiz, k, g.valor, g.freq));
  return raiz;
}

function inicializarAutocompletado(obtenerCodigos) {
  if (typeof obtenerCodigos === 'function') _acObtenerCodigos = obtenerCodigos;
  if (!_acObtenerCodigos) return;
  const codigos = _acObtenerCodigos();
  for (const campo of ['marca', 'submarca', 'producto']) {
    _acTries.set(campo, construirTrie(codigos, campo));
  }
  _acCache.clear();
  _acDirty = false;
  _acEnlazarInputs();
}

function _acSugerir(campo, texto) {
  const prefijo = _acNormalizar(texto);
  if (!prefijo || prefijo.length < AC_MIN_LEN) return [];
  const key = campo + '|' + prefijo;
  if (_acCache.has(key)) {
    const v = _acCache.get(key);
    _acCache.delete(key);
    _acCache.set(key, v);
    return v;
  }
  let nodo = _acTries.get(campo);
  if (nodo) {
    for (const ch of prefijo) {
      nodo = nodo.hijos.get(ch);
      if (!nodo) break;
    }
  }
  const res = (nodo && nodo.mejores) ? nodo.mejores.slice() : [];
  _acCache.set(key, res);
  if (_acCache.size > AC_CACHE_MAX) {
    _acCache.delete(_acCache.keys().next().value);
  }
  return res;
}

// ─── DROPDOWN ─────────────────────────────────────────────

function _acEnlazarInputs() {
  ['marca', 'submarca', 'producto'].forEach(campo => {
    const input = document.getElementById('f-' + campo);
    if (!input || input.dataset.ac) return;
    input.dataset.ac = '1';
    input.addEventListener('input', () => _acOnInput(input, campo));
    input.addEventListener('keydown', e => _acOnKey(input, e));
    input.addEventListener('blur', () => setTimeout(_acCerrar, 150));
  });
}

function _acOnInput(input, campo) {
  if (_acDirty && _acObtenerCodigos) inicializarAutocompletado(null);
  _acMostrar(input, _acSugerir(campo, input.value), campo);
}

function _acEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _acMostrar(input, sugerencias, campo) {
  _acCerrar();
  if (!sugerencias.length) return;
  _acCampoActual = campo;
  _acUltimas = sugerencias;
  const rect = input.getBoundingClientRect();
  const div = document.createElement('div');
  div.className = 'ac-dropdown';
  div.id = 'ac-dropdown';
  div.style.left = rect.left + 'px';
  div.style.width = Math.max(rect.width, 180) + 'px';
  div.innerHTML = sugerencias.map((s, i) =>
    `<div class="ac-item" data-i="${i}">
      <span class="ac-val">${_acEsc(s.valor)}</span>
      <span class="ac-freq">×${s.freq}</span>
    </div>`).join('');
  div.addEventListener('mousedown', e => {
    const item = e.target.closest('.ac-item');
    if (item) { e.preventDefault(); _acSeleccionar(campo, parseInt(item.dataset.i, 10)); }
  });
  div.addEventListener('mousemove', e => {
    const item = e.target.closest('.ac-item');
    if (item) _acSetActivo(parseInt(item.dataset.i, 10));
  });
  const maxH = 260;
  if (rect.bottom + 4 + maxH > window.innerHeight) {
    div.style.top = Math.max(4, rect.top - 4 - Math.min(maxH, 40 + sugerencias.length * 30)) + 'px';
  } else {
    div.style.top = (rect.bottom + 4) + 'px';
  }
  _acDropdown = div;
  document.body.appendChild(div);
  _acSetActivo(-1);
}

function _acSetActivo(i) {
  if (!_acDropdown) return;
  _acActivo = i;
  _acDropdown.querySelectorAll('.ac-item').forEach((el, k) => el.classList.toggle('active', k === i));
  const el = _acDropdown.querySelector('.ac-item.active');
  if (el) {
    if (el.offsetTop < _acDropdown.scrollTop) _acDropdown.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > _acDropdown.scrollTop + _acDropdown.clientHeight) {
      _acDropdown.scrollTop = el.offsetTop + el.offsetHeight - _acDropdown.clientHeight;
    }
  }
}

function _acOnKey(input, e) {
  if (!_acDropdown) return;
  const items = _acDropdown.querySelectorAll('.ac-item');
  if (e.key === 'ArrowDown') { e.preventDefault(); _acSetActivo(Math.min(_acActivo + 1, items.length - 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _acSetActivo(Math.max(_acActivo - 1, 0)); }
  else if (e.key === 'Enter' || e.key === 'Tab') {
    if (_acActivo >= 0 && _acCampoActual) _acSeleccionar(_acCampoActual, _acActivo);
  }
  else if (e.key === 'Escape') { _acCerrar(); }
}

function _acSeleccionar(campo, i) {
  const sugerencia = _acUltimas && _acUltimas[i];
  const input = document.getElementById('f-' + campo);
  if (sugerencia && input) input.value = sugerencia.valor;
  _acCerrar();
}

function _acCerrar() {
  const d = _acDropdown || document.getElementById('ac-dropdown');
  if (d) d.remove();
  _acDropdown = null;
  _acActivo = -1;
  _acCampoActual = null;
  _acUltimas = null;
}

window.addEventListener('scroll', _acCerrar, true);
window.addEventListener('resize', _acCerrar);
