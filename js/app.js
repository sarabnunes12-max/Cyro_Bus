/* =====================================================================
   CYRO BUS — lógica do aplicativo
   Depende de LINES e DAY_LABELS definidos em js/data.js (carregado antes)
   ===================================================================== */

/* ======================= ESTADO ======================= */
let currentUser = null;
let favorites = new Set(["500", "510", "504"]);
let isGuest = false;

/* =======================================================================
   AUTENTICAÇÃO
   As chamadas REAIS ao Firebase (createUserWithEmailAndPassword,
   signInWithEmailAndPassword, signOut, onAuthStateChanged) ficam em
   js/auth.js (módulo ES separado, importa o SDK do Firebase).
   Aqui em app.js ficam só funções de UI/estado, chamadas pelo auth.js
   depois que o Firebase confirma a operação.
   ======================================================================= */
function switchAuthTab(t) {
  document.getElementById('tab-login').classList.toggle('active', t === 'login');
  document.getElementById('tab-signup').classList.toggle('active', t === 'signup');
  document.getElementById('form-login').style.display = t === 'login' ? 'block' : 'none';
  document.getElementById('form-signup').style.display = t === 'signup' ? 'block' : 'none';
}
function showErr(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.classList.add('show'); }
function clearErr(id) { document.getElementById(id).classList.remove('show'); }
function showOk(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.classList.add('show'); }
function hideOk(id) { document.getElementById(id).classList.remove('show'); }
function setAuthLoading(formId, loading) {
  const form = document.getElementById(formId);
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = loading;
  btn.textContent = loading ? 'Entrando...' : (formId === 'form-login' ? 'Entrar' : 'Criar conta');
}

