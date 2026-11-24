/* =====================================================================
   CYRO BUS — clima (Open-Meteo: gratuita, sem chave)
   • Mostra exatamente o valor "temperature_2m" atual devolvido pela API
     (uma casa decimal, sem arredondar, sem valor fixo).
   • Atualiza a cada 10 min, ao voltar para a aba e ao reconectar.
   • Se a API falhar, mantém o último dado real marcado como desatualizado;
     sem dado nenhum, mostra "--" e tenta de novo em 1 min. Nunca quebra a tela.
   ===================================================================== */

const WEATHER_LOCATIONS = {
  valinhos: { name: 'Valinhos, SP', lat: -22.9707, lon: -46.9937 }
};
let weatherLocKey = 'valinhos'; // localização selecionada
let weatherLast = null;         // último dado válido recebido da API
const WEATHER_REFRESH_MS = 10 * 60 * 1000;
let weatherTimer = null;

// Código WMO → [descrição, ícone]
const WMO = {
  0:['Céu limpo','sun'], 1:['Predominantemente limpo','sun'], 2:['Parcialmente nublado','cloudsun'], 3:['Nublado','cloud'],
  45:['Neblina','fog'], 48:['Neblina com geada','fog'],
  51:['Garoa fraca','rain'], 53:['Garoa','rain'], 55:['Garoa intensa','rain'], 56:['Garoa congelante','rain'], 57:['Garoa congelante','rain'],
  61:['Chuva fraca','rain'], 63:['Chuva','rain'], 65:['Chuva forte','rain'], 66:['Chuva congelante','rain'], 67:['Chuva congelante','rain'],
  71:['Neve fraca','snow'], 73:['Neve','snow'], 75:['Neve forte','snow'], 77:['Grãos de neve','snow'],
  80:['Pancadas de chuva fracas','rain'], 81:['Pancadas de chuva','rain'], 82:['Pancadas de chuva fortes','rain'],
  85:['Pancadas de neve','snow'], 86:['Pancadas de neve fortes','snow'],
  95:['Tempestade','storm'], 96:['Tempestade com granizo','storm'], 99:['Tempestade com granizo forte','storm']
};
const CLOUD = '<path d="M7 14a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 14z"/>';
const WX_ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloudsun: '<circle cx="8" cy="8" r="2.6"/><path d="M8 2.5v1.2M2.5 8h1.2M4 4l.9.9M12 4l-.9.9"/><path d="M9 20a3.5 3.5 0 010-7 5 5 0 019.4 1.4A3 3 0 0118 20z"/>',
  cloud: '<path d="M7 19a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 19z"/>',
  fog: CLOUD + '<path d="M5 18h14M8 21h8"/>',
  rain: CLOUD + '<path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  storm: CLOUD + '<path d="M12 14l-2 4h3l-2 4"/>',
  snow: CLOUD + '<path d="M8 18h.01M12 20h.01M16 18h.01"/>'
};
function wxIcon(kind) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${WX_ICONS[kind] || WX_ICONS.cloud}</svg>`;
}
const fmt1 = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function renderWeather(err) {
  const $ = id => document.getElementById(id);
  if (!$('weather-temp')) return;
  const loc = WEATHER_LOCATIONS[weatherLocKey];
  $('weather-loc').textContent = loc.name;
  const card = $('weather-card');
  if (!weatherLast) {
    $('weather-temp').textContent = '--';
    $('weather-cond').textContent = 'Clima indisponível';
    $('weather-icon').innerHTML = wxIcon('cloud');
    $('weather-meta').textContent = err ? 'Sem conexão com o serviço de clima. Tentando novamente…' : 'Carregando…';
    return;
  }
  const c = weatherLast, info = WMO[c.weather_code] || ['Condição indisponível', 'cloud'];
  $('weather-temp').textContent = fmt1(c.temperature_2m) + '°C';
  $('weather-cond').textContent = info[0];
  $('weather-icon').innerHTML = wxIcon(info[1]);
  const upd = (c.time || '').slice(11, 16);
  $('weather-meta').textContent =
    `Sensação ${fmt1(c.apparent_temperature)}°C · Umidade ${Math.round(c.relative_humidity_2m)}% · Vento ${Math.round(c.wind_speed_10m)} km/h` +
    (upd ? ` · ${err ? 'desatualizado, último dado' : 'atualizado'} às ${upd}` : '');
  card.classList.toggle('stale', !!err);
}

async function loadWeather() {
  clearTimeout(weatherTimer);
  const loc = WEATHER_LOCATIONS[weatherLocKey];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`;
  let failed = false;
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data.current || typeof data.current.temperature_2m !== 'number') throw new Error('resposta inválida');
    weatherLast = data.current;
  } catch (err) {
    failed = true;
    console.warn('Cyro Bus: falha ao buscar o clima.', err);
  } finally { clearTimeout(to); }
  renderWeather(failed);
  weatherTimer = setTimeout(loadWeather, failed ? 60 * 1000 : WEATHER_REFRESH_MS);
}
function setWeatherLocation(key) { if (WEATHER_LOCATIONS[key]) { weatherLocKey = key; weatherLast = null; loadWeather(); } }

document.addEventListener('visibilitychange', () => { if (!document.hidden) loadWeather(); });
window.addEventListener('online', loadWeather);
loadWeather();
