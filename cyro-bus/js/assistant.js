/* =====================================================================
   CYRO BUS — Assistente de suporte
   1) Tenta a IA online (backend → Groq). O contexto é ENXUTO: resumo de
      todas as linhas + tabela completa só das linhas citadas na pergunta
      (antes iam ~6 mil tokens por pergunta e estourava o limite da Groq).
   2) Se o servidor/IA estiver indisponível, responde com o assistente
      LOCAL (localAnswer), que usa os mesmos dados de linhas e locais.
   Depende de: data.js, map.js, places.js, app.js (dayKey, nextTime).
   ===================================================================== */

// Em localhost fora da porta 3001 (ex.: Live Server) chama o backend em :3001;
// servido pelo próprio backend (ou em produção no mesmo domínio) usa caminho relativo.
// Para outro endereço, defina window.CYRO_API_BASE antes de carregar este arquivo.
const API_BASE = window.CYRO_API_BASE !== undefined ? window.CYRO_API_BASE :
  (['localhost', '127.0.0.1', ''].includes(location.hostname) && location.port !== '3001' ? 'http://localhost:3001' : '');
const IA_ENDPOINT = API_BASE + '/api/assistant';

const IA_BASE = `Você é o assistente de suporte do Cyro Bus, app de ônibus urbano de Valinhos, SP.
Responda SEMPRE em português do Brasil, de forma curta, clara e amigável (no máximo 5 linhas), em texto simples, sem markdown.
Use SOMENTE os dados abaixo. Nunca invente horários, linhas ou itinerários. Se a informação não estiver nos dados, diga que não encontrou e sugira conferir a tela Linhas ou Horários.
Se faltar a tabela completa de uma linha, peça o número da linha para consultar o horário exato.
Os trajetos e a posição dos ônibus no mapa são uma SIMULAÇÃO demonstrativa do MVP, não GPS real (a SOU Valinhos não fornece rastreamento): se perguntarem onde um ônibus está, explique isso. Os horários também são demonstrativos; recomende confirmar os oficiais com a Prefeitura/SOU Valinhos. Linhas marcadas [itinerário a validar] ainda não foram conferidas.
Para "qual ônibus pego para ir a X", use os LOCAIS (se houver) e o itinerário das linhas.
Escreva horários no formato HH:MM. Considere o dia e a hora atuais informados abaixo.`;

const rangeOf = a => a.length ? `${a[0]}–${a[a.length - 1]} (${a.length} saídas)` : 'sem operação';
const lineSummary = l => `Linha ${l.id} (${l.name})${l.official ? '' : ' [itinerário a validar]'} — itinerário: ${l.itin}. Seg-sex ${rangeOf(l.s.weekday)}; sábado ${rangeOf(l.s.saturday)}; domingo/feriado ${rangeOf(l.s.sunday)}.`;
const lineFull = l => `Linha ${l.id} (${l.name}) — itinerário: ${l.itin}\n  Seg-sex: ${l.s.weekday.join(' ')}\n  Sábado: ${l.s.saturday.join(' ') || 'sem operação'}\n  Domingo/feriado: ${l.s.sunday.join(' ') || 'sem operação'}`;
const DAY_NAME = { weekday: 'dia útil (seg-sex)', saturday: 'sábado', sunday: 'domingo/feriado' };
const nowHHMM = () => new Date().toTimeString().slice(0, 5);

