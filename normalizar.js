/* normalizar.js — Normalización inteligente de texto: NFD + stemming ligero (español).
   Capa compartida usada por busqueda.js y autocompletar.js. */

const STEM_SUFIJOS = ['es', 'os', 'as', 's', 'o', 'a'];

function normalizarTexto(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function stemizar(t) {
  if (t.length < 5) return t;
  for (const suf of STEM_SUFIJOS) {
    if (t.endsWith(suf) && t.length - suf.length >= 4) {
      return t.slice(0, -suf.length);
    }
  }
  return t;
}

function normalizarPalabras(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function coincideStem(campo, raiz) {
  if (!raiz) return false;
  for (const tok of normalizarPalabras(campo)) {
    if (stemizar(tok) === raiz || tok.startsWith(raiz)) return true;
  }
  return false;
}