// Chamada pelo auth.js quando o Firebase confirma login/cadastro (ou guest local)
function enterAppUI(name, email, guest) {
  currentUser = { name, email };
  isGuest = !!guest;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('ready');
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('user-name-chip').textContent = name.split(' ')[0];
  document.getElementById('greet-name').textContent = name.split(' ')[0];
  document.getElementById('profile-name').value = name;
  document.getElementById('profile-email').value = guest ? 'Sem conta (visitante)' : email;
  document.querySelectorAll('[data-account-only]').forEach(el => { el.style.display = isGuest ? 'none' : ''; });
  document.getElementById('guest-note').style.display = isGuest ? '' : 'none';
  initApp();
}
// Chamada pelo auth.js depois do signOut do Firebase
function resetSensitiveFields() {
  ['pw-current', 'pw-new', 'pw-confirm', 'del-pass'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
  ['pw-error', 'pw-ok', 'del-error', 'profile-error', 'profile-msg'].forEach(i => { const e = document.getElementById(i); if (e) e.classList.remove('show'); });
}
function exitAppUI() {
  resetSensitiveFields();
  currentUser = null;
  isGuest = false;
  favorites = new Set();
  document.getElementById('app').classList.remove('ready');
  document.getElementById('auth-screen').style.display = 'flex';
}
function getFavoritesArray() { return [...favorites]; }
function setFavoritesArray(arr) {
  favorites = new Set(arr || []);
  renderHomeFavorites(); renderFavoritesView(); renderLinesIndex();
  const c = document.getElementById('profile-fav-count');
  if (c) c.textContent = favorites.size + ' rotas salvas';
}
async function saveProfile() {
  clearErr('profile-error'); hideOk('profile-msg');
  const name = document.getElementById('profile-name').value.trim();
  if (name.length < 2) { showErr('profile-error', 'Digite seu nome (mínimo 2 letras).'); return; }
  try {
    if (window.onProfileSaved) await window.onProfileSaved(name); // auth.js grava no Firestore/Auth
    currentUser.name = name;
    document.getElementById('user-name-chip').textContent = name.split(' ')[0];
    document.getElementById('greet-name').textContent = name.split(' ')[0];
    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
    showOk('profile-msg', isGuest ? 'Nome alterado apenas nesta sessão (visitante).' : 'Nome atualizado com sucesso.');
  } catch (err) {
    showErr('profile-error', window.mapAuthError ? window.mapAuthError(err) : 'Não foi possível salvar. Tente novamente.');
  }
}

// LGPD — portabilidade: baixa um arquivo com os dados da conta
function exportMyData() {
  if (isGuest || !currentUser) return;
  const root = document.documentElement;
  const data = {
    aplicativo: 'Cyro Bus', exportadoEm: new Date().toISOString(),
    conta: { nome: currentUser.name, email: currentUser.email },
    favoritos: getFavoritesArray(),
    preferenciasDoAparelho: { tema: root.getAttribute('data-theme'), tamanhoDoTexto: root.getAttribute('data-text') || 'normal', altoContraste: root.getAttribute('data-contrast') === 'high' }
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = 'meus-dados-cyro-bus.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast('Arquivo com seus dados baixado.');
}

/* ======================= NAVEGAÇÃO ======================= */
function goTo(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  document.getElementById('sidebar').classList.remove('open');
  if (view === 'home' && homeM) setTimeout(() => homeM.map.invalidateSize(), 50);
  if (view === 'mapa') renderBigMap();
  if (view === 'ia') checkIaStatus();
  if (view === 'linhas') renderLinesIndex();
  if (view === 'horarios') renderSchedules();
  if (view === 'favoritos') renderFavoritesView();
}
/* ======================= HELPERS ======================= */
function nextTime(times) {
  if (!times || !times.length) return null;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  for (const t of times) {
    const [h, m] = t.split(':').map(Number);
    if (h * 60 + m >= cur) return t;
  }
  return times[0];
}
// chave do dia atual em LINES[].s: weekday | saturday | sunday
function dayKey() { const d = new Date().getDay(); return d === 0 ? 'sunday' : d === 6 ? 'saturday' : 'weekday'; }
function starSVG(on) {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l2.6 5.6 6.1.6-4.5 4.1 1.3 6-5.5-3.2-5.5 3.2 1.3-6-4.5-4.1 6.1-.6z"/></svg>`;
}
function renderAlerts() {
  document.getElementById('alerts-list').innerHTML = ALERTS.map(a =>
    `<div class="alert-row"><div class="alert-dot ${a.type}"></div><div><b>${a.title}</b>${a.text}</div></div>`).join('');
}
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}
// "Localização": posição REAL do aparelho (não é simulada), mostrada no mapa
function locateUser() {
  if (!navigator.geolocation) { showToast('Seu navegador não permite acessar a localização.'); return; }
  showToast('Buscando sua localização…');
  navigator.geolocation.getCurrentPosition(p => {
    userPos = [p.coords.latitude, p.coords.longitude];
    const km = distM(userPos, VALINHOS_CENTER) / 1000;
    mapFocusPoi = null;
    goTo('mapa');
    showToast(km > 15 ? `Você está a cerca de ${Math.round(km)} km de Valinhos, fora da área das linhas.` : 'Localização encontrada.');
  }, () => showToast('Não foi possível obter sua localização. Verifique a permissão do navegador.'),
  { enableHighAccuracy: true, timeout: 10000 });
}

function badgeHTML(id) { return `<div class="badge-line">${id}</div>`; }

/* ======================= HOME ======================= */
function initApp() {
  document.getElementById('today-str').textContent =
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const q = document.getElementById('quick-line-select');
  q.innerHTML = LINES.map(l => `<option value="${l.id}">${l.id} — ${l.name}</option>`).join('');

  document.getElementById('quick-day-tabs').innerHTML = Object.keys(DAY_LABELS)
    .map(k => `<div class="day-tab ${k === quickDay ? 'active' : ''}" data-day="${k}" onclick="selectQuickDay('${k}',this)">${DAY_LABELS[k]}</div>`)
    .join('');

  renderQuickSchedule();
  renderHomeFavorites();
  renderAlerts();
  renderDestChips();
  renderHomeMap();

  document.getElementById('map-line-select').innerHTML = '<option value="">Escolha uma linha</option>' +
    LINES.map(l => `<option value="${l.id}">${l.id} — ${l.name}</option>`).join('');

  updateNextBus();
}

let quickDay = dayKey();
function selectQuickDay(day, el) {
  quickDay = day;
  document.querySelectorAll('#quick-day-tabs .day-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderQuickSchedule();
}
function renderQuickSchedule() {
  const id = document.getElementById('quick-line-select').value;
  const line = lineById(id);
  const times = line.s[quickDay] || [];
  const nt = nextTime(times);
  document.getElementById('quick-time-grid').innerHTML = times.length
    ? times.slice(0, 8).map(t => `<div class="time-chip ${t === nt ? 'next' : ''}">${t}</div>`).join('')
    : '<div style="grid-column:1/5;color:var(--ink-dim);font-size:calc(12.5px * var(--fs));">Sem operação neste dia.</div>';
}
function renderHomeFavorites() {
  const el = document.getElementById('home-fav-card');
  const favs = [...favorites].map(lineById).filter(Boolean);
  el.innerHTML = favs.length ? favs.map(l => `
    <div class="fav-row">
      ${badgeHTML(l.id)}
      <div class="fr-info"><b>${l.name}</b><div>${l.itin}</div></div>
      <button class="star-btn on" aria-label="Remover dos favoritos" onclick="toggleFav('${l.id}')">${starSVG(true)}</button>
    </div>`).join('') : '<div style="color:var(--ink-dim);font-size:calc(12.5px * var(--fs));">Você ainda não favoritou nenhuma rota.</div>';
}
function toggleFav(id) {
  if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
  renderHomeFavorites();
  renderFavoritesView();
  renderLinesIndex();
  const c = document.getElementById('profile-fav-count');
  if (c) c.textContent = favorites.size + ' rotas salvas';
  if (window.onFavoritesChanged) window.onFavoritesChanged(getFavoritesArray()); // auth.js grava no Firestore
}
function goToSchedule(id) { goTo('horarios'); selectSchedLine(id); }
function updateNextBus() {
  const l = lineById('500');
  const nt = nextTime(l.s[dayKey()]);
  document.getElementById('nb-badge').textContent = l.id;
  document.getElementById('nb-name').textContent = 'Terminal → ' + l.name.split('(')[0].trim();
  document.getElementById('nb-dest').textContent = l.itin.split(',').slice(-1)[0].trim();
  document.getElementById('nb-eta').textContent = nt || '—';
}

/* O mapa real (Leaflet + OpenStreetMap) vive em js/map.js, separado —
   ele define renderHomeMap() e renderBigMap() usadas acima. */

/* ======================= LINHAS ======================= */
function renderLinesIndex() {
  const q = (document.getElementById('lines-search').value || '').toLowerCase();
  const list = LINES.filter(l => l.id.includes(q) || l.name.toLowerCase().includes(q) || l.itin.toLowerCase().includes(q));
  document.getElementById('lines-index').innerHTML = list.map(l => `
    <div class="line-card">
      <div class="line-card-head">
        <div class="badge-line">${l.id}</div>
        <div><b>${l.name}</b><div class="itin">${l.itin}</div></div>
      </div>
      <div style="font-size:calc(12px * var(--fs)); color:var(--ink-dim);">Próximo: <b style="color:var(--gold)">${nextTime(l.s.weekday) || '—'}</b> (seg-sex)</div>
      <div class="line-card-actions">
        <button class="btn btn-sm" style="flex:1;" onclick="goToSchedule('${l.id}')">Ver horários</button>
        <button class="btn btn-sm" aria-label="Favoritar" onclick="toggleFav('${l.id}')">${starSVG(favorites.has(l.id))}</button>
      </div>
    </div>`).join('');
}

/* ======================= HORARIOS ======================= */
let schedSelected = '500';
let schedDay = 'weekday';
function renderSchedules() {
  document.getElementById('sched-line-list').innerHTML = LINES.map(l => `
    <div class="sched-line-item ${l.id === schedSelected ? 'active' : ''}" onclick="selectSchedLine('${l.id}')">
      ${badgeHTML(l.id)}<div><div style="font-size:calc(12.5px * var(--fs));font-weight:600;">${l.id}</div><div style="font-size:calc(11px * var(--fs));color:var(--ink-dim);">${l.name}</div></div>
    </div>`).join('');
  renderSchedDetail();
}
function selectSchedLine(id) { schedSelected = id; renderSchedules(); }
function selectSchedDay(day) { schedDay = day; renderSchedDetail(); }
function renderSchedDetail() {
  const l = lineById(schedSelected);
  const tabs = Object.keys(DAY_LABELS).map(k => `<div class="day-tab ${k === schedDay ? 'active' : ''}" onclick="selectSchedDay('${k}')">${DAY_LABELS[k]}</div>`).join('');
  const times = l.s[schedDay] || [];
  const nt = nextTime(times);
  document.getElementById('sched-detail').innerHTML = `
    <div class="line-card-head" style="margin-bottom:14px;">
      <div class="badge-line" style="width:54px;height:54px;font-size:calc(16px * var(--fs));">${l.id}</div>
      <div><b style="font-size:calc(16px * var(--fs));">${l.name}</b><div class="itin">${l.itin}</div></div>
      <button class="btn btn-sm" style="margin-left:auto;" onclick="toggleFav('${l.id}')">${starSVG(favorites.has(l.id))} ${favorites.has(l.id) ? 'Favoritada' : 'Favoritar'}</button>
    </div>
    <div class="day-tabs">${tabs}</div>
    <div class="dest-note" style="margin-bottom:10px;">Horários demonstrativos do MVP${l.official ? '' : ' · itinerário a validar'}. Confirme os horários oficiais com a Prefeitura / SOU Valinhos.</div>
    <div class="sched-table">${times.length
      ? times.map(t => `<div class="time-chip ${t === nt ? 'next' : ''}">${t}</div>`).join('')
      : '<div style="grid-column:1/7;color:var(--ink-dim);font-size:calc(12.5px * var(--fs));">Sem operação regular neste dia — consulte a linha 509 ou 501.</div>'}</div>
  `;
}

/* ======================= FAVORITOS ======================= */
function renderFavoritesView() {
  const favs = [...favorites].map(lineById).filter(Boolean);
  document.getElementById('fav-grid').innerHTML = favs.length ? favs.map(l => `
    <div class="line-card">
      <div class="line-card-head"><div class="badge-line">${l.id}</div><div><b>${l.name}</b><div class="itin">${l.itin}</div></div></div>
      <div style="font-size:calc(12px * var(--fs)); color:var(--ink-dim);">Próximo: <b style="color:var(--gold)">${nextTime(l.s.weekday) || '—'}</b></div>
      <div class="line-card-actions">
        <button class="btn btn-sm" style="flex:1;" onclick="goToSchedule('${l.id}')">Ver horários</button>
        <button class="btn btn-sm" onclick="toggleFav('${l.id}')">Remover</button>
      </div>
    </div>`).join('') : '<div style="color:var(--ink-dim);">Nenhuma rota favorita ainda. Vá até <b>Linhas</b> e toque na estrela de uma linha.</div>';
}

/* ======================= TEMA / ACESSIBILIDADE ======================= */
function setTheme(t, persist = true) {
  document.documentElement.setAttribute('data-theme', t);
  if (persist) { try { localStorage.setItem('cyro-theme', t); } catch (e) {} }
  document.querySelectorAll('[data-t]').forEach(b => {
    const on = b.dataset.t === t;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on);
  });
  if (typeof applyMapTheme === 'function') applyMapTheme(); // troca o mapa-base claro/escuro
}
/* Acessibilidade: todo font-size do CSS usa calc(Npx * var(--fs)); basta mudar --fs no <html> */
function setTextSize(level, persist = true) {
  const root = document.documentElement;
  if (level === 'large' || level === 'xl') root.setAttribute('data-text', level); else { level = 'normal'; root.removeAttribute('data-text'); }
  if (persist) { try { localStorage.setItem('cyro-text', level); } catch (e) {} }
  document.querySelectorAll('.seg-text button').forEach(b => { const on = b.dataset.text === level; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
  setTimeout(() => { [homeM, bigM].forEach(m => m && m.map.invalidateSize()); }, 120); // o mapa se reajusta ao novo layout
}
function setContrast(on, persist = true) {
  const root = document.documentElement;
  if (on) root.setAttribute('data-contrast', 'high'); else root.removeAttribute('data-contrast');
  if (persist) { try { localStorage.setItem('cyro-contrast', on ? 'high' : 'normal'); } catch (e) {} }
  const sw = document.getElementById('sw-contrast');
  if (sw) { sw.classList.toggle('on', on); sw.setAttribute('aria-checked', on); }
}
function toggleContrast() { setContrast(document.documentElement.getAttribute('data-contrast') !== 'high'); }
function clearLocalPrefs() {
  try { ['cyro-theme', 'cyro-text', 'cyro-contrast'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
  setTextSize('normal', false); setContrast(false, false); setTheme('dark', false);
  showToast('Preferências deste aparelho foram apagadas.');
}

/* O assistente de IA (online + reserva local) está em js/assistant.js */

// estado inicial dos botões de tema (o tema salvo já foi aplicado no <head>)
setTheme(document.documentElement.getAttribute('data-theme') || 'dark', false);

// estado inicial de acessibilidade e contadores (o <head> já aplicou o que estava salvo)
setTextSize(document.documentElement.getAttribute('data-text') || 'normal', false);
setContrast(document.documentElement.getAttribute('data-contrast') === 'high', false);
document.querySelectorAll('[data-lines-count]').forEach(e => { e.textContent = LINES.length; });
