/* busqueda.js — Búsqueda difusa: n-gramas (bigramas) + Jaccard + ranking.
   Índice invertido: bigrama → ids[], para no barrer toda la colección. */

const FUZZY_THRESHOLD = 0.35;
const FUZZY_MIN_LEN   = 3;
const FUZZY_MAX       = 250;
const FUZZY_FIELDS    = ['codigo','version','tipo','marca','submarca','producto'];

function bigramas(s) {
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const g of a) if (b.has(g)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

function buildIndex(codigos) {
  const index = new Map();
  codigos.forEach((c, idx) => {
    const visto = new Set();
    for (const f of FUZZY_FIELDS) {
      const norm = normalizarTexto(c[f]);
      for (const g of bigramas(norm)) {
        if (visto.has(g)) continue;
        visto.add(g);
        if (!index.has(g)) index.set(g, []);
        index.get(g).push(idx);
      }
    }
  });
  return index;
}

function buscarFuzzy(q, codigos, index) {
  const norm = normalizarTexto(q);
  if (norm.length < FUZZY_MIN_LEN) return [];
  const qBig = bigramas(norm);
  if (qBig.size === 0) return [];

  const candidatos = new Set();
  for (const g of qBig) {
    const ids = index.get(g);
    if (ids) for (const idx of ids) candidatos.add(idx);
  }

  const res = [];
  for (const idx of candidatos) {
    let best = 0;
    for (const f of FUZZY_FIELDS) {
      const s = jaccard(qBig, bigramas(normalizarTexto(codigos[idx][f])));
      if (s > best) best = s;
    }
    if (best >= FUZZY_THRESHOLD) res.push({ idx, score: best });
  }
  res.sort((a, b) => b.score - a.score);
  return res.slice(0, FUZZY_MAX);
}