// linhas citadas por número, por bairro/trecho do itinerário ou por local próximo
function relevantLines(q) {
  const n = norm(q), ids = new Set((q.match(/\b5\d{2}\b/g) || []).filter(id => lineById(id)));
  LINES.forEach(l => {
    const keys = l.itin.split(',').slice(1).concat(l.name.split(/[\/()]/)).map(norm)
      .filter(k => k.length >= 4 && !/^via |circular/.test(k));
    if (keys.some(k => n.includes(k))) ids.add(l.id);
  });
  findPois(q).slice(0, 3).forEach(p => nearLines(p).list.slice(0, 3).forEach(x => ids.add(x.l.id)));
  return [...ids].slice(0, 6).map(lineById);
}
function poiLines(p) {
  const n = nearLines(p);
  return `${p.name} (${p.addr}${p.st === 'validar' && !/validar/.test(p.addr) ? ', endereço a validar' : p.st === 'exemplo' ? ', exemplo' : ''}): ` + n.list.slice(0, 4).map(x => `linha ${x.l.id} a ${fmtDist(x.d)}`).join(', ') +
    (n.far ? ' (nenhuma a menos de 400 m)' : '');
}
function iaSystem(q) {
  const rel = relevantLines(q), pois = findPois(q).slice(0, 4);
  return IA_BASE + `\n\nAGORA: ${DAY_NAME[dayKey()]}, ${nowHHMM()}.` +
    `\n\nRESUMO DE TODAS AS LINHAS:\n${LINES.map(lineSummary).join('\n')}` +
    (rel.length ? `\n\nTABELAS COMPLETAS (linhas relevantes à pergunta):\n${rel.map(lineFull).join('\n')}` : '') +
    (pois.length ? `\n\nLOCAIS (exemplos aproximados do MVP):\n${pois.map(poiLines).join('\n')}` : '');
}

/* ---------- assistente local (reserva) ---------- */
function localAnswer(q) {
  const n = norm(q);
  const day = /domingo|feriado/.test(n) ? 'sunday' : /sabado/.test(n) ? 'saturday' : /segunda|terca|quarta|quinta|sexta|dia util/.test(n) ? 'weekday' : dayKey();
  const dn = { weekday: 'de segunda a sexta', saturday: 'aos sábados', sunday: 'aos domingos e feriados' }[day];
  const ids = (q.match(/\b5\d{2}\b/g) || []).filter(id => lineById(id));

  if (ids.length) {
    const l = lineById(ids[0]), t = l.s[day];
    const cat = findPois(q);
    if (cat.length && !/horario|saida|primeir|ultim|proxim|funciona|opera/.test(n)) {
      const near = cat.map(p => ({ p, d: nearestStop(l, p.pos).d })).filter(x => x.d <= WALK_MAX * 1.5).sort((a, b) => a.d - b.d).slice(0, 4);
      return near.length ? `Perto da linha ${l.id} (${l.name}): ` + near.map(x => `${x.p.name} (${fmtDist(x.d)} da parada)`).join('; ') + '. Dados aproximados do MVP.'
                         : `Não encontrei esse tipo de local perto da linha ${l.id} nos dados atuais.`;
    }
    if (!t.length) return `A linha ${l.id} (${l.name}) não opera ${dn}.` + (l.id === '511' ? ' Use a 509 ou a 501 como alternativa.' : ' Veja outras opções na tela Linhas.');
    if (/primeir|cedo/.test(n)) return `O primeiro horário da linha ${l.id} ${dn} é às ${t[0]}.`;
    if (/ultim|tarde|noite/.test(n)) return `O último horário da linha ${l.id} ${dn} é às ${t[t.length - 1]}.`;
    if (/proxim|agora|que horas|quando|sai/.test(n)) {
      const nt = day === dayKey() ? nextTime(t) : t[0];
      return nt && nt >= nowHHMM() || day !== dayKey() ? `O próximo horário da linha ${l.id} é às ${nt}.` : `Hoje não há mais saídas da linha ${l.id}. A primeira do próximo dia de operação é às ${t[0]}.`;
    }
    if (/funciona|opera|roda|passa/.test(n)) return `Sim, a linha ${l.id} opera ${dn}: ${rangeOf(t)}.`;
    return `Linha ${l.id} — ${l.name}. Itinerário: ${l.itin}. ${dn[0].toUpperCase() + dn.slice(1)}: ${rangeOf(t)}.`;
  }
  const pois = findPois(q);
  if (pois.length) return 'Opções próximas (dados de exemplo do MVP):\n' + pois.slice(0, 3).map(poiLines).join('\n') + '\nUse "Para onde você quer ir?" na tela Início para ver a rota no mapa.';
  if (/primeir|mais cedo|cedo/.test(n)) {
    const top = LINES.filter(l => l.s[day].length).sort((a, b) => a.s[day][0].localeCompare(b.s[day][0])).slice(0, 3);
    return 'Primeiros horários ' + dn + ': ' + top.map(l => `linha ${l.id} às ${l.s[day][0]}`).join(', ') + '.';
  }
  if (/ultim|mais tarde|noite|madrugada/.test(n)) {
    const top = LINES.filter(l => l.s[day].length).sort((a, b) => b.s[day].slice(-1)[0].localeCompare(a.s[day].slice(-1)[0])).slice(0, 3);
    return 'Últimos horários ' + dn + ': ' + top.map(l => `linha ${l.id} às ${l.s[day].slice(-1)[0]}`).join(', ') + '.';
  }
  const rel = relevantLines(q);
  if (rel.length) return 'Linhas relacionadas: ' + rel.slice(0, 4).map(l => `${l.id} (${l.name})`).join('; ') + '. Pergunte pelo número da linha para ver horários.';
  if (/onde|localiz|gps|tempo real|posicao/.test(n)) return 'A posição dos ônibus no mapa é uma simulação demonstrativa do MVP, não é GPS real.';
  if (/oi|ola|bom dia|boa tarde|boa noite|ajuda/.test(n) || n.length < 4) return 'Olá! Posso ajudar com horários, itinerários e qual ônibus pegar. Tente: "próximo da linha 500" ou "qual ônibus vai ao mercado?".';
  return 'Não encontrei isso nos dados. Pergunte pelo número da linha (ex.: "horários da 505") ou por um local (ex.: "hospital"), ou confira as telas Linhas e Horários.';
}

