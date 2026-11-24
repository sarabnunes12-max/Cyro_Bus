/* =====================================================================
   CYRO BUS — mapa (Leaflet + OpenStreetMap, sem chave de API)

   O que é real e o que é simulado:
   • O MAPA (ruas, zoom, arraste) é real: tiles do OpenStreetMap.
   • Os TRAJETOS e PARADAS são gerados a partir do número da linha
     (routeForLine) — rotas fictícias de demonstração. Linhas "Circular"
     fazem um laço; as demais vão e voltam do Terminal.
   • Os ÔNIBUS em movimento (só da linha escolhida) e a previsão de tempo
     são SIMULAÇÃO — não é GPS. Sempre acompanhados de SIM_NOTICE.
   • A localização do usuário (botão "Localização") é a real do aparelho.
   ===================================================================== */

const VALINHOS_CENTER = [-22.9707, -46.9937];
// Mapa-base limpo (CARTO + OpenStreetMap, gratuito, sem chave): claro no tema claro, escuro no escuro
const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
const mapTheme = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
const SIM_NOTICE = 'Localização simulada — recurso demonstrativo do MVP.';

// Paleta por linha: tons médios que funcionam no tema claro e no escuro
const LINE_COLORS = ['#f5b700','#1fb5c9','#ef6f4c','#4caf7d','#9b6bd6','#3d8bfd','#e8547c','#8a9a2b','#e08a1e','#2aa198'];
function lineColor(id) {
  const i = LINES.findIndex(l => l.id === id);
  return LINE_COLORS[(i < 0 ? 0 : i) % LINE_COLORS.length];
}

let userPos = null;       // posição real do aparelho (após "Localização")
let mapFocusPoi = null;   // destino escolhido na busca (mostrado no mapa)

