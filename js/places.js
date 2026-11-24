/* =====================================================================
   CYRO BUS — pontos de interesse e busca de destinos
   Depende de LINES/lineById (data.js) e de routeForLine/nearestStop/
   fmtDist/offsetPos/lineColor (map.js).

   ORIGEM DOS DADOS (levantamento do projeto sobre Valinhos):
   • Nomes e endereços dos estabelecimentos vêm do levantamento
     (st:"ok"). Itens sem endereço confirmado: st:"validar"; itens
     genéricos de demonstração: st:"exemplo".
   • "lines" = linhas que, segundo o levantamento, atendem o local
     (ex.: Rua Paiquerê → linha 506; Santa Casa/Galileo → linha 527).
     Sem "lines", a relação é ESTIMADA pela proximidade das paradas.
   • As POSIÇÕES no mapa são APROXIMADAS e ancoradas nos trajetos
     fictícios de map.js. Para dados reais: geocodificar os endereços
     e usar o itinerário (ruas) oficial de cada linha.
   ===================================================================== */

const WALK_MAX = 400; // "linha próxima" = parada a até 400 m do local (~5 min a pé)

const POI_CATS = {
  mercado:  { label: 'Mercados',        kw: ['mercado', 'mercearia', 'atacarejo', 'compras'] },
  farmacia: { label: 'Farmácias',       kw: ['farmacia', 'drogaria', 'drogal', 'maxfarma', 'remedio'] },
  hospital: { label: 'Hospitais',       kw: ['hospital', 'hospitais', 'saude', 'pronto socorro', 'upa', 'ubs', 'clinica', 'santa casa'] },
  shopping: { label: 'Shoppings',       kw: ['shopping', 'galeria', 'centro comercial', 'mall'] },
  escola:   { label: 'Escolas',         kw: ['escola', 'colegio', 'faculdade', 'universidade', 'creche'] },
  banco:    { label: 'Bancos',          kw: ['banco', 'bancos', 'loterica', 'agencia bancaria'] },
  terminal: { label: 'Terminais',       kw: ['terminal', 'terminais', 'rodoviaria', 'ponto de onibus'] },
  publico:  { label: 'Órgãos públicos', kw: ['prefeitura', 'orgao publico', 'orgaos publicos', 'publico'] },
  parque:   { label: 'Parques',         kw: ['parque', 'praca', 'lazer'] },
  outros:   { label: 'Outros',          kw: ['outros', 'igreja', 'referencia'] }
};
const POI_ICONS = {
  mercado:  '<path d="M5 8h14l-1.2 9H6.2z"/><path d="M9 8a3 3 0 016 0"/>',
  farmacia: '<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
  hospital: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  shopping: '<path d="M4 9l2-4h12l2 4v10H4z"/><path d="M9 19v-5h6v5"/>',
  escola:   '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5v-4.5"/>',
  banco:    '<path d="M3 10l9-6 9 6zM5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
  terminal: '<rect x="4" y="4" width="16" height="14" rx="3"/><path d="M4 11h16"/><circle cx="8" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>',
  publico:  '<path d="M4 20h16M6 20V9m12 11V9M3 9l9-5 9 5M10 20v-5h4v5"/>',
  parque:   '<circle cx="12" cy="9" r="5"/><path d="M12 14v7"/>',
  outros:   '<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'
};
const svgIcon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${POI_ICONS[k]}</svg>`;

// at = [linha, nº da parada (negativo = contado do fim; -1 = final da linha), desloc. norte km, desloc. leste km]; n/e = km ao norte/leste do Terminal.
// st: ok (endereço do levantamento) | validar (endereço a confirmar) | exemplo (item genérico de demonstração)
const POIS = [
  // supermercados e mercados
  { id: 'm1', cat: 'mercado',  st: 'ok', name: 'Supermercados Caetano',  addr: 'Av. Onze de Agosto, 623 – Centro',                n: .25, e: -.25 },
  { id: 'm2', cat: 'mercado',  st: 'ok', name: 'Dalben Supermercados',   addr: 'Av. Invernada, 2619 – Parque Nova Suíça',        at: ['503', 3, .08, .06] },
  { id: 'm3', cat: 'mercado',  st: 'ok', name: 'Pague Menos',            addr: 'Av. Independência, 2822 – Jd. Santo Antônio',    at: ['501', 4, .1, .05] },
  { id: 'm4', cat: 'mercado',  st: 'ok', name: 'Flex Atacarejo',         addr: 'Av. Rosa Belmiro Ramos, 92 – Ortizes',           at: ['504', 4, .1, .1] },
  { id: 'm5', cat: 'mercado',  st: 'ok', name: 'Covabra Supermercados',  addr: 'Av. Brasil, 930 – Jd. Santana',                  at: ['510', 3, .1, -.05] },
  // farmácias
  { id: 'f1', cat: 'farmacia', st: 'ok', name: 'Drogal – Centro',                addr: 'Rua Antônio Carlos, 246',                  n: .1, e: .15 },
  { id: 'f2', cat: 'farmacia', st: 'ok', name: 'Drogal – Vila Santana',          addr: 'Rua Doze de Outubro, 338',                 at: ['505', 3, .08, -.06] },
  { id: 'f3', cat: 'farmacia', st: 'ok', name: 'Maxfarma Centenário',            addr: 'Rua Valmir Antônio Capelari, 790',         at: ['512', 3, .06, .08] },
  { id: 'f4', cat: 'farmacia', st: 'ok', name: 'Maxfarma UPA',                   addr: 'Av. Gessy Lever, 642',                     at: ['513', 2, .08, .06] },
  { id: 'f5', cat: 'farmacia', st: 'ok', name: 'Drogal – Parque Nova Suíça',     addr: 'Av. Invernada, 2689',                      at: ['503', 3, -.05, .1] },
  { id: 'f6', cat: 'farmacia', st: 'ok', name: 'Carol Farma',                    addr: 'Av. Independência, 682',                   n: .35, e: .4 },
  // saúde
  { id: 'h1', cat: 'hospital', st: 'ok',     name: 'Santa Casa de Valinhos', addr: 'Av. Onze de Agosto, 2745',                    lines: ['527'], at: ['527', 5, .06, .05] },
  { id: 'h2', cat: 'hospital', st: 'validar', name: 'Hospital Galileo',       addr: 'Endereço a validar (consta no itinerário da linha 527)', lines: ['527'], at: ['527', -1, .05, -.05] },
  { id: 'h3', cat: 'hospital', st: 'validar', name: 'UPA de Valinhos',        addr: 'Região da Av. Gessy Lever (a validar)',       at: ['513', 2, -.1, .08] },
  // shoppings e centros comerciais
  { id: 's1', cat: 'shopping', st: 'ok',     name: 'Shopping Valinhos',      addr: 'Rua Paiquerê, 200 – Valinhos',                 lines: ['506'], at: ['506', 3, .05, .06] },
  { id: 's2', cat: 'shopping', st: 'validar', name: 'Itamaracá Mall',         addr: 'Endereço a validar',                           at: ['506', -1, -.05, .08] },
  { id: 's3', cat: 'shopping', st: 'validar', name: 'Caribe Center',          addr: 'Endereço a validar',                           n: -.5, e: .4 },
  { id: 's4', cat: 'shopping', st: 'validar', name: 'Estação Galeria',        addr: 'Endereço a validar',                           n: .05, e: -.1 },
  { id: 's5', cat: 'shopping', st: 'validar', name: 'Victória Mall',          addr: 'Endereço a validar',                           at: ['507', 4, .08, .06] },
  { id: 's6', cat: 'shopping', st: 'validar', name: 'Porto Seguro Mall & Office', addr: 'Endereço a validar',                       at: ['512', 4, -.06, .1] },
  // escolas, bancos, órgãos públicos, igrejas (itens de demonstração até o cadastro real)
  { id: 'e1', cat: 'escola',   st: 'exemplo', name: 'Escola Estadual (exemplo)',  addr: 'Centro',                                   n: .45, e: .2 },
  { id: 'e2', cat: 'escola',   st: 'exemplo', name: 'Escola Municipal (exemplo)', addr: 'Bairro São Bento',                          at: ['502', 3, .08, .06] },
  { id: 'e3', cat: 'escola',   st: 'exemplo', name: 'Faculdade (exemplo)',        addr: 'Jardim São Marcos',                         at: ['513', 4, .06, -.08] },
  { id: 'b1', cat: 'banco',    st: 'exemplo', name: 'Agência bancária (exemplo)', addr: 'Centro',                                   n: .15, e: -.2 },
  { id: 'b2', cat: 'banco',    st: 'exemplo', name: 'Casa lotérica (exemplo)',    addr: 'Centro',                                   n: .3,  e: .1 },
  { id: 'g1', cat: 'publico',  st: 'validar', name: 'Prefeitura de Valinhos',     addr: 'Centro (endereço a validar)',               n: .2,  e: .05 },
  // terminais, lazer e referências
  { id: 't1', cat: 'terminal', st: 'ok',     name: 'Terminal Rodoviário de Valinhos', addr: 'Centro',                              n: 0, e: 0 },
  { id: 'p1', cat: 'parque',   st: 'ok',     name: 'Parque da Cidade',       addr: 'Av. Dr. Altino Gouveia, 878',                  lines: ['500'], at: ['500', -1, .04, .05] },
  { id: 'p2', cat: 'parque',   st: 'exemplo', name: 'Praça Central (exemplo)', addr: 'Centro',                                     n: .1, e: .3 },
  { id: 'i1', cat: 'outros',   st: 'exemplo', name: 'Igreja Matriz (exemplo)', addr: 'Centro',                                     n: .1, e: .02 }
];
// "pos" é calculada a partir do trajeto da linha-âncora (ou do Terminal). POIS_GEO (opcional,
// js/pois-geo.js) pode trazer coordenadas reais geocodificadas {id: [lat, lng]}.
POIS.forEach(p => {
  if (typeof POIS_GEO !== 'undefined' && POIS_GEO[p.id]) { p.pos = POIS_GEO[p.id]; p.geo = true; }
  else if (p.at) {
    const rt = routeForLine(lineById(p.at[0])), st = rt[p.at[1] < 0 ? rt.length + p.at[1] : p.at[1]]; // índice negativo = a partir do fim (-1 = final da linha)
    p.pos = [st[0] + p.at[2] / 111, st[1] + p.at[3] / (111 * Math.cos(st[0] * Math.PI / 180))];
  } else p.pos = offsetPos(p.n, p.e);
});
const poiStatusTag = p => p.st === 'validar' ? '<span class="tag warn">a validar</span>' : p.st === 'exemplo' ? '<span class="tag">exemplo</span>' : '';

const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const GENERIC_WORDS = new Set(['supermercado', 'supermercados', 'mercado', 'hospital', 'shopping', 'farmacia', 'escola', 'centro',
  'parque', 'terminal', 'rodoviario', 'agencia', 'bancaria', 'exemplo', 'valinhos', 'municipal', 'estadual', 'faculdade', 'igreja', 'praca']);
// 1) cita um local pelo nome → só ele(s); 2) senão, por categoria/palavra-chave ou trecho do endereço
function findPois(q) {
  const n = norm(q);
  if (n.length < 3) return [];
  const nt = n.split(/[^a-z0-9]+/); // palavras inteiras (evita "farma" casar dentro de "farmacia")
  const byName = POIS.filter(p => {
    const nm = norm(p.name);
    return n.includes(nm) || nm.split(/[^a-z0-9]+/).some(w => w.length >= 5 && !GENERIC_WORDS.has(w) && nt.includes(w));
  });
  if (byName.length) return byName;
  const cats = Object.keys(POI_CATS).filter(k => POI_CATS[k].kw.some(w => n.includes(w) || w.startsWith(n)));
  return POIS.filter(p => cats.includes(p.cat) || norm(p.name + ' ' + p.addr).includes(n));
}
function findLines(q) {
  const n = norm(q);
  if (n.length < 2) return [];
  return LINES.filter(l => l.id.includes(n) || norm(l.name).includes(n) || norm(l.itin).includes(n));
}
// linhas com parada a até WALK_MAX do local (as oficiais do levantamento entram sempre, primeiro)
function nearLines(poi) {
  const all = LINES.map(l => ({ l, d: nearestStop(l, poi.pos).d, off: !!(poi.lines && poi.lines.includes(l.id)) }));
  const list = all.filter(x => x.off || x.d <= WALK_MAX).sort((a, b) => (b.off - a.off) || (a.d - b.d));
  if (list.length) return { list, far: false };
  return { list: all.sort((a, b) => a.d - b.d).slice(0, 1), far: true };
}

/* ---------- UI ---------- */
function renderDestChips() {
  document.getElementById('dest-chips').innerHTML = Object.keys(POI_CATS).map(k =>
    `<button class="chip" onclick="setSmartSearch('${POI_CATS[k].label}')">${svgIcon(k)}${POI_CATS[k].label}</button>`).join('');
}
function setSmartSearch(v) {
  const i = document.getElementById('dest-input');
  i.value = v; onSmartSearch(v); i.focus();
}
function clearSmartSearch() { setSmartSearch(''); }

function poiCardHTML(p) {
  const { list, far } = nearLines(p);
  const chips = list.slice(0, 5).map(x =>
    `<button class="lchip${x.off ? ' off' : ''}" style="--c:${lineColor(x.l.id)}" title="${x.l.name}${x.off ? ' — linha informada no levantamento' : ''}" onclick="viewRoute('${x.l.id}','${p.id}')"><i></i>${x.l.id}<small>${fmtDist(x.d)}</small></button>`).join('');
  const more = list.length > 5 ? `<span class="dest-note">+${list.length - 5}</span>` : '';
  return `<div class="poi-card">
    <div class="poi-ico">${svgIcon(p.cat)}</div>
    <div class="poi-main">
      <div class="poi-name">${p.name} ${poiStatusTag(p)}</div>
      <div class="poi-addr">${p.addr}</div>
      <div class="poi-lines">${far ? '<span class="dest-note">Nenhuma linha a menos de 400 m. Mais próxima:</span>' : ''}${chips}${more}</div>
    </div>
    <button class="btn btn-sm btn-gold" onclick="viewRoute('${list[0].l.id}','${p.id}')">Visualizar rota</button>
  </div>`;
}
function lineResultHTML(l) {
  return `<div class="poi-card">
    <div class="badge-line" style="width:38px;height:38px;font-size:calc(12px * var(--fs));border-radius:9px;color:${lineColor(l.id)}">${l.id}</div>
    <div class="poi-main"><div class="poi-name">${l.name}</div><div class="poi-addr" style="margin:0">${l.itin}</div></div>
    <button class="btn btn-sm" onclick="goToSchedule('${l.id}')">Horários</button>
    <button class="btn btn-sm" onclick="viewRoute('${l.id}')">Mapa</button>
  </div>`;
}

function onSmartSearch(v) {
  const box = document.getElementById('dest-results'), q = v.trim();
  document.getElementById('dest-clear').hidden = !q;
  if (!q) { box.innerHTML = ''; return; }
  const pois = findPois(q)
    .map(p => ({ p, d: nearLines(p).list[0].d }))
    .sort((a, b) => a.d - b.d).map(x => x.p);
  const lines = (!pois.length || /\d/.test(q)) ? findLines(q) : [];
  let html = pois.slice(0, 6).map(poiCardHTML).join('');
  if (pois.length > 6) html += `<div class="dest-note">Mostrando 6 de ${pois.length} locais. Refine a busca para ver outros.</div>`;
  if (lines.length) html += lines.slice(0, 6).map(lineResultHTML).join('') +
    (lines.length > 6 ? `<div class="dest-note">Mostrando 6 de ${lines.length} linhas.</div>` : '');
  if (!html) html = '<div class="dest-note">Nada encontrado. Tente "mercado", "hospital", "escola" ou o número da linha.</div>';
  else if (pois.length) html += '<div class="dest-note">Endereços conforme levantamento do projeto; posições e trajetos no mapa são aproximados (MVP).</div>';
  box.innerHTML = html;
}

// abre a tela Mapa com a linha escolhida e (opcional) o destino marcado
function viewRoute(lineId, poiId) {
  mapFocusPoi = poiId ? POIS.find(p => p.id === poiId) : null;
  document.getElementById('map-line-select').value = lineId;
  goTo('mapa');
}