/* ---------- interface ---------- */
let iaHistory = [], iaBusy = false;
function appendMsg(who, text) {
  const box = document.getElementById('ia-messages'), d = document.createElement('div');
  d.className = 'msg ' + who; d.textContent = text;
  box.appendChild(d); box.scrollTop = box.scrollHeight; return d;
}
function askQuick(q) { document.getElementById('ia-input').value = q; sendIA(); }
function setIaStatus(online) {
  const el = document.getElementById('ia-status');
  if (!el) return;
  el.textContent = online ? 'IA online · Groq' : 'Assistente local';
  el.className = 'pill ' + (online ? 'ok' : 'gold');
}
async function checkIaStatus() {
  try {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 4000);
    const r = await fetch(API_BASE + '/api/health', { signal: c.signal, cache: 'no-store' });
    clearTimeout(t);
    setIaStatus(r.ok && (await r.json()).ai === true);
  } catch (e) { setIaStatus(false); }
}

async function sendIA() {
  const input = document.getElementById('ia-input'), text = input.value.trim();
  if (!text || iaBusy) return;
  iaBusy = true; input.value = '';
  appendMsg('user', text);
  iaHistory.push({ role: 'user', content: text });
  const typing = appendMsg('bot', 'Digitando…'); typing.classList.add('typing');
  let reply = '', offline = false;
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 30000);
    const r = await fetch(IA_ENDPOINT, {
      method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify({ system: iaSystem(text), messages: iaHistory.slice(-8) })
    });
    clearTimeout(to);
    const data = await r.json().catch(() => ({}));
    reply = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
    if (!r.ok || !reply) throw new Error(data.error || 'sem resposta');
  } catch (e) {
    console.warn('Cyro Bus: IA online indisponível, usando assistente local.', e.message || e);
    reply = localAnswer(text); offline = true;
  }
  typing.remove();
  const d = appendMsg('bot', reply);
  if (offline) { const s = document.createElement('div'); s.className = 'msg-note'; s.textContent = 'Resposta do assistente local (IA online indisponível).'; d.appendChild(s); }
  iaHistory.push({ role: 'assistant', content: reply });
  setIaStatus(!offline);
  iaBusy = false;
}