/* ---------- geometria ---------- */
function distM(a, b) {
  const R = 6371000, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function fmtDist(m) { return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; }
function offsetPos(northKm, eastKm) {
  return [VALINHOS_CENTER[0] + northKm / 111,
          VALINHOS_CENTER[1] + eastKm / (111 * Math.cos(VALINHOS_CENTER[0] * Math.PI / 180))];
}

/* ---------- trajetos (pts[0] = Terminal) ---------- */
function hashLineId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const isCircular = line => /circular/i.test(line.name);
const _routes = {}, _lens = {};
function routeForLine(line) {
  if (_routes[line.id]) return _routes[line.id];
  // direção em leque (ângulo áureo): as linhas se espalham por todos os lados do Terminal
  const h = hashLineId(line.id), idx = Math.max(0, LINES.findIndex(l => l.id === line.id)), ph = h % 7, pts = [];
  const th = ((idx * 137.508 + (h % 16) - 8) % 360) * Math.PI / 180;
  const dir = [Math.cos(th), Math.sin(th)];   // [norte, leste]
  const perp = [Math.sin(th), -Math.cos(th)];
  if (isCircular(line)) {
    // laço que parte e termina no Terminal; o último ponto repete o primeiro
    const R = 0.9, n = 12;
    for (let i = 0; i <= n; i++) {
      const f = 2 * Math.PI * i / n, w = 1 + 0.15 * Math.sin(2 * f);
      pts.push(offsetPos(
        R * dir[0] + R * w * (-dir[0] * Math.cos(f) + perp[0] * Math.sin(f)),
        R * dir[1] + R * w * (-dir[1] * Math.cos(f) + perp[1] * Math.sin(f))));
    }
  } else {
    const len = 2.2 + ((idx * 7) % 6) * 0.9, n = Math.max(5, Math.round(len / 0.5)); // ~1 parada a cada 500 m
    for (let i = 0; i <= n; i++) {
      const r = len * i / n, side = 0.35 * Math.sin(i * 0.55 + ph) * Math.min(1, i / 2);
      pts.push(offsetPos(r * dir[0] + side * perp[0], r * dir[1] + side * perp[1]));
    }
  }
  return (_routes[line.id] = pts);
}
function routeLenKm(line) {
  if (_lens[line.id] == null) {
    const p = routeForLine(line);
    _lens[line.id] = p.slice(1).reduce((s, q, i) => s + distM(p[i], q), 0) / 1000;
  }
  return _lens[line.id];
}
function nearestStop(line, pos) {
  let best = { d: Infinity, i: 0 };
  routeForLine(line).forEach((p, i) => { const d = distM(pos, p); if (d < best.d) best = { d, i }; });
  return best;
}
function lineEnds(line) {
  if (isCircular(line)) return { from: 'Terminal', to: 'Terminal (percurso circular)' };
  const parts = line.itin.split(',').map(s => s.trim());
  return { from: 'Terminal', to: parts[parts.length - 1] };
}

/* ---------- simulação em TEMPO REAL, guiada pela tabela de horários ----------
   • Cada horário da tabela (data.js) é uma saída do Terminal: o ônibus parte
     naquele minuto, anda a SIM.kmh (≈ 20 km/h, média urbana), para SIM.dwellMs
     em cada parada, faz pausa no fim da linha e volta ao Terminal.
   • O relógio é o do aparelho (tempo real). Para demonstrações há um relógio
     simulado (velocidade 5×/20×/60× e "ir para horário").
   • Fora do horário de operação não há ônibus circulando (de propósito).
   • É SIMULAÇÃO: a posição NÃO vem de GPS. */
const SIM = { kmh: 20, dwellMs: 30000, layoverMs: 120000, preMs: 180000 };
const msPerKm = () => 3600000 / SIM.kmh;

let simSpeed = 1, simBaseReal = Date.now(), simBaseSim = Date.now();
const simNow = () => simBaseSim + (Date.now() - simBaseReal) * simSpeed;
function rebaseSim(ts, speed) { simBaseSim = ts; simBaseReal = Date.now(); simSpeed = speed; if (bigM) bigM.sig = null; }
function setSimSpeed(x) { rebaseSim(simNow(), x); updateClock(); }
function jumpSim(ts) { rebaseSim(ts, simSpeed); updateClock(); }
function setSimTime(hhmm) {
  if (!hhmm) return;
  const d = new Date(simNow()), [h, m] = hhmm.split(':').map(Number);
  d.setHours(h, m, 0, 0); jumpSim(d.getTime());
}
function resetSimClock() { rebaseSim(Date.now(), 1); updateClock(); }
const dayKeyOf = d => { const w = d.getDay(); return w === 0 ? 'sunday' : w === 6 ? 'saturday' : 'weekday'; };
const fmtClock = ts => new Date(ts).toTimeString().slice(0, 8);
const hhmmOf = ts => new Date(ts).toTimeString().slice(0, 5);
function etaText(ms) {
  if (ms < 45000) return '< 1 min';
  const m = Math.round(ms / 60000);
  return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
}

// plano de UMA viagem completa (ida + pausa + volta), em ms desde a saída do Terminal
const _plans = {};
function planFor(line) {
  if (_plans[line.id]) return _plans[line.id];
  const pts = routeForLine(line), n = pts.length - 1, circ = isCircular(line), km = [];
  for (let i = 0; i < n; i++) km.push(distM(pts[i], pts[i + 1]) / 1000);
  const ev = [], legEnd = [], legKm = []; let t = 0;
  const leg = (order, li) => {
    let d = 0;
    order.forEach((stop, j) => {
      const last = j === order.length - 1;
      if (j > 0 && !last) { ev.push({ k: 'dwell', stop, next: order[j + 1], ms: SIM.dwellMs, t0: t, d0: d, leg: li }); t += SIM.dwellMs; }
      if (!last) {
        const b = order[j + 1], sk = km[Math.min(stop, b)], ms = sk * msPerKm();
        ev.push({ k: 'move', from: stop, to: b, ms, km: sk, t0: t, d0: d, leg: li }); t += ms; d += sk;
      }
    });
    legEnd[li] = t; legKm[li] = d;
  };
  const up = Array.from({ length: n + 1 }, (_, i) => i);
  leg(up, 0);
  if (!circ) { // pausa no fim da linha (pertence à volta) e retorno ao Terminal
    ev.push({ k: 'dwell', stop: n, next: n - 1, ms: SIM.layoverMs, t0: t, d0: 0, leg: 1 }); t += SIM.layoverMs;
    leg(up.slice().reverse(), 1);
  }
  return (_plans[line.id] = { pts, n, circ, km, ev, legEnd, legKm, ms: t });
}

// estado do ônibus "eff" ms após a saída do Terminal (negativo = aguardando a saída)
function tripState(line, eff) {
  const P = planFor(line), base = { circ: P.circ };
  if (eff < 0) return { ...base, phase: 'pre', ida: true, dir: 1, stopped: true, stop: 0, next: 1, nextMs: -eff + P.ev[0].ms,
    pos: P.pts[0], f: 0, km: 0, totalKm: P.legKm[0], progress: 0, remMs: -eff + P.legEnd[0], leg: 0, speed: 0 };
  if (eff >= P.ms) { const end = P.circ ? P.n : 0; return { ...base, phase: 'done', ida: !!P.circ, dir: P.circ ? 1 : -1, stopped: true, stop: end, next: null, nextMs: 0,
    pos: P.pts[end], f: end, km: P.legKm[P.legKm.length - 1], totalKm: P.legKm[P.legKm.length - 1], progress: 1, remMs: 0, leg: P.legKm.length - 1, speed: 0 }; }
  let idx = P.ev.length - 1;
  for (let i = 0; i < P.ev.length; i++) { const x = P.ev[i]; if (eff >= x.t0 && eff < x.t0 + x.ms) { idx = i; break; } }
  const e = P.ev[idx], li = e.leg, stopped = e.k === 'dwell';
  let pos, f, km, next, nextMs;
  if (stopped) {
    pos = P.pts[e.stop]; f = e.stop; km = e.d0; next = e.next;
    nextMs = (e.t0 + e.ms - eff) + P.ev[idx + 1].ms;
  } else {
    const u = (eff - e.t0) / e.ms, a = P.pts[e.from], b = P.pts[e.to];
    pos = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
    f = e.from + (e.to - e.from) * u; km = e.d0 + e.km * u; next = e.to; nextMs = e.t0 + e.ms - eff;
  }
  return { ...base, phase: 'run', ida: li === 0, dir: li === 0 ? 1 : -1, stopped, stop: stopped ? e.stop : null, next, nextMs, pos, f, km,
    totalKm: P.legKm[li], progress: P.legKm[li] ? km / P.legKm[li] : 0, remMs: Math.max(0, P.legEnd[li] - eff), leg: li, speed: stopped ? 0 : SIM.kmh };
}
function kmBetween(P, f, g) { // distância ao longo do trajeto entre duas posições fracionárias
  const lo = Math.min(f, g), hi = Math.max(f, g); let s = 0;
  for (let i = Math.floor(lo); i < Math.ceil(hi); i++) s += P.km[i] * (Math.min(hi, i + 1) - Math.max(lo, i));
  return s;
}
function stopSim(m) { if (m.raf) cancelAnimationFrame(m.raf); m.raf = null; }

/* ---------- saídas da tabela de horários ---------- */
function allDeps(line, now) { // saídas de ontem, hoje e amanhã (cobre viagens que cruzam a meia-noite)
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const base = d0.getTime(), out = [];
  [-1, 0, 1].forEach(off => {
    const key = dayKeyOf(new Date(base + off * 86400000 + 43200000));
    (line.s[key] || []).forEach(hhmm => {
      const [h, m] = hhmm.split(':').map(Number), ts = base + off * 86400000 + (h * 60 + m) * 60000;
      out.push({ tid: line.id + '@' + ts, dep: hhmm, depTs: ts });
    });
  });
  return out;
}
// ocorrências simuladas: tid -> {broken, at (eff congelado), since, delay (atraso acumulado)}
const _flags = {};
function activeTrips(line, now) { // ônibus em circulação (ou aguardando a saída) neste instante
  const P = planFor(line), out = [];
  allDeps(line, now).forEach(x => {
    const f = _flags[x.tid] || {}, raw = now - x.depTs;
    if (raw < -SIM.preMs) return;
    const eff = f.broken ? f.at : raw - (f.delay || 0);
    if (!f.broken && eff >= P.ms) return;
    out.push({ tid: x.tid, dep: x.dep, eff, broken: !!f.broken, since: f.since });
  });
  return out.sort((a, b) => b.eff - a.eff);
}
function nextDeparture(line, now) { return allDeps(line, now).filter(x => x.depTs > now).sort((a, b) => a.depTs - b.depTs)[0] || null; }
function arrivalOffset(P, leg, stopIdx) { // ms após a saída em que o ônibus chega a stopIdx naquele sentido
  if (leg === 0 && stopIdx === 0) return 0;
  if (leg === 1 && stopIdx === P.n) return P.ev.find(e => e.leg === 1).t0;
  const e = P.ev.find(x => x.leg === leg && x.k === 'move' && x.to === stopIdx);
  return e ? e.t0 + e.ms : null;
}
function nextArrivalAt(line, stopIdx, leg, now, skipTid) {
  const P = planFor(line), off = arrivalOffset(P, P.circ ? 0 : leg, stopIdx);
  if (off == null) return null;
  let best = null;
  allDeps(line, now).forEach(x => {
    const f = _flags[x.tid] || {};
    if (x.tid === skipTid || f.broken) return;
    const ts = x.depTs + (f.delay || 0) + off;
    if (ts >= now - 15000 && (best == null || ts < best)) best = ts;
  });
  return best;
}

/* ---------- ônibus quebrado: alternativas ---------- */
function computeAlternatives(line, s, tid, now) {
  const P = planFor(line), here = s.pos, d = tripDirection(line, s);
  const destPos = s.circ ? P.pts[0] : (s.ida ? P.pts[P.n] : P.pts[0]);
  const stopIdx = Math.round(s.f);
  const same = { stopIdx, at: nextArrivalAt(line, stopIdx, s.ida ? 0 : 1, now, tid) };
  let best = null;
  // procura uma linha que passe perto do ônibus parado e perto do destino; se não houver,
  // aceita caminhadas maiores em etapas (600/900 m, depois 1000/1500 m)
  for (const [maxA, maxB] of [[600, 900], [1000, 1500]]) {
    LINES.forEach(l => {
      if (l.id === line.id || isCircular(l)) return;
      const a = nearestStop(l, here), b = nearestStop(l, destPos);
      if (a.d > maxA || b.d > maxB || a.i === b.i) return;
      const score = a.d + b.d * 0.7;
      if (!best || score < best.score) best = { l, a, b, score };
    });
    if (best) break;
  }
  let other = null;
  if (best) {
    const OP = planFor(best.l), leg = best.b.i > best.a.i ? 0 : 1;
    const rideMs = kmBetween(OP, best.a.i, best.b.i) * msPerKm() + Math.abs(best.b.i - best.a.i) * SIM.dwellMs;
    other = { l: best.l, a: best.a, b: best.b, rideMs, at: nextArrivalAt(best.l, best.a.i, leg, now) };
  }
  return { same, other, here, dest: d.dest, destPos };
}
function clearAlt(m) { if (m.altLayer) { m.map.removeLayer(m.altLayer); m.altLayer = null; } }
function drawAlt(m, alt) {
  clearAlt(m);
  if (!alt || !alt.other) return;
  const { l, a, b } = alt.other, pts = routeForLine(l), c = lineColor(l.id);
  const seg = a.i <= b.i ? pts.slice(a.i, b.i + 1) : pts.slice(b.i, a.i + 1).reverse();
  const g = m.altLayer = L.layerGroup().addTo(m.map);
  L.polyline(pts, { color: c, weight: 4, opacity: 0.45, dashArray: '2 9', lineCap: 'round' }).addTo(g);
  L.polyline(seg, { className: 'route-casing', weight: 12, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(g);
  L.polyline(seg, { color: c, weight: 8, lineCap: 'round', lineJoin: 'round' }).addTo(g)
    .bindTooltip(`Alternativa: linha ${l.id}`, { sticky: true });
  L.polyline([alt.here, pts[a.i]], { color: '#9aa3b2', weight: 3, dashArray: '2 8' }).addTo(g);
  L.marker(pts[a.i], { icon: pointIcon('board'), zIndexOffset: 700 })
    .bindPopup(`<b>Embarque — linha ${l.id}</b><br>Parada ${a.i} · a ${fmtDist(a.d)} do ônibus quebrado`).addTo(g);
  L.marker(pts[b.i], { icon: pointIcon('dest'), zIndexOffset: 700 })
    .bindPopup(`<b>Desembarque</b><br>Perto de ${alt.dest} (a ${fmtDist(b.d)})`).addTo(g);
  m.map.fitBounds(L.latLngBounds(seg.concat([alt.here, alt.destPos])), fitPad(m));
}

/* ---------- pontos de referência ao longo do percurso ---------- */
const _refs = {};
function lineRefs(line) { // [{idx, name, kind: 'via' | 'poi', poi?}] em ordem de parada
  if (_refs[line.id]) return _refs[line.id];
  const P = planFor(line), nEff = P.circ ? P.n - 1 : P.n;
  const parts = line.itin.split(',').map(x => x.trim().replace(/\s*\(.*\)\s*$/, '')).filter(x => x && !/^terminal$/i.test(x));
  let refs = parts.map((name, j) => ({ idx: Math.max(1, Math.round((j + 1) * nEff / parts.length)), name, kind: 'via' }));
  POIS.forEach(p => {
    const ns = nearestStop(line, p.pos);
    // roteiro: locais que o levantamento atribui à linha; ou, sem atribuição, os muito próximos de uma parada
    // (os do entorno do Terminal ficam só em "estabelecimentos próximos")
    const official = p.lines && p.lines.includes(line.id);
    if (official || (!p.lines && ns.i >= 1 && ns.d <= 250)) refs.push({ idx: ns.i, name: p.name, kind: 'poi', poi: p, d: ns.d });
  });
  const same = (a, b) => { const x = norm(a), y = norm(b); return x.includes(y) || y.includes(x); };
  refs = refs.filter(r => !(r.kind === 'via' && refs.some(q => q.kind === 'poi' && same(q.name, r.name))));
  refs.sort((a, b) => a.idx - b.idx);
  return (_refs[line.id] = refs);
}
function stopLabel(line, i) {
  const P = planFor(line);
  if (i === 0 || (P.circ && i === P.n)) return 'Terminal';
  if (i === P.n) return 'Final da linha';
  const r = lineRefs(line).find(x => x.idx === i);
  return 'Parada ' + i + (r ? ' · ' + r.name : '');
}
function nextRef(line, s) { // próximo ponto de referência à frente do ônibus
  const refs = lineRefs(line), P = planFor(line), eps = 1e-6;
  const r = s.dir > 0 ? refs.find(x => x.idx > s.f + eps) : [...refs].reverse().find(x => x.idx < s.f - eps);
  if (!r) return null;
  const cnt = Math.max(0, Math.ceil(Math.max(s.f, r.idx)) - 1 - Math.floor(Math.min(s.f, r.idx)));
  return { ref: r, ms: kmBetween(P, s.f, r.idx) * msPerKm() + cnt * SIM.dwellMs };
}
function nearbyPois(pos, max = 4) {
  return POIS.map(p => ({ p, d: distM(pos, p.pos) })).filter(x => x.d <= WALK_MAX).sort((a, b) => a.d - b.d).slice(0, max);
}
function tripDirection(line, s) {
  const e = lineEnds(line);
  if (s.circ) return { from: 'Terminal', dest: 'Terminal (fim do circuito)' };
  return s.ida ? { from: 'Terminal', dest: e.to } : { from: e.to, dest: 'Terminal' };
}

/* ---------- ícones (estilo app de corrida: limpo, com sombra suave) ---------- */
const BUS_SVG = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="13" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="19.5" r="1"/><circle cx="16" cy="19.5" r="1"/></svg>';
const busIcon = (line, tracked) => L.divIcon({ className: 'bus99-wrap', iconSize: [40, 40], iconAnchor: [20, 20],
  html: `<div class="bus99${tracked ? ' tracked' : ''}" style="--c:${lineColor(line.id)}"><span class="halo"></span><div class="core">${BUS_SVG}</div><b class="bb"></b></div>` });
const pointIcon = kind => L.divIcon({ className: 'pt-wrap', iconSize: [18, 18], iconAnchor: [9, 9], html: `<div class="pt ${kind}"></div>` });
const poiMiniIcon = cat => L.divIcon({ className: 'poi-mini-wrap', iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="poi-mini">${svgIcon(cat)}</div>` });
function arrowIcon(a, b) {
  const deg = Math.atan2((b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI;
  return L.divIcon({ className: 'dir-arrow', iconSize: [14, 14], iconAnchor: [7, 7],
    html: `<svg viewBox="0 0 24 24" style="transform:rotate(${deg}deg)"><path d="M6 15l6-7 6 7"/></svg>` });
}

let trackedBus = null;   // {id, tid}: ônibus acompanhado no painel
let followBus = false;   // câmera segue o ônibus
let homeM = null, bigM = null;
const isMobile = () => window.matchMedia('(max-width:860px)').matches;
const $id = id => document.getElementById(id);

function initMap(elId, big) {
  const map = L.map(elId, { zoomControl: false, attributionControl: false }).setView(VALINHOS_CENTER, 13);
  const tiles = L.tileLayer(TILES[mapTheme()], { maxZoom: 19, subdomains: 'abcd', attribution: TILE_ATTR }).addTo(map);
  L.control.attribution({ position: big && isMobile() ? 'topleft' : 'bottomright', prefix: false }).addTo(map);
  if (big) L.control.zoom({ position: 'topright' }).addTo(map);
  return { map, tiles, layer: L.layerGroup().addTo(map), raf: null, buses: [], big };
}
function applyMapTheme() { [homeM, bigM].forEach(m => m && m.tiles.setUrl(TILES[mapTheme()])); }

const fitPad = m => m.big
  ? (isMobile() ? { paddingTopLeft: [30, 70], paddingBottomRight: [30, Math.round(m.map.getSize().y * 0.5)] }
                : { paddingTopLeft: [(($id('trip-panel') || {}).offsetWidth || 372) + 38, 60], paddingBottomRight: [60, 40] })
  : { padding: [24, 24] };

// trecho já percorrido (cinza) x trecho restante (cor da linha), como nos apps de corrida
function updateRouteSplit(m, line, s) {
  const pts = routeForLine(line), i = Math.floor(s.f), j = Math.ceil(s.f);
  const done = s.dir > 0 ? pts.slice(0, i + 1).concat([s.pos]) : pts.slice(j).reverse().concat([s.pos]);
  const rem = s.dir > 0 ? [s.pos].concat(pts.slice(j)) : [s.pos].concat(pts.slice(0, i + 1).reverse());
  m.done.setLatLngs(done); m.rem.setLatLngs(rem);
}

function ensureTracked(line, trips) {
  if (!trackedBus || trackedBus.id !== line.id || !trips.some(t => t.tid === trackedBus.tid))
    trackedBus = { id: line.id, tid: trips.length ? trips[0].tid : null };
}
const sigFor = (line, trips) => line.id + '|' + trips.map(t => t.tid + (t.broken ? '!' : '')).join(',') + '|' + (trackedBus && trackedBus.tid);

function drawMap(m, id, o) {
  stopSim(m); m.layer.clearLayers(); clearAlt(m);
  m.done = m.rem = null; m.buses = {}; m.sig = null; m.trips = []; m.alt = null;
  const g = m.layer, focus = id ? lineById(id) : null;
  m.focus = focus;

  // rede esmaecida ao fundo (toque numa rota para escolher a linha)
  LINES.forEach(l => {
    if (focus && l.id === focus.id) return;
    L.polyline(routeForLine(l), { color: lineColor(l.id), weight: 3, opacity: focus ? 0.14 : 0.3, lineCap: 'round', lineJoin: 'round' })
      .on('click', () => m.big ? selectMapLine(l.id) : viewRoute(l.id))
      .bindTooltip(`Linha ${l.id} — ${l.name}`, { sticky: true }).addTo(g);
  });
  let bounds = L.latLngBounds([].concat(...LINES.map(routeForLine)));
  const origin = routeForLine(LINES[0])[0];

  if (focus) {
    const pts = routeForLine(focus), c = lineColor(focus.id), circ = isCircular(focus);
    L.polyline(pts, { className: 'route-casing', weight: 11, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(g);
    m.rem = L.polyline(pts, { color: c, weight: 7, lineCap: 'round', lineJoin: 'round' }).addTo(g);
    m.done = L.polyline([], { className: 'route-done', weight: 7, lineCap: 'round', lineJoin: 'round' }).addTo(g);
    for (let i = 1; i < pts.length; i += 2)
      L.marker([(pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2],
        { icon: arrowIcon(pts[i - 1], pts[i]), interactive: false, keyboard: false }).addTo(g);
    pts.forEach((p, i) => {
      if (i === 0 || i === pts.length - 1) return;
      L.circleMarker(p, { radius: 5, color: c, weight: 3, fillColor: '#fff', fillOpacity: 1 })
        .bindPopup(`<b>Linha ${focus.id}</b><br>${stopLabel(focus, i)}<br><small>${focus.name}</small>`).addTo(g);
    });
    L.marker(pts[pts.length - 1], { icon: pointIcon(circ ? 'origin' : 'dest') })
      .bindPopup(circ ? 'Terminal Rodoviário — Valinhos' : `Final da linha: ${lineEnds(focus).to}`).addTo(g);
    if (!o.mini) lineRefs(focus).filter(r => r.kind === 'poi').forEach(r =>
      L.marker(r.poi.pos, { icon: poiMiniIcon(r.poi.cat) })
        .bindPopup(`<b>${r.poi.name}</b><br>${r.poi.addr}<br><small>Parada mais próxima: ${stopLabel(focus, r.idx)} (${fmtDist(r.d)})</small>`).addTo(g));
    bounds = L.latLngBounds(pts);
  }
  L.marker(origin, { icon: pointIcon('origin'), zIndexOffset: 400 }).bindPopup('Terminal Rodoviário — Valinhos').addTo(g);

  if (o.poi) {
    const ref = focus || lineById(nearLines(o.poi).list[0].l.id), ns = nearestStop(ref, o.poi.pos);
    L.polyline([o.poi.pos, routeForLine(ref)[ns.i]], { color: lineColor(ref.id), weight: 2, dashArray: '4 6' }).addTo(g);
    L.marker(o.poi.pos, { icon: L.divIcon({ className: 'poi-pin-wrap', iconSize: [22, 22], iconAnchor: [11, 24], html: '<div class="poi-pin"></div>' }) })
      .bindPopup(`<b>${o.poi.name}</b><br>${o.poi.addr}<br><small>Parada mais próxima (linha ${ref.id}): ${fmtDist(ns.d)}</small>`)
      .addTo(g).openPopup();
    bounds.extend(o.poi.pos);
  }
  if (o.user && distM(o.user, VALINHOS_CENTER) < 15000) {
    L.circleMarker(o.user, { radius: 7, color: '#fff', weight: 3, fillColor: '#37a8ff', fillOpacity: 1 })
      .bindPopup('Você está aqui (localização real do aparelho)').addTo(g);
    bounds.extend(o.user);
  }
  m.busLayer = L.layerGroup().addTo(g);
  startTick(m);
  m.map.fitBounds(bounds, fitPad(m));
}

// laço de animação: posições a cada quadro; interface (painel, bolhas, relógio) a cada ~450 ms
function startTick(m) {
  let lastUi = 0;
  const tick = () => {
    if (m.map.getContainer().offsetParent) {
      const now = simNow(), real = Date.now();
      let tid = null, tb = null;
      if (m.focus) {
        const trips = m.trips = activeTrips(m.focus, now), keys = new Set(trips.map(t => t.tid));
        Object.keys(m.buses).forEach(k => { if (!keys.has(k)) { m.busLayer.removeLayer(m.buses[k].mk); delete m.buses[k]; } });
        trips.forEach(t => {
          let b = m.buses[t.tid];
          if (!b) b = m.buses[t.tid] = { mk: L.marker(routeForLine(m.focus)[0], { icon: busIcon(m.focus), zIndexOffset: 1000 })
            .on('click', () => m.big ? trackBus(t.tid) : viewRoute(m.focus.id)).addTo(m.busLayer) };
          b.t = t; b.s = tripState(m.focus, t.eff); b.mk.setLatLng(b.s.pos);
        });
        if (m.big) { ensureTracked(m.focus, trips); tid = trackedBus.tid; } else tid = trips.length ? trips[0].tid : null;
        tb = tid && m.buses[tid];
        if (m.big && followBus && tb) m.map.panTo(tb.s.pos, { animate: false });
      }
      if (real - lastUi > 450) { lastUi = real; uiTick(m, now, tid, tb); }
    }
    m.raf = requestAnimationFrame(tick);
  };
  m.raf = requestAnimationFrame(tick);
}
function uiTick(m, now, tid, tb) {
  if (m.focus) {
    if (tb) updateRouteSplit(m, m.focus, tb.s); else { m.rem.setLatLngs(routeForLine(m.focus)); m.done.setLatLngs([]); }
    Object.keys(m.buses).forEach(k => {
      const b = m.buses[k], el = b.mk.getElement(), bus = el && el.querySelector('.bus99');
      if (!bus) return;
      bus.classList.toggle('tracked', k === tid); bus.classList.toggle('broken', b.t.broken);
      el.querySelector('.bb').textContent = b.t.broken ? 'Quebrado' : b.s.phase === 'pre' ? `Saída ${b.t.dep}`
        : b.s.stopped ? `${m.focus.id} · parado` : `${m.focus.id} · ${etaText(b.s.nextMs)}`;
    });
  }
  if (m.big) { updateClock(); updateTrip(now); if (!m.focus) refreshIdleList(); } else updateHomeTag(m);
}

function pickHomeLine() {
  const now = simNow();
  return ['500'].concat(LINES.map(l => l.id)).find(id => activeTrips(lineById(id), now).length) || '500';
}
function updateHomeTag(m) {
  const el = $id('home-map-tag');
  if (el && m.focus) { const n = (m.trips || []).length; el.textContent = `Linha ${m.focus.id} · ${n ? n + (n > 1 ? ' ônibus' : ' ônibus') + ' em circulação' : 'sem ônibus agora'}`; }
}
function renderHomeMap() {
  if (!homeM) homeM = initMap('home-map-holder', false);
  homeM.map.invalidateSize();
  drawMap(homeM, pickHomeLine(), { mini: true });
}
function renderBigMap() {
  const sel = $id('map-line-select');
  const id = (sel && sel.value) || '';
  if (!bigM) bigM = initMap('map-holder', true);
  bigM.map.invalidateSize();
  drawMap(bigM, id, { poi: mapFocusPoi, user: userPos });
  buildSheet(id);
}
function selectMapLine(id) { $id('map-line-select').value = id; renderBigMap(); }
function clearMapPoi() { mapFocusPoi = null; renderBigMap(); }
function fitRoute() {
  if (!bigM) return;
  followBus = false; $id('fab-follow').classList.remove('on');
  bigM.map.fitBounds(L.latLngBounds(bigM.focus ? routeForLine(bigM.focus) : [].concat(...LINES.map(routeForLine))), fitPad(bigM));
}
function toggleFollow() {
  if (!bigM || !bigM.focus) return;
  followBus = !followBus; $id('fab-follow').classList.toggle('on', followBus);
  if (followBus) bigM.map.setZoom(Math.max(bigM.map.getZoom(), 16), { animate: false });
}
function trackBus(tid) { trackedBus = { id: bigM.focus.id, tid }; bigM.sig = null; updateTrip(simNow()); }
function toggleIncident() { // DEMONSTRAÇÃO: simula pane no ônibus acompanhado (ou resolve)
  if (!bigM || !bigM.focus || !trackedBus) return;
  const t = (bigM.trips || []).find(x => x.tid === trackedBus.tid);
  if (!t) return;
  const f = _flags[t.tid] = _flags[t.tid] || {}, now = simNow();
  if (!f.broken) { f.broken = true; f.at = t.eff; f.since = now; }
  else { f.broken = false; f.delay = (f.delay || 0) + (now - f.since); }
  bigM.sig = null; updateTrip(now);
}
function updateClock() {
  const t = simNow(), el = $id('sc-time');
  if (!el) return;
  el.textContent = fmtClock(t);
  const real = simSpeed === 1 && Math.abs(t - Date.now()) < 2500;
  $id('sc-label').textContent = real ? 'Tempo real' : 'Horário simulado';
  $id('sc-reset').hidden = real;
  document.querySelectorAll('#sim-clock .seg button').forEach(b => b.classList.toggle('active', +b.dataset.s === simSpeed));
}

/* ---------- painel flutuante (bottom sheet) ---------- */
const SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>';
function fillSheetList(filter) {
  const n = norm(filter), box = $id('sheet-list'), now = simNow();
  if (!box) return;
  const list = LINES.filter(l => !n || l.id.includes(n) || norm(l.name + ' ' + l.itin).includes(n));
  box.innerHTML = list.map(l => {
    const live = activeTrips(l, now).length, nd = nextDeparture(l, now);
    const tag = live ? `<em class="live"><i></i>${live} agora</em>` : `<em>${nd ? 'Próx. ' + nd.dep : 'Sem saídas'}</em>`;
    return `<button class="line-row" onclick="selectMapLine('${l.id}')">
      <span class="badge-line" style="--c:${lineColor(l.id)}">${l.id}</span>
      <span class="lr-main"><b>${l.name}</b><small>${l.itin}</small></span>${tag}</button>`;
  }).join('') || '<div class="dest-note" style="padding:12px;">Nenhuma linha encontrada.</div>';
}
let _lastIdle = 0;
function refreshIdleList() {
  if (Date.now() - _lastIdle < 8000) return;
  _lastIdle = Date.now();
  const inp = $id('sheet-filter'); fillSheetList(inp ? inp.value : '');
}
const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
function buildSheet(id) {
  const el = $id('trip-panel');
  if (!id) {
    _lastIdle = Date.now();
    el.innerHTML = `<div class="sh-title"><b>Escolha uma linha</b><p>Veja onde o ônibus está agora, em tempo real, e o trajeto dele no mapa.</p></div>
      <label class="sh-search">${SEARCH_SVG}<input id="sheet-filter" placeholder="Buscar linha, bairro ou destino" oninput="fillSheetList(this.value)" autocomplete="off"></label>
      <div id="sheet-list" class="sheet-list"></div>`;
    fillSheetList(''); clearAlt(bigM); return;
  }
  const l = lineById(id), c = lineColor(id), e = lineEnds(l), now = simNow();
  const trips = activeTrips(l, now); ensureTracked(l, trips); bigM.sig = sigFor(l, trips);
  const tr = trips.find(t => t.tid === trackedBus.tid);
  const poi = mapFocusPoi ? `<div class="trip-dest"><span>Destino: <b>${mapFocusPoi.name}</b> · parada a ${fmtDist(nearestStop(l, mapFocusPoi.pos).d)}</span><button class="btn btn-sm" onclick="clearMapPoi()">Limpar</button></div>` : '';
  const seg = trips.length ? `<div class="trip-seg">${trips.map(t => `<button class="${t.tid === trackedBus.tid ? 'active' : ''}${t.broken ? ' bad' : ''}" onclick="trackBus('${t.tid}')">Saída ${t.dep}</button>`).join('')}</div>` : '';
  const head = `<div class="sh-top"><button class="sh-back" onclick="selectMapLine('')">${BACK_SVG}Trocar linha</button>${seg}</div>${poi}
    <div class="trip-head" style="--c:${c}"><div class="badge-line">${l.id}</div>
      <div><b>${l.name}</b><div class="itin">${isCircular(l) ? 'Percurso circular' : e.from + ' ↔ ' + e.to}${l.official ? '' : ' · itinerário a validar'}</div></div></div>`;
  if (!tr) { // nenhum ônibus em circulação
    clearAlt(bigM);
    const todays = l.s[dayKeyOf(new Date(now))] || [], nds = allDeps(l, now).filter(x => x.depTs > now).sort((a, b) => a.depTs - b.depTs).slice(0, 5);
    el.innerHTML = head + `<div class="trip-empty"><b>Nenhum ônibus em circulação agora</b>
      <p>${todays.length ? 'Os ônibus desta linha saem do Terminal nos horários da tabela.' : 'Esta linha não opera neste dia.'}</p>
      ${nds.length ? `<div class="trip-sub">Próximas saídas do Terminal</div><div class="dep-list">${nds.map(x => `<span>${x.dep}</span>`).join('')}</div>
      <button class="btn btn-gold btn-block" style="margin-top:12px;" onclick="jumpSim(${nds[0].depTs + 8 * 60000})">Ver o ônibus das ${nds[0].dep} (simular horário)</button>` : ''}</div>`;
    return;
  }
  const s = tripState(l, tr.eff);
  let alt = '';
  if (tr.broken) {
    bigM.alt = computeAlternatives(l, s, tr.tid, now); drawAlt(bigM, bigM.alt);
    const A = bigM.alt, o = A.other;
    alt = `<div class="alt-box"><div class="trip-sub bad">Alternativas</div>
      <div class="alt-card"><b>Aguardar o próximo ônibus da linha ${l.id}</b>
        <span>O próximo ônibus chega a este ponto (${stopLabel(l, A.same.stopIdx)}) em <em id="alt-eta-0"></em></span></div>
      ${o ? `<div class="alt-card hl" style="--c:${lineColor(o.l.id)}"><b>Linha ${o.l.id} — ${o.l.name}</b>
        <span>Embarque na Parada ${o.a.i} (a ${fmtDist(o.a.d)} a pé). Próximo ônibus em <em id="alt-eta-1"></em>. Viagem de ~${etaText(o.rideMs)} até perto de ${A.dest} (a ${fmtDist(o.b.d)}).</span></div>`
        : '<div class="alt-card"><span>Nenhuma outra linha passa perto deste ponto nos dados do MVP.</span></div>'}</div>`;
  } else { clearAlt(bigM); bigM.alt = null; }
  el.innerHTML = head + `
    ${tr.broken ? `<div class="broken-box"><b>Ônibus quebrado</b><span>Parado em ${stopLabel(l, Math.round(s.f))} desde as ${hhmmOf(tr.since)} (simulado). Veja as alternativas abaixo.</span></div>` : ''}
    <div class="eta-big"><span id="tp-eta">--</span><small id="tp-eta-sub"></small></div>
    <div class="trip-progress"><div class="bar"><i id="tp-bar" style="background:${c}"></i></div><span id="tp-bar-txt"></span></div>
    <div class="trip-row"><span>Situação</span><b id="tp-state"></b></div>
    <div class="trip-row"><span>Velocidade</span><b id="tp-speed"></b></div>
    <div class="trip-row"><span>Próxima parada</span><b id="tp-next"></b></div>
    <div class="trip-row"><span>Próximo ponto de referência</span><b id="tp-ref"></b></div>
    ${alt}
    <div class="trip-sub">Estabelecimentos próximos</div><div id="tp-near"></div>
    <div class="trip-sub">Roteiro (ordem da viagem)</div><ol class="route-list" id="tp-route"></ol>
    <button class="btn btn-block demo-btn ${tr.broken ? 'ok' : ''}" onclick="toggleIncident()">${tr.broken ? 'Resolver ocorrência (demonstração)' : 'Simular ônibus quebrado (demonstração)'}</button>`;
}
function updateTrip(now) {
  const m = bigM;
  if (!m || !m.focus) { const n = $id('incident-note'); if (n) n.hidden = true; return; }
  const l = m.focus, trips = m.trips || [];
  const bad = trips.find(t => t.broken), note = $id('incident-note');
  if (note) { note.hidden = !bad; if (bad) note.textContent = `Atenção: ônibus da linha ${l.id} (saída ${bad.dep}) quebrado. Veja a alternativa no painel.`; }
  if (m.sig !== sigFor(l, trips)) buildSheet(l.id);
  const tr = trackedBus && trips.find(t => t.tid === trackedBus.tid);
  if (!tr || !$id('tp-eta')) return;
  const s = tripState(l, tr.eff), d = tripDirection(l, s), nr = nextRef(l, s), pct = Math.round(s.progress * 100);
  const set = (i, h) => { const x = $id(i); if (x && x.innerHTML !== h) x.innerHTML = h; };
  set('tp-eta', tr.broken ? 'Ônibus parado' : s.phase === 'pre' ? 'Sai em ' + etaText(s.nextMs - planFor(l).ev[0].ms) : 'Chega em ' + etaText(s.remMs));
  set('tp-eta-sub', `${d.from} → ${d.dest}`);
  $id('tp-bar').style.width = pct + '%';
  set('tp-bar-txt', `${pct}% do trajeto · ${fmtDist(s.km * 1000)} de ${fmtDist(s.totalKm * 1000)}`);
  set('tp-state', tr.broken ? 'Quebrado' : s.phase === 'pre' ? 'Aguardando a saída do Terminal' : s.stopped ? 'Parado em ' + stopLabel(l, s.stop) : 'Em deslocamento');
  set('tp-speed', tr.broken || s.stopped ? '0 km/h' : s.speed + ' km/h');
  set('tp-next', s.next == null ? '—' : `${stopLabel(l, s.next)} <em>${tr.broken ? '—' : etaText(s.nextMs)}</em>`);
  set('tp-ref', nr ? `${nr.ref.name} <em>${tr.broken ? '—' : etaText(nr.ms)}</em>` : 'Destino');
  const nb = nearbyPois(s.pos);
  set('tp-near', nb.length ? nb.map(x => `<div class="trip-poi">${svgIcon(x.p.cat)}<span>${x.p.name}</span><em>${fmtDist(x.d)}</em></div>`).join('') : '<div class="dest-note">Nenhum cadastrado neste trecho.</div>');
  const refs = lineRefs(l), ordered = s.dir > 0 ? refs : [...refs].reverse(), ol = $id('tp-route');
  if (ol.dataset.dir !== l.id + s.dir) {
    ol.dataset.dir = l.id + s.dir;
    ol.innerHTML = ordered.map(r => `<li>${r.kind === 'poi' ? svgIcon(r.poi.cat) : '<i class="dot"></i>'}<span>${r.name}</span></li>`).join('');
  }
  [...ol.children].forEach((li, i) => {
    const r = ordered[i];
    li.className = (nr && r === nr.ref) ? 'next' : ((s.dir > 0 ? r.idx <= s.f : r.idx >= s.f) ? 'done' : '');
  });
  if (tr.broken && m.alt) {
    const a0 = $id('alt-eta-0'), a1 = $id('alt-eta-1'), tx = at => at == null ? 'sem previsão hoje' : etaText(at - now);
    if (a0) a0.textContent = tx(m.alt.same.at);
    if (a1 && m.alt.other) a1.textContent = tx(m.alt.other.at);
  }
}
