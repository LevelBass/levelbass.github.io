const $ = (s) => document.querySelector(s);
const fmt = (n, d = 0) => n == null ? "–" : n.toLocaleString("es-ES", {minimumFractionDigits:d, maximumFractionDigits:d});
const hex = (p) => p < 25 ? "#e0564c" : p < 50 ? "#e8a23c" : p < 75 ? "#6fbf86" : "#3b9be0";
const lvlClass = (p) => p < 25 ? "l-lo" : p < 50 ? "l-md" : p < 75 ? "l-ok" : "l-hi";
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const varDe = (e) => e.extra ? e.vivo?.var24h : e.variacion_hm3; // embalses solo en directo: variación en 24 h
const trendOf = (e) => { const v = varDe(e); return v > 0.05 ? "sube" : v < -0.05 ? "baja" : "igual"; };
const ico = (n) => `<svg class="i"><use href="#i-${n}"/></svg>`;
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// El Ministerio escribe "Fernandina, La": también se busca en orden natural ("La Fernandina")
const natural = (n) => n.replace(/^(.+?),\s*(El|La|Los|Las)$/i, "$2 $1");

// Silueta de pez (marca de agua de las tarjetas)
document.documentElement.style.setProperty("--fish", `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 90'><path fill='#fff' d='M4 46c8-18 28-30 56-30 20 0 34 6 46 14l10-14c4-5 10-4 10 3v54c0 7-6 8-10 3l-10-14c-12 8-26 14-46 14C32 76 12 64 4 46Z'/></svg>`)}")`);

/* ---------- Google Analytics (solo si el visitante acepta las cookies) ---------- */
const GA_ID = "G-K85QE1YT1G"; // ID de medición de Google Analytics
function cargarGA(){
  if (!GA_ID || window.__ga) return;
  window.__ga = 1;
  const s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID; document.head.appendChild(s);
  window.dataLayer = window.dataLayer || []; window.gtag = function(){ dataLayer.push(arguments); };
  gtag("js", new Date()); gtag("config", GA_ID, {anonymize_ip: true});
}
function cookiesInit(){
  if (!GA_ID) return; // sin ID no hay analítica ni aviso
  let ck = null; try { ck = localStorage.getItem("cookies"); } catch {}
  const caja = $("#cookies"), guardar = (v) => { try { localStorage.setItem("cookies", v); } catch {} caja.hidden = true; if (v === "si") cargarGA(); };
  $("#ck-si").onclick = () => guardar("si"); $("#ck-no").onclick = () => guardar("no");
  if (ck === "si") cargarGA(); else if (ck !== "no") caja.hidden = false;
  const f = $("#foot"); f.insertAdjacentHTML("beforeend", '<p><a href="#" id="ck-reset">Preferencias de cookies</a></p>');
  $("#ck-reset").onclick = (ev) => { ev.preventDefault(); caja.hidden = false; };
}

const PASO = 48;
let lastGridKey = "", all = [], map, layer, markers = new Map(), shown = document.body.dataset.page === "lista" ? 48 : 24, tfilter = "";
let favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem("favs") || "[]")); } catch {}
const saveFavs = () => { try { localStorage.setItem("favs", JSON.stringify([...favs])); } catch {} };

// Nivel actual: si hay lectura en directo se usa esa; si no, el boletín semanal
const lvl = (e) => e.vivo ? {vol:e.vivo.volumen, pct:e.vivo.porcentaje} : {vol:e.volumen, pct:e.porcentaje};
const fdt = (s) => new Date(s).toLocaleString("es-ES", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
// Algunas fuentes (Ebro) solo dan un valor al día: se muestra solo la fecha, no una hora inventada
const fdv = (e) => e.vivo.diario ? new Date(e.vivo.fecha).toLocaleDateString("es-ES", {day:"numeric", month:"short"}) : fdt(e.vivo.fecha);

// Etiquetas orientativas según tamaño, nivel y tendencia (no son datos medidos)
// Embalses confinados (mejillón cebra): datos en data/confinados.js
const CONFD = window.CONFINADOS || {e: [], fuentes: {}};
const CONF = new Map(CONFD.e.map(x => [x.id, x]));
let confCuenca = "";
function confAviso(e){
  const c = CONF.get(e.id); if (!c) return "";
  const f = CONFD.fuentes[c.f];
  return `<div class="confbox"><b>${ico("anchor")} Embalse confinado · ${esc(c.c)}</b><p>Con barca solo puedes navegar aquí: la embarcación queda confinada por el mejillón cebra y no puede usarse en otros embalses sin limpieza y autorización. ${esc(c.n)}</p>${f ? `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)} ↗</a>` : ""}</div>`;
}
// Carruseles horizontales (.cwrap > .ccar con flechas .carr)
function carArrows(c){
  if (!c) return;
  const w = c.closest(".cwrap"); if (!w) return;
  w.querySelector(".carr.prev").disabled = c.scrollLeft < 4;
  w.querySelector(".carr.next").disabled = c.scrollLeft + c.clientWidth >= c.scrollWidth - 4;
}
function initCarousels(){
  document.querySelectorAll(".cwrap").forEach(w => {
    const c = w.querySelector(".ccar");
    c.addEventListener("scroll", () => carArrows(c), {passive: true});
    addEventListener("resize", () => carArrows(c));
    w.querySelectorAll(".carr").forEach(b => b.addEventListener("click", () => c.scrollBy({left: (b.classList.contains("next") ? 1 : -1) * Math.max(240, c.clientWidth * .8), behavior: "smooth"})));
  });
}
function renderConf(){
  if (!$("#confgrid") || !all.length) return;
  const todos = CONFD.e.map(c => ({c, e: all.find(x => x.id === c.id)})).filter(x => x.e);
  const cuencas = [...new Set(todos.map(x => x.c.c))].sort((a, b) => a.localeCompare(b, "es"));
  $("#confchips").innerHTML = `<button class="chip ${confCuenca ? "" : "on"}" data-cc="">Todas (${todos.length})</button>` +
    cuencas.map(cu => `<button class="chip ${confCuenca === cu ? "on" : ""}" data-cc="${esc(cu)}">${esc(cu)} (${todos.filter(x => x.c.c === cu).length})</button>`).join("");
  const lista = todos.filter(x => !confCuenca || x.c.c === confCuenca).sort((a, b) => a.e.nombre.localeCompare(b.e.nombre, "es"));
  $("#confcount").textContent = `${lista.length} embalses confinados`;
  $("#confgrid").innerHTML = lista.map(x => {
    const p = lvl(x.e).pct;
    return `<button type="button" class="crow" data-open="${x.e.id}" title="${esc(x.c.n)}" style="--c:${hex(p)}"><b>${esc(x.e.nombre)}</b><span>${esc(x.c.c)}${x.e.provincia ? " · " + esc(x.e.provincia) : ""}</span><em>${fmt(p,0)} %</em><p>${esc(x.c.n)}</p></button>`;
  }).join("");
  $("#confgrid").scrollLeft = 0; carArrows($("#confgrid"));
  $("#confn").textContent = todos.length;
  const fch = new Date(CONFD.actualizado + "T12:00").toLocaleDateString("es-ES", {day:"numeric", month:"long", year:"numeric"});
  $("#confsrc").innerHTML = `Revisado el ${fch}. Las listas cambian; confirma siempre en tu confederación antes de ir.` +
    ((CONFD.avisos || []).length ? `<details class="avisos"><summary>Ten en cuenta (${CONFD.avisos.length})</summary><ul>${CONFD.avisos.map(t => `<li>${esc(t)}</li>`).join("")}</ul></details>` : "") +
    `<details class="avisos"><summary>Fuentes oficiales</summary><ul>${Object.values(CONFD.fuentes).map(f => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.nombre)}</a></li>`).join("")}</ul></details>`;
}
function badges(e, L){
  const b = [];
  if (CONF.has(e.id)) b.push(`<span class="badge r">${ico("anchor")}Confinado</span>`);
  // acceso según el tamaño del embalse
  if (e.capacidad >= 300) b.push(`<span class="badge">${ico("boat")}Acceso con barco</span>`);
  else if (e.capacidad >= 40) b.push(`<span class="badge">${ico("lure")}Barco o pato</span>`);
  else b.push(`<span class="badge">${ico("kayak")}Acceso con pato</span>`);
  // estado del nivel: cobertura inundada / cota óptima / estructura expuesta
  if (L.pct >= 85) b.push(`<span class="badge g">${ico("leaf")}Cobertura inundada</span>`);
  else if (L.pct < 35) b.push(`<span class="badge r">${ico("wave")}Estructura expuesta</span>`);
  else if (trendOf(e) === "baja") b.push(`<span class="badge">${ico("down")}Bajando</span>`);
  else b.push(`<span class="badge g">${ico("fish")}Cota óptima</span>`);
  return b.join("");
}

// Tarjeta compacta de la barra de favoritos
function favCard(e){
  const L = lvl(e), t = trendOf(e), v = varDe(e), dec = e.extra ? 2 : 1;
  const txt = t === "sube" ? `▲ +${fmt(v,dec)}` : t === "baja" ? `▼ ${fmt(v,dec)}` : "= estable";
  return `<article class="fav" data-open="${e.id}" tabindex="0">
    <button class="fav-x" data-fav="${e.id}" aria-label="Quitar de favoritos" title="Quitar de favoritos">×</button>
    <h3>${esc(e.nombre)}</h3>
    <div class="sub">${esc(e.provincia || e.cuenca)} ${edadHtml(e)}</div>
    <div class="fr"><b style="color:${hex(L.pct)}">${fmt(L.pct,0)}<small> %</small></b><span class="${t==='sube'?'up':t==='baja'?'down':''}">${txt} hm³<br><em>${e.extra ? "24 h" : "semana"}</em></span></div>
    <div class="tank"><i class="${lvlClass(L.pct)}" style="width:${Math.min(L.pct,100)}%"></i></div>
    <div class="favbest" data-best="${e.id}">${e.lat != null ? "Calculando mejor día…" : ""}</div>
    <span class="ver">Ver ficha →</span>
  </article>`;
}

function card(e){
  const t = trendOf(e), v = varDe(e), L = lvl(e), dec = e.extra ? 2 : 1;
  const txt = t === "sube" ? `▲ +${fmt(v,dec)} hm³` : t === "baja" ? `▼ ${fmt(v,dec)} hm³` : "= Estable";
  return `<article class="res" data-id="${e.id}" style="--c:${hex(L.pct)}">
    <button class="star ${favs.has(e.id)?'on':''}" data-fav="${e.id}" aria-label="Marcar favorito" title="Favorito">${favs.has(e.id)?'★':'☆'}</button>
    <h3>${esc(e.nombre)}</h3>
    <div class="sub">${e.provincia ? esc(e.provincia) + " · " : ""}${esc(e.cuenca)} ${edadHtml(e)}</div>
    <div class="badges">${badges(e, L)}</div>
    <div class="row">
      <div class="pc">${fmt(L.pct,0)}<small> %</small></div>
      <div class="trend ${t==='sube'?'up':t==='baja'?'down':''}">${txt}<br><span>${e.extra ? "últimas 24 h" : "vs. semana ant."}</span></div>
    </div>
    <div class="tank"><i class="${lvlClass(L.pct)}" style="width:${Math.min(L.pct,100)}%"></i></div>
    <div class="meta"><span>${fmt(L.vol, e.vivo?1:0)} hm³</span><span>${e.vivo?(e.vivo.diario?'del ':'a las ')+fdv(e):'de '+fmt(e.capacidad, e.capacidad < 20 ? 1 : 0)+' hm³'}</span></div>
  </article>`;
}

/* ---------- Ficha de embalse ---------- */
const SERV = "https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services/Embalses_Total/FeatureServer/0/query";
function spark(pts, w, h, color){
  if (pts.length < 2) return "";
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), pad = (y1 - y0) * .15 || 1;
  const X = x => (x - x0) / ((x1 - x0) || 1) * (w - 6) + 3, Y = y => h - 4 - (y - (y0 - pad)) / ((y1 + pad) - (y0 - pad)) * (h - 8);
  const d = pts.map((p,i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none"><path d="${d} L${X(x1)} ${h} L${X(x0)} ${h}Z" fill="${color}" opacity=".15"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}
function stat(k, v, s){ return `<div class="st"><small>${k}</small><b>${v}</b>${s?`<span>${s}</span>`:""}</div>`; }

/* ---------- Tiempo, viento, luna y mapas ---------- */
const MADRID = [40.4, -3.7];
const dirTxt = (deg) => ["N","NE","E","SE","S","SO","O","NO"][Math.round((deg % 360) / 45) % 8];
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2,"0")}:${String(Math.round(m % 60)).padStart(2,"0")}`;
const minDia = (d, d0) => d ? Math.round((d - d0) / 60000) : null;

// Código meteorológico (WMO) -> icono y texto
function wmo(c){
  if (c === 0) return {i:"sun", t:"Despejado"};
  if (c <= 2) return {i:"cloudsun", t:"Poco nuboso"};
  if (c === 3) return {i:"cloud", t:"Nublado"};
  if (c === 45 || c === 48) return {i:"fog", t:"Niebla"};
  if (c >= 51 && c <= 57) return {i:"rain", t:"Llovizna"};
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return {i:"rain", t:"Lluvia"};
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return {i:"snow", t:"Nieve"};
  if (c >= 95) return {i:"storm", t:"Tormenta"};
  return {i:"cloud", t:"Variable"};
}

const wxCache = new Map();
async function getWx(lat, lon){
  const k = lat.toFixed(2) + "," + lon.toFixed(2);
  if (!wxCache.has(k)){
    const q = new URLSearchParams({
      latitude: lat, longitude: lon, timezone: "Europe/Madrid", forecast_days: 7, past_hours: 6, wind_speed_unit: "kmh",
      current: "temperature_2m,weather_code,surface_pressure,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day",
      hourly: "pressure_msl",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    });
    wxCache.set(k, fetch("https://api.open-meteo.com/v1/forecast?" + q).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  }
  return wxCache.get(k);
}

// Tendencia de la presión en las últimas 3 horas
function presion(w){
  const t = w.hourly.time, p = w.hourly.pressure_msl, now = w.current.time.slice(0, 13);
  const i = t.findIndex(x => x.slice(0, 13) === now);
  if (i < 3 || p[i] == null || p[i-3] == null) return {hpa: w.current.pressure_msl, dif: null, txt: "sin tendencia"};
  const dif = p[i] - p[i-3];
  return {hpa: w.current.pressure_msl, dif, txt: dif >= 1.5 ? "subiendo" : dif <= -1.5 ? "bajando" : "estable", cls: dif >= 1.5 ? "up" : dif <= -1.5 ? "down" : ""};
}

/* ---- Luna y periodos solunares (SunCalc) ---- */
function faseLuna(p){
  if (p < 0.03 || p > 0.97) return "Luna nueva";
  if (p < 0.22) return "Creciente";
  if (p < 0.28) return "Cuarto creciente";
  if (p < 0.47) return "Gibosa creciente";
  if (p < 0.53) return "Luna llena";
  if (p < 0.72) return "Gibosa menguante";
  if (p < 0.78) return "Cuarto menguante";
  return "Menguante";
}
function lunaSvg(p, s = 44){
  const r = 20, c = 24, k = Math.cos(2 * Math.PI * p), rx = Math.abs(r * k).toFixed(2), waxing = p < 0.5;
  // parte iluminada: semicírculo + elipse del terminador
  const sweepOuter = waxing ? 1 : 0, sweepInner = (waxing ? k > 0 : k < 0) ? 0 : 1;
  const lit = `M${c} ${c - r}A${r} ${r} 0 0 ${sweepOuter} ${c} ${c + r}A${rx} ${r} 0 0 ${sweepInner} ${c} ${c - r}Z`;
  return `<svg viewBox="0 0 48 48" width="${s}" height="${s}" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="#0a1d27" stroke="#2c5566"/><path d="${lit}" fill="#f0e3b8"/></svg>`;
}
function solunar(fecha, lat, lon){
  const d0 = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  let alto = -9, bajo = 9, mAlto = null, mBajo = null;
  for (let m = 0; m < 1440; m += 8){ // cada 8 min basta para situar el paso de la luna (±4 min) y es mucho más ligero
    const a = SunCalc.getMoonPosition(new Date(d0.getTime() + m * 60000), lat, lon).altitude;
    if (a > alto){ alto = a; mAlto = m; }
    if (a < bajo){ bajo = a; mBajo = m; }
  }
  const mt = SunCalc.getMoonTimes(d0, lat, lon), sol = SunCalc.getTimes(new Date(d0.getTime() + 12 * 3600e3), lat, lon); // el sol se calcula al mediodía para no coger el día anterior
  const orto = minDia(sol.sunrise, d0), ocaso = minDia(sol.sunset, d0);
  const per = [];
  // periodos mayores: la luna en lo más alto y en lo más bajo (unas 2 h); menores: salida y puesta de luna (1 h)
  if (mAlto > 8 && mAlto < 1432) per.push({t:"mayor", c: mAlto, ini: mAlto - 60, fin: mAlto + 60, n:"Luna arriba"});
  if (mBajo > 8 && mBajo < 1432) per.push({t:"mayor", c: mBajo, ini: mBajo - 60, fin: mBajo + 60, n:"Luna abajo"});
  const sal = minDia(mt.rise, d0), pue = minDia(mt.set, d0);
  if (sal != null) per.push({t:"menor", c: sal, ini: sal - 30, fin: sal + 30, n:"Salida de la luna"});
  if (pue != null) per.push({t:"menor", c: pue, ini: pue - 30, fin: pue + 30, n:"Puesta de la luna"});
  per.sort((a, b) => a.c - b.c);
  let nM = 0, nm = 0;
  for (const p of per) p.k = p.t === "mayor" ? "M" + (++nM) : "m" + (++nm); // M1, M2 (mayores) y m1, m2 (menores)
  const il = SunCalc.getMoonIllumination(new Date(d0.getTime() + 12 * 3600e3));
  // valoración orientativa: lunas nuevas y llenas + periodos que coinciden con amanecer o atardecer
  const cs = Math.abs(Math.cos(2 * Math.PI * il.phase)), razones = [];
  let v = 2;
  if (cs > 0.8){ v += 2; razones.push("Luna cerca de nueva o llena: la mejor fase (+2)"); }
  else if (cs > 0.5){ v += 1; razones.push("Luna algo alejada de los cuartos (+1)"); }
  if (per.some(x => x.t === "mayor" && [orto, ocaso].some(s => s != null && Math.abs(s - x.c) <= 90))){ v += 1; razones.push("Un periodo mayor coincide con el amanecer o el atardecer (+1)"); }
  if (!razones.length) razones.push("Sin factores a favor: día normal");
  return {per, orto, ocaso, sal, pue, razones, fase: il.phase, fraccion: il.fraction, edad: il.phase * 29.530588, nombre: faseLuna(il.phase), estrellas: Math.min(5, v)};
}
const estrellas = (n) => "★".repeat(n) + `<span style="opacity:.25">${"★".repeat(5 - n)}</span>`;
function lineaDia(s){
  const seg = s.per.map(p => `<i class="${p.t}" style="left:${Math.max(0, p.ini) / 14.4}%;width:${(Math.min(1440, p.fin) - Math.max(0, p.ini)) / 14.4}%" title="${p.n} ${hhmm(Math.max(0,p.ini))}–${hhmm(Math.min(1440,p.fin))}"></i>`).join("");
  const sun = [s.orto, s.ocaso].filter(x => x != null).map(m => `<b style="left:${m / 14.4}%" title="${m === s.orto ? "Amanecer" : "Atardecer"} ${hhmm(m)}"></b>`).join("");
  return `<div class="dia"><div class="bar24">${seg}${sun}</div><div class="ticks"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div></div>`;
}
function lunaHtml(lat, lon){
  const hoy = new Date(), filas = [];
  for (let i = 0; i < 5; i++){
    const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i), s = solunar(f, lat, lon);
    filas.push({f, s});
  }
  const s0 = filas[0].s;
  const lista = (s) => s.per.map(p => `<li class="${p.t}"><span>${p.t === "mayor" ? "Mayor" : "Menor"} · ${p.n}</span><b>${hhmm(Math.max(0,p.ini))}–${hhmm(Math.min(1440,p.fin))}</b></li>`).join("") || "<li>Sin periodos hoy</li>";
  return `<div class="luna-hoy">${lunaSvg(s0.fase, 64)}<div><b>${s0.nombre}</b><span>${fmt(s0.fraccion * 100, 0)} % iluminada</span><span class="est">${estrellas(s0.estrellas)} actividad estimada hoy</span></div></div>
    ${lineaDia(s0)}
    <ul class="per">${lista(s0)}</ul>
    <h4>Próximos días</h4>
    <div class="dias5">${filas.slice(1).map(({f, s}) => `<div>${lunaSvg(s.fase, 30)}<b>${f.toLocaleDateString("es-ES", {weekday:"short", day:"numeric"})}</b><span class="est">${estrellas(s.estrellas)}</span></div>`).join("")}</div>
    <p class="src">Los periodos solunares son una tradición de pesca (mayores: luna en su punto más alto o más bajo; menores: salida y puesta de la luna). Sirven de referencia, no están demostrados científicamente. La zona verde de la barra son los menores; la dorada, los mayores.</p>`;
}

/* ---- Tiempo ---- */
function wxHtml(w){
  const c = w.current, ic = wmo(c.weather_code), pr = presion(w);
  const dias = w.daily.time.slice(0, 5).map((t, i) => {
    const d = wmo(w.daily.weather_code[i]);
    return `<div class="dwx"><b>${new Date(t + "T12:00").toLocaleDateString("es-ES", {weekday:"short", day:"numeric"})}</b>${ico(d.i)}<span>${d.t}</span><em>${Math.round(w.daily.temperature_2m_max[i])}° <small>${Math.round(w.daily.temperature_2m_min[i])}°</small></em><span class="r">${ico("drop")} ${w.daily.precipitation_probability_max[i] ?? 0} %</span></div>`;
  }).join("");
  return `<div class="stats">
      ${stat("Ahora", `${ico(ic.i)} ${fmt(c.temperature_2m,0)} °C`, ic.t)}
      ${stat("Máx. / mín. hoy", `${Math.round(w.daily.temperature_2m_max[0])}° / ${Math.round(w.daily.temperature_2m_min[0])}°`, "")}
      ${stat("Prob. de lluvia", `${w.daily.precipitation_probability_max[0] ?? 0} %`, "máxima de hoy")}
      ${stat("Presión", `${fmt(pr.hpa,0)} hPa`, pr.dif == null ? "" : `<span class="${pr.cls}">${pr.dif >= 0 ? "+" : ""}${fmt(pr.dif,1)} hPa en 3 h · ${pr.txt}</span>`)}
    </div>
    <div class="dias-wx">${dias}</div>
    <p class="src">Datos de <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a>. Muchos pescadores vigilan la presión: los cambios bruscos suelen afectar a la actividad de los peces. Es solo una referencia.</p>`;
}
function vientoHtml(w, lat, lon){
  const c = w.current;
  const url = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&zoom=10&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=true&calendar=now&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
  return `<div class="stats">
      ${stat("Viento", `${fmt(c.wind_speed_10m,0)} km/h`, `del ${dirTxt(c.wind_direction_10m)} (${Math.round(c.wind_direction_10m)}°)`)}
      ${stat("Rachas", `${fmt(c.wind_gusts_10m,0)} km/h`, "máximas")}
      ${stat("Hoy, máx.", `${fmt(w.daily.wind_speed_10m_max[0],0)} km/h`, "viento sostenido")}
    </div>
    <div class="embed"><iframe loading="lazy" title="Mapa de viento Windy" src="${url}" allowfullscreen></iframe></div>
    <p class="src">Mapa interactivo de <a href="https://www.windy.com" target="_blank" rel="noopener">Windy.com</a>. El viento se indica de dónde sopla.</p>`;
}

/* ---- Imágenes de otras épocas ---- */
// Fotos aéreas del IGN (WMS) y satélite por año de Esri Wayback (la cifra es el número de versión de Wayback)
const HIST_IGN = [["AMS_1956-1957", "Vuelo americano 1956-57"], ["Interministerial_1973-1986", "Interministerial 1973-86"], ["Nacional_1981-1986", "Nacional 1981-86"], ["OLISTAT", "OLISTAT 1997-98"], ["SIGPAC", "SIGPAC 1997-2003"],
  ...Array.from({length: 21}, (_, i) => [`PNOA${2004 + i}`, `PNOA ${2004 + i}`])];
const HIST_ESRI = [[5844, 2014], [28163, 2015], [18966, 2016], [25521, 2017], [23448, 2018], [4756, 2019], [29260, 2020], [26120, 2021], [45134, 2022], [56102, 2023], [16453, 2024], [13192, 2025]];
function histOpciones(){
  const o = (v, t) => `<option value="${v}">${t}</option>`;
  return `<option value="">Sin imagen histórica</option>
    <optgroup label="Fotos aéreas del IGN">${HIST_IGN.map(([id, t]) => o("ign:" + id, t)).join("")}</optgroup>
    <optgroup label="Satélite por año (Esri)">${HIST_ESRI.map(([id, y]) => o("esri:" + id, "Satélite " + y)).join("")}</optgroup>`;
}

/* ---- Mapa topográfico ---- */
let tmap = null;
function topoMapa(e){
  const box = $("#tmap"); if (!box || e.lat == null) return;
  if (tmap){ tmap.remove(); tmap = null; }
  try {
    const topo = L.tileLayer("https://tile.opentopomap.org/{z}/{x}/{y}.png", {maxZoom:17, attribution:"© OpenTopoMap, © OpenStreetMap"});
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {maxZoom:18, attribution:"Imágenes © Esri"});
    tmap = L.map(box, {layers:[sat], scrollWheelZoom:false}).setView([e.lat, e.lon], 13);
    L.control.layers({"Satélite": sat, "Topográfico": topo}, null, {collapsed:false}).addTo(tmap);
    L.circleMarker([e.lat, e.lon], {radius:8, color:"#06141c", weight:2, fillColor:"#f0c874", fillOpacity:1}).addTo(tmap).bindTooltip(e.nombre);
    // Imagen de otra época por encima de la actual, con un deslizador para compararlas
    const sel = $("#histsel"), op = $("#histop"); let hl = null;
    if (sel && op){
      sel.onchange = () => {
        if (hl){ tmap.removeLayer(hl); hl = null; }
        op.disabled = !sel.value; if (!sel.value) return;
        const [tipo, id] = sel.value.split(":");
        hl = tipo === "ign"
          ? L.tileLayer.wms("https://www.ign.es/wms/pnoa-historico", {layers: id, format: "image/png", transparent: true, version: "1.3.0", maxZoom: 19, zIndex: 5, attribution: "© IGN · fotos aéreas históricas"})
          : L.tileLayer(`https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${id}/{z}/{y}/{x}`, {maxZoom: 18, zIndex: 5, attribution: "Esri Wayback"});
        hl.setOpacity(op.value / 100); hl.addTo(tmap);
      };
      op.oninput = () => { if (hl) hl.setOpacity(op.value / 100); };
    }
    setTimeout(() => tmap && tmap.invalidateSize(), 60);
  } catch { box.innerHTML = '<div class="empty">No se pudo cargar el mapa.</div>'; }
}

/* ---------- Ficha de embalse ---------- */
/* ---------- Antigüedad del dato ---------- */
function edad(e){
  const f = e.vivo ? new Date(e.vivo.fecha) : e.fecha ? new Date(e.fecha + "T12:00") : null;
  if (!f || isNaN(f)) return null;
  const min = Math.max(0, (Date.now() - f) / 60000);
  if (e.vivo?.diario) return {txt: "del " + fdv(e), cls: min <= 36 * 60 ? "" : min <= 72 * 60 ? "mid" : "old", vivo: true, diario: true};
  const txt = min < 90 ? `hace ${Math.max(1, Math.round(min))} min` : min < 2880 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} d`;
  return e.vivo ? {txt, cls: min <= 180 ? "" : min <= 720 ? "mid" : "old", vivo: true} : {txt, cls: min <= 10 * 1440 ? "wk" : "old", vivo: false};
}
function edadHtml(e, largo){
  const a = edad(e); if (!a) return "";
  return a.vivo
    ? `<span class="live ${a.cls}" title="${a.diario ? "Valor diario del SAIH de la confederación" : "Última lectura del SAIH de la confederación"}">● ${a.diario ? (largo ? "Dato diario " : "Diario ") : largo ? "En directo · " : ""}${a.txt}</span>`
    : `<span class="live wk ${a.cls === "old" ? "old" : ""}" title="Dato del boletín semanal del Ministerio">${largo ? "Boletín semanal · " : "Semanal · "}${a.txt}</span>`;
}

/* ---------- Tendencia del nivel (24 h, 7 días, 30 días) ---------- */
// Variación a partir del historial en directo, solo si cubre casi todo el periodo pedido
function histVar(e, dias){
  const h = e.vivo?.historial; if (!h || h.length < 2) return null;
  const fin = h[h.length - 1], t1 = new Date(fin[0]).getTime();
  const ini = h.find(([t]) => t1 - new Date(t).getTime() <= dias * 864e5);
  if (!ini || ini === fin) return null;
  return (t1 - new Date(ini[0]).getTime()) / 864e5 >= dias - 0.75 ? fin[1] - ini[1] : null;
}
function tendencias(e){
  const d1 = e.vivo?.var24h ?? null;
  let d7 = histVar(e, 7);
  if (d7 == null && !e.extra) d7 = e.variacion_hm3;
  return {d1, d7, d30: e.var4s_hm3 ?? null};
}
// Lectura orientativa para el black bass según el ritmo de cambio (puntos de llenado por día)
function consejoNivel(e, t){
  const cap = e.capacidad; if (!cap) return null;
  const r = t.d1 != null ? t.d1 / cap * 100 : t.d7 != null ? t.d7 / cap * 100 / 7 : null;
  if (r == null) return null;
  if (r >= 0.4) return {cls: "up", t: "Sube deprisa", d: "El agua nueva cubre orillas y vegetación, y el black bass suele adelantarse a las zonas recién inundadas. Prueba cebos de poca profundidad pegados a la orilla; si el agua baja turbia, señuelos que hagan ruido o vibren."};
  if (r >= 0.1) return {cls: "up", t: "Va subiendo", d: "Buena señal: los peces siguen el agua nueva hacia la orilla y la vegetación inundada."};
  if (r <= -0.4) return {cls: "down", t: "Baja deprisa", d: "Los peces se retiran a zonas más hondas y comen peor. Busca cortados, puntas y el antiguo cauce, y lleva el señuelo más lento y más abajo."};
  if (r <= -0.1) return {cls: "down", t: "Va bajando", d: "Los peces se alejan de la orilla hacia estructuras algo más hondas: puntas, bordes de vegetación y caídas."};
  return {cls: "", t: "Nivel estable", d: "Los peces mantienen sus zonas habituales: lo que te funcionó en tus últimas salidas suele seguir funcionando."};
}
function tendHtml(e){
  const t = tendencias(e), cap = e.capacidad;
  const celda = (lbl, v, nota) => {
    if (v == null) return `<div class="tc"><small>${lbl}</small><b>–</b><span>${nota}</span></div>`;
    const p = cap ? v / cap * 100 : null, cl = v > 0.004 ? "up" : v < -0.004 ? "down" : "", fl = v > 0.004 ? "▲" : v < -0.004 ? "▼" : "■";
    return `<div class="tc"><small>${lbl}</small><b class="${cl}">${fl} ${v > 0 ? "+" : ""}${fmt(v, Number.isInteger(v) ? 0 : Math.abs(v) < 10 ? 2 : 1)} hm³</b><span class="${cl}">${p == null ? "" : (p > 0 ? "+" : "") + fmt(p, 1) + " pts de llenado"}</span></div>`;
  };
  const c = consejoNivel(e, t);
  return `<h4>Tendencia del nivel</h4><div class="tend">
    ${celda("24 horas", t.d1, e.vivo ? "acumulando historial" : "solo con lectura en directo")}
    ${celda("7 días", t.d7, e.extra ? "acumulando historial" : "sin datos")}
    ${celda("30 días", t.d30, "sin datos")}
  </div>${c ? `<div class="consejo ${c.cls ? "c-" + c.cls : ""}"><b>${c.cls === "up" ? "▲" : c.cls === "down" ? "▼" : "■"} ${c.t}</b><p>${c.d}</p><small>Lectura orientativa para black bass, no un dato medido.</small></div>` : ""}`;
}

/* ---------- Temperatura estimada del agua y fase del black bass ---------- */
const tempCache = new Map();
function getTemps(lat, lon){
  const k = lat.toFixed(2) + "," + lon.toFixed(2);
  if (!tempCache.has(k)){
    const q = new URLSearchParams({latitude: lat, longitude: lon, timezone: "Europe/Madrid", past_days: 21, forecast_days: 1, daily: "temperature_2m_mean"});
    tempCache.set(k, fetch("https://api.open-meteo.com/v1/forecast?" + q).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }));
  }
  return tempCache.get(k);
}
// El agua tarda en calentarse y enfriarse: se estima con una media móvil de la temperatura media diaria del aire
function aguaEstimada(j){
  const t = (j.daily?.temperature_2m_mean || []).filter(x => x != null); if (t.length < 10) return null;
  let tw = (t[0] + t[1] + t[2]) / 3; const serie = [tw];
  for (const x of t.slice(3)){ tw += 0.13 * (x - tw); serie.push(tw); }
  return {temp: Math.min(29, Math.max(6, tw)), sube: tw - serie[serie.length - 8] > 0};
}
const FASES = {
  invierno: {n: "Invierno", t: "Agua fría: el black bass está lento y agrupado en zonas hondas y soleadas. Pesca lenta, señuelos pequeños y de movimiento suave, y mejor en las horas centrales del día."},
  prefreza: {n: "Prefreza", t: "El agua se templa y los peces se acercan a la orilla a comer fuerte antes de la freza. Buen momento para jerkbaits, crankbaits de poca profundidad y spinnerbaits en puntas y zonas someras con sol."},
  freza: {n: "Freza", t: "Los machos preparan nidos en fondos duros y poco profundos. Evita molestar a los peces que vigilan nido y consulta si tu comunidad limita la pesca en esta época."},
  postfreza: {n: "Postfreza", t: "Los peces se recuperan y se dispersan; al principio comen poco. Prueba cebos naturales y lentos cerca de vegetación y estructuras, en las primeras y últimas horas."},
  verano: {n: "Verano", t: "Agua cálida: los peces buscan sombra y frescor (profundidad, vegetación, árboles, estructuras). Pesca al amanecer y atardecer, o cebos más hondos durante el día."},
  otono: {n: "Otoño", t: "El pez se activa para alimentarse antes del invierno y persigue bancos de pequeños peces. Buenas jornadas con crankbaits, vibrantes y swimbaits cerca de los alevines."},
  otonoTardio: {n: "Otoño tardío", t: "El agua se enfría y el pez se vuelve más selectivo y lento, agrupado en zonas más hondas. Cebos más lentos y pequeños, y paciencia."},
};
function faseBass(temp, mes){
  if (temp < 10) return FASES.invierno;
  if (mes >= 2 && mes <= 7) return temp < 15 ? FASES.prefreza : temp <= 20.5 ? FASES.freza : temp <= 24 ? FASES.postfreza : FASES.verano;
  return temp >= 22 ? FASES.verano : temp >= 16 ? FASES.otono : FASES.otonoTardio;
}
function aguaHtml(a){
  if (!a) return "";
  const f = faseBass(a.temp, new Date().getMonth() + 1);
  return `<h4>Agua y fase del black bass</h4><div class="agua"><div class="at"><b>${fmt(a.temp, 0)}<small> °C</small></b><span>agua estimada</span></div>
    <div class="af"><b>${f.n}</b><p>${f.t}</p></div></div>
    <p class="src">Estimación a partir de las temperaturas del aire de las últimas semanas (no es una medición del embalse). La fase es orientativa y cambia según la altitud y la zona.</p>`;
}

/* ---------- Mejor día de la semana (solunar + presión + viento + lluvia) ---------- */
function mejorSemana(w, lat, lon){
  const out = [];
  for (let i = 0; i < w.daily.time.length; i++){
    const dia = w.daily.time[i], fecha = new Date(dia + "T12:00"), s = solunar(fecha, lat, lon);
    const viento = w.daily.wind_speed_10m_max[i] ?? 0, lluvia = w.daily.precipitation_probability_max[i] ?? 0;
    const iA = w.hourly.time.indexOf(dia + "T06:00"), iB = w.hourly.time.indexOf(dia + "T20:00");
    const pa = iA >= 0 ? w.hourly.pressure_msl[iA] : null, pb = iB >= 0 ? w.hourly.pressure_msl[iB] : null;
    const dp = pa != null && pb != null ? pb - pa : null;
    const razones = [];
    const sol = s.estrellas * 4; if (s.estrellas >= 4) razones.push("luna favorable");
    let vi = 3; if (viento <= 8){ vi = 18; razones.push("casi sin viento"); } else if (viento <= 22){ vi = 25; razones.push("brisa suave"); } else if (viento <= 30){ vi = 12; razones.push("viento fuerte"); } else razones.push("mucho viento");
    let ll = 3; if (lluvia <= 20){ ll = 20; razones.push("sin lluvia"); } else if (lluvia <= 40) ll = 15; else if (lluvia <= 60){ ll = 9; razones.push("riesgo de lluvia"); } else razones.push("lluvia probable");
    let pr = 15; // sin dato: neutro
    if (dp != null){
      if (dp < -6){ pr = 10; razones.push("presión cayendo rápido"); }
      else if (dp < -1.5){ pr = 25; razones.push("presión bajando poco a poco"); }
      else if (dp <= 1.5){ pr = 16; razones.push("presión estable"); }
      else if (dp <= 4){ pr = 12; razones.push("presión subiendo"); }
      else { pr = 6; razones.push("presión subiendo deprisa"); }
    }
    // cielo: el pez suele moverse mejor con nubes que con sol fuerte y sin una nube
    const cod = w.daily.weather_code[i]; let ci = 4;
    if (cod === 2 || cod === 3){ ci = 8; razones.push("cielo nublado"); } else if (cod === 0 || cod === 1) ci = 3; else if (cod >= 95) ci = 0;
    const pts = Math.round(sol + vi + ll + pr + ci);
    out.push({fecha, pts, razones, etiqueta: pts >= 85 ? "Excelente" : pts >= 72 ? "Muy bueno" : pts >= 58 ? "Bueno" : pts >= 44 ? "Regular" : "Flojo"});
  }
  return out;
}
function mejorHtml(sem){
  if (!sem?.length) return "";
  const m = sem.reduce((a, b) => b.pts > a.pts ? b : a);
  const barras = sem.map(d => `<div class="bd ${d === m ? "best" : ""}" title="${d.etiqueta}: ${d.razones.join(", ")}"><b>${d.pts}</b><u><i style="height:${Math.max(8, (d.pts - 35) / 65 * 100)}%"></i></u><span>${d.fecha.toLocaleDateString("es-ES", {weekday: "short"})}<br>${d.fecha.getDate()}</span></div>`).join("");
  return `<h4>Mejor día de la semana</h4><div class="mejor"><div class="bdias">${barras}</div>
    <p><b>${larga(m.fecha)}</b> · ${m.pts}/100 · ${m.etiqueta}<br><span>${m.razones.join(", ")}</span></p></div>
    <p class="src">Nota orientativa que combina fase lunar y periodos solunares, presión, viento y probabilidad de lluvia. No es una predicción de capturas.</p>`;
}
const mejorCache = new Map(); // id -> semana calculada
function cargarMejorDia(){
  for (const e of all){
    if (!favs.has(e.id) || e.lat == null || mejorCache.has(e.id)) continue;
    mejorCache.set(e.id, "x");
    getWx(e.lat, e.lon).then(w => { mejorCache.set(e.id, mejorSemana(w, e.lat, e.lon)); pintaMejorFav(e.id); }).catch(() => mejorCache.delete(e.id));
  }
}
function pintaMejorFav(id){
  const n = document.querySelector(`[data-best="${id}"]`), s = mejorCache.get(id); if (!n || !Array.isArray(s)) return;
  const m = s.reduce((a, b) => b.pts > a.pts ? b : a);
  n.innerHTML = `Mejor día: <b>${m.fecha.toLocaleDateString("es-ES", {weekday: "short", day: "numeric"})}</b> · ${m.pts}`;
}

/* ---------- Avisos y alertas (se comprueban con la web abierta) ---------- */
let alertas = [], estadoAl = {};
try { alertas = JSON.parse(localStorage.getItem("alertas") || "[]"); estadoAl = JSON.parse(localStorage.getItem("alertasEstado") || "{}"); } catch {}
const guardaAl = () => { try { localStorage.setItem("alertas", JSON.stringify(alertas)); localStorage.setItem("alertasEstado", JSON.stringify(estadoAl)); } catch {} };
const claveAl = (a) => `${a.id}|${a.tipo}|${a.valor}`;
function toast(html, ms = 6000, acciones){
  let t = $("#toast"); if (!t){ t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.innerHTML = `<span>${html}</span>${(acciones || []).map((a, i) => `<button type="button" data-ta="${i}">${a.t}</button>`).join("")}`;
  t.onclick = (ev) => { const b = ev.target.closest("[data-ta]"); if (b){ acciones[+b.dataset.ta].f(); t.classList.remove("on"); } };
  t.classList.add("on"); clearTimeout(t._h); if (ms) t._h = setTimeout(() => t.classList.remove("on"), ms);
}
function notificar(titulo, cuerpo){ try { if ("Notification" in window && Notification.permission === "granted") new Notification(titulo, {body: cuerpo, icon: "/img/icon-192.png"}); } catch {} }
async function cumple(a){
  const e = all.find(x => x.id === a.id); if (!e) return null;
  if (a.tipo === "sube") return lvl(e).pct >= a.valor;
  if (a.tipo === "baja") return lvl(e).pct <= a.valor;
  if (e.lat == null) return null;
  const p = presion(await getWx(e.lat, e.lon));
  return p.dif != null && p.dif <= -a.valor;
}
function textoAl(a){
  const e = all.find(x => x.id === a.id); if (!e) return "";
  return a.tipo === "sube" ? `${e.nombre} está al ${fmt(lvl(e).pct, 0)} % (tu aviso: por encima del ${a.valor} %)`
    : a.tipo === "baja" ? `${e.nombre} está al ${fmt(lvl(e).pct, 0)} % (tu aviso: por debajo del ${a.valor} %)`
    : `${e.nombre}: la presión está cayendo (tu aviso: bajada de ${a.valor} hPa o más en 3 h)`;
}
async function revisarAlertas(){
  const activas = [];
  for (const a of alertas){
    let ok = null; try { ok = await cumple(a); } catch {}
    if (ok == null) continue;
    const k = claveAl(a);
    if (ok){ activas.push(a); if (!estadoAl[k]){ estadoAl[k] = 1; toast("🔔 " + esc(textoAl(a)), 9000); notificar("LevelBass", textoAl(a)); } }
    else delete estadoAl[k];
  }
  guardaAl();
  const box = $("#avisos");
  if (box) box.innerHTML = activas.length ? `<div class="avisobox"><b>🔔 Tus alertas activas</b><ul>${activas.map(a => `<li><button type="button" data-open="${a.id}">${esc(textoAl(a))}</button></li>`).join("")}</ul></div>` : "";
}
function alertasHtml(id){
  const mias = alertas.filter(a => a.id === id);
  const lista = mias.map(a => `<li><span>${a.tipo === "sube" ? "Nivel por encima del " + a.valor + " %" : a.tipo === "baja" ? "Nivel por debajo del " + a.valor + " %" : "Presión baja " + a.valor + " hPa o más en 3 h"}${estadoAl[claveAl(a)] ? ' <em>· activa ahora</em>' : ""}</span><button type="button" data-aldel="${alertas.indexOf(a)}" aria-label="Quitar alerta">×</button></li>`).join("");
  const perm = "Notification" in window && Notification.permission === "default" ? '<button type="button" class="mini" data-alperm>Activar avisos del dispositivo</button>' : "";
  return `<h4>Alertas de este embalse</h4><div class="alertbox">
    ${lista ? `<ul class="allist">${lista}</ul>` : '<p class="src" style="margin:0 0 8px">Aún no tienes alertas aquí.</p>'}
    <div class="aladd"><select id="altipo" aria-label="Tipo de alerta"><option value="baja">Avísame si el nivel baja de…</option><option value="sube">Avísame si el nivel sube de…</option><option value="presion">Avísame si la presión baja…</option></select>
    <input id="alval" type="number" inputmode="decimal" min="1" max="100" step="1" value="40" aria-label="Valor"><span id="alud">%</span><button type="button" class="mini on" data-aladd="${id}">Añadir</button></div>
    ${perm}
    <p class="src">Las alertas se comprueban mientras tienes LevelBass abierta (en el móvil, mejor con la web instalada en la pantalla de inicio). No llegan avisos con la web cerrada.</p></div>`;
}
function pintaAlertasFicha(){ const b = $("#p-alert"); if (b && fichaId != null) b.innerHTML = alertasHtml(fichaId); }

/* ---------- Compartir ---------- */
async function copiar(txt){
  try { await navigator.clipboard.writeText(txt); return true; } catch {}
  const t = document.createElement("textarea"); t.value = txt; t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {} t.remove(); return ok;
}
async function compartir(id){
  const e = all.find(x => x.id === id); if (!e) return;
  const url = `${SITE}e/${slugs.get(id)}/`, L = lvl(e);
  const texto = `${e.nombre}: ${fmt(L.pct, 0)} % de agua (${fmt(L.vol, e.vivo ? 1 : 0)} de ${fmt(e.capacidad)} hm³) · LevelBass`;
  try { if (navigator.share){ await navigator.share({title: e.nombre + " · LevelBass", text: texto, url}); return; } } catch (err) { if (err && err.name === "AbortError") return; }
  toast(await copiar(texto + "\n" + url) ? "Enlace copiado. Pégalo donde quieras." : "No se pudo copiar: " + esc(url), 4000);
}
// Los favoritos viajan en el enlace (ids separados por puntos): sirve para pasarlos de un dispositivo a otro o a un amigo
async function compartirFavs(){
  if (!favs.size) return;
  const url = `${SITE}#/favs=${[...favs].join(".")}`;
  toast(await copiar(url) ? "Enlace copiado. Ábrelo en tu otro dispositivo para copiar allí tus favoritos." : "No se pudo copiar el enlace", 5000);
}
function ofrecerFavs(ids){
  const nuevos = ids.filter(i => all.some(e => e.id === i) && !favs.has(i));
  history.replaceState(null, "", location.pathname + location.search);
  if (!nuevos.length){ toast("Ya tienes esos favoritos guardados.", 4000); return; }
  toast(`Este enlace trae <b>${nuevos.length}</b> embalse${nuevos.length > 1 ? "s" : ""} favorito${nuevos.length > 1 ? "s" : ""}.`, 0, [
    {t: "Añadirlos", f: () => { nuevos.forEach(i => favs.add(i)); saveFavs(); render(); toast("Favoritos añadidos.", 3000); }},
    {t: "Ahora no", f: () => {}},
  ]);
}

/* ---------- Rampas y accesos cercanos (OpenStreetMap) ---------- */
const rampasCache = new Map();
async function buscaRampas(lat, lon){
  const k = lat.toFixed(3) + "," + lon.toFixed(3);
  if (rampasCache.has(k)) return rampasCache.get(k);
  const q = `[out:json][timeout:20];(nwr["leisure"="slipway"](around:8000,${lat},${lon});nwr["leisure"="fishing"](around:8000,${lat},${lon});nwr["man_made"="pier"](around:8000,${lat},${lon}););out center 40;`;
  let j = null;
  for (const u of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]){
    try { const r = await fetch(u, {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"}, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(9000)}); if (r.ok){ j = await r.json(); break; } } catch {}
  }
  if (!j) throw new Error("overpass");
  const rad = Math.PI / 180, dist = (a, b) => 6371 * Math.acos(Math.min(1, Math.sin(lat * rad) * Math.sin(a * rad) + Math.cos(lat * rad) * Math.cos(a * rad) * Math.cos((b - lon) * rad)));
  const res = j.elements.map(x => {
    const la = x.lat ?? x.center?.lat, lo = x.lon ?? x.center?.lon; if (la == null) return null;
    const t = x.tags || {};
    return {la, lo, d: dist(la, lo), tipo: t.leisure === "slipway" ? "Rampa" : t.leisure === "fishing" ? "Puesto de pesca" : "Embarcadero", nombre: t.name || ""};
  }).filter(Boolean).sort((a, b) => a.d - b.d).slice(0, 8);
  rampasCache.set(k, res);
  return res;
}
function rampasHtml(r){
  if (!r.length) return `<p class="src" style="margin:0">No hay rampas ni puestos de pesca marcados en OpenStreetMap cerca de este punto. Eso no significa que no existan: mira el mapa de satélite en la pestaña Mapa.</p>`;
  return `<ul class="rampas">${r.map(x => `<li><a target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${x.la},${x.lo}"><b>${x.tipo}${x.nombre ? " · " + esc(x.nombre) : ""}</b><span>${fmt(x.d, 1)} km</span></a></li>`).join("")}</ul>
    <p class="src">Datos de <a href="https://www.openstreetmap.org" target="_blank" rel="noopener">OpenStreetMap</a>, que pueden estar incompletos o desfasados. Distancias desde el punto del embalse.</p>`;
}
const FICHAS = window.FICHAS || {}; // data/fichas.js: datos prácticos escritos a mano por embalse
function practicoHtml(e){
  const f = FICHAS[e.id] || {};
  const filas = [["Permiso", f.permiso], ["Coto o veda", f.coto], ["Rampa", f.rampa], ["Normativa", f.normativa], ["Notas", f.notas]].filter(x => x[1]);
  return `<h4>Antes de salir</h4><div class="practico">
    ${filas.length ? `<dl>${filas.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>${f.fuente ? `<p class="src" style="margin:6px 0 0">Fuente: ${esc(f.fuente)}</p>` : ""}` : ""}
    <p>Necesitas la <b>licencia de pesca de la comunidad autónoma</b> donde pescas (suele valer solo en esa comunidad). Cada tramo puede tener cotos, vedas, tallas y épocas propias, y algunas especies exigen normas especiales: confírmalo en la web oficial de tu comunidad y de la confederación del embalse antes de ir.</p></div>`;
}

let fichaId = null;
const SITE = "https://levelbass.es/";
const baseCanon = document.querySelector('link[rel="canonical"]').href, baseOg = document.querySelector('meta[property="og:title"]').content, baseTitle = document.title, baseDesc = document.querySelector('meta[name="description"]').content;
const slugs = new Map(), idPorSlug = new Map();
function initSlugs(){
  const sl = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  slugs.clear(); idPorSlug.clear();
  for (const e of all){
    let s = sl(e.nombre) || "embalse";
    if (idPorSlug.has(s)) s += "-" + e.id;
    slugs.set(e.id, s); idPorSlug.set(s, e.id);
  }
}
function metaFicha(e){
  const L = lvl(e), t = `${e.nombre} · nivel del embalse | LevelBass`;
  const d = `${e.nombre} (${e.cuenca}): ${fmt(L.pct,1)} % de capacidad, ${fmt(L.vol, e.vivo?2:0)} de ${fmt(e.capacidad)} hm³. Tiempo, presión, viento y luna para pescar black bass.`;
  const url = SITE + "e/" + slugs.get(e.id) + "/";
  document.title = t;
  const set = (sel, v) => { const n = document.querySelector(sel); if (n) n.setAttribute(n.tagName === "LINK" ? "href" : "content", v); };
  set('meta[name="description"]', d); set('meta[property="og:title"]', t); set('meta[property="og:description"]', d); set('meta[property="og:url"]', url);
  set('meta[name="twitter:title"]', t); set('meta[name="twitter:description"]', d); set('link[rel="canonical"]', SITE);
}
function metaBase(){
  document.title = baseTitle;
  const set = (sel, v) => { const n = document.querySelector(sel); if (n) n.setAttribute(n.tagName === "LINK" ? "href" : "content", v); };
  set('meta[name="description"]', baseDesc); set('meta[property="og:title"]', baseOg);
  set('meta[property="og:description"]', baseDesc); set('meta[property="og:url"]', baseCanon);
  set('meta[name="twitter:title"]', baseOg); set('meta[name="twitter:description"]', baseDesc); set('link[rel="canonical"]', baseCanon);
}
// Tabla solunar, Embalses y Confinados son páginas propias (/solunar/, /embalses/, /confinados/): cada una es un index.html
// con <body data-page=...> que solo muestra su sección. Desde la portada, la búsqueda lleva a /embalses/ con los filtros en la URL.
function irLista(){
  const u = new URLSearchParams(), q = $("#q").value.trim(), c = $("#cuenca").value;
  if (q) u.set("q", q); if (c) u.set("c", c);
  location.href = "/embalses/" + (u.toString() ? "?" + u : "");
}
function filtrosDeLaUrl(){
  if (document.body.dataset.page !== "lista") return;
  const u = new URLSearchParams(location.search);
  if (u.get("q")) $("#q").value = u.get("q");
  if (u.get("c") && [...$("#cuenca").options].some(o => o.value === u.get("c"))) $("#cuenca").value = u.get("c");
}
function routeFromHash(){
  const fv = location.hash.match(/^#\/favs=([0-9.]+)/);
  if (fv){ ofrecerFavs(fv[1].split(".").map(Number).filter(Boolean)); return; }
  const m = location.hash.match(/^#\/embalse\/([^/?]+)/);
  if (m){ const id = idPorSlug.get(decodeURIComponent(m[1])); if (id != null && id !== fichaId) openDetail(id, true); }
  else if (fichaId != null) closeDetail(true);
}
async function openDetail(id, deHash){
  const e = all.find(x => x.id === id); if (!e) return;
  fichaId = id;
  metaFicha(e);
  if (!deHash && slugs.get(id)) history.pushState({ficha:true}, "", "#/embalse/" + slugs.get(id));
  const L0 = lvl(e), col = hex(L0.pct), tiene = e.lat != null;
  const f = e.fecha ? new Date(e.fecha + "T00:00").toLocaleDateString("es-ES", {day:"numeric", month:"long", year:"numeric"}) : "";
  const [la, lo] = tiene ? [e.lat, e.lon] : MADRID;
  const sol0 = solunar(new Date(), la, lo);

  let res = confAviso(e) + `<div class="big"><b style="color:${col}">${fmt(L0.pct,1)} %</b><div class="tank"><i class="${lvlClass(L0.pct)}" style="width:${Math.min(L0.pct,100)}%"></i></div></div>
    <div class="stats">
      ${stat("Volumen", fmt(L0.vol, e.vivo?2:0)+" hm³", e.vivo?"lectura en directo":"boletín semanal")}
      ${stat("Capacidad", fmt(e.capacidad)+" hm³")}
      ${stat("Libre", fmt(Math.max(e.capacidad - L0.vol,0),1)+" hm³", "hasta llenarse")}
      ${e.extra
        ? stat("Estado", "Solo en directo", "no está en el boletín semanal")
        : stat("Vs. semana ant.", `<span class="${e.variacion_hm3>0?'up':e.variacion_hm3<0?'down':''}">${e.variacion_hm3>0?'+':''}${fmt(e.variacion_hm3,1)} hm³</span>`, f)}
    </div>` + tendHtml(e) + '<div id="p-agua"></div><div id="p-mejor"></div>';
  if (e.vivo){
    const v = e.vivo;
    res += `<h4><span class="live">● ${v.diario ? "Dato diario" : "En directo"}</span> &nbsp;· ${esc(v.fuente)} · ${fdv(e)}</h4>
    ${v.cota != null || v.entrada != null || v.salida != null ? `<div class="stats">
      ${stat("Cota", v.cota!=null?fmt(v.cota,2)+" m":"–", v.cota_aliviadero!=null?"cota máxima "+fmt(v.cota_aliviadero,2)+" m":"")}
      ${stat("Entrada", v.entrada!=null?fmt(v.entrada,2)+" m³/s":"–", "caudal recibido")}
      ${stat("Salida", v.salida!=null?fmt(v.salida,2)+" m³/s":"–", "caudal desembalsado")}
    </div>` : ""}`;
    const pts = (v.historial||[]).map(([t,x]) => [new Date(t).getTime(), x]);
    if (pts.length > 1) res += `<div class="chart"><small>Volumen en directo, últimos días</small>${spark(pts, 600, 110, "#f0c874")}</div>`;
    res += `<p class="src"><a href="${esc(v.url)}" target="_blank" rel="noopener">Ver en el SAIH oficial ↗</a></p>`;
  }
  if (!e.extra) res += `<div class="chart" id="hist"><small>Volumen semanal, último año frente al anterior</small><div class="empty" style="padding:16px">Cargando histórico…</div></div>`;
  if (tiene) res += `<div class="goto"><a class="btn-go" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lon}">${ico("pin")} Cómo llegar</a><a class="btn-go alt" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lon}">Ver en Google Maps ↗</a></div><p class="src">Coordenadas ${e.lat}, ${e.lon}</p>`;
  if (tiene) res += `<h4>Rampas y accesos cercanos</h4><div id="p-rampas"><div class="empty" style="padding:12px">Buscando…</div></div>`;
  res += practicoHtml(e) + `<div id="p-alert">${alertasHtml(id)}</div>`;

  const sinCoord = '<div class="empty">Este embalse no tiene coordenadas en los datos oficiales, así que no se puede mostrar esta sección.</div>';
  const h = `<button class="x" data-close aria-label="Cerrar">×</button>
    <button class="share-big" data-share="${id}" aria-label="Compartir este embalse">Compartir</button>
    <button class="fav-big ${favs.has(id)?'on':''}" data-fav="${id}" aria-label="Favorito">${favs.has(id)?'★ Favorito':'☆ Guardar'}</button>
    <h2>${esc(e.nombre)}</h2>
    <div class="sub">${esc(e.cuenca)}${e.uso?" · uso "+esc(e.uso.toLowerCase()):""}${e.electrico?" · hidroeléctrico":""}</div>
    <div class="badges">${badges(e, L0)}</div>
    <div class="q4">
      <div class="q"><small>${ico("wave")} Nivel</small><b style="color:${col}">${fmt(L0.pct,0)} %</b><span>${e.vivo?"en directo":"semanal"}</span></div>
      <div class="q" id="q-viento"><small>${ico("wind")} Viento</small><b>–</b><span>cargando…</span></div>
      <div class="q"><small>${ico("moon")} Luna</small><b>${lunaSvg(sol0.fase, 28)}</b><span>${sol0.nombre}</span></div>
      <div class="q" id="q-tiempo"><small>${ico("cloudsun")} Tiempo</small><b>–</b><span>cargando…</span></div>
      <div class="q" id="q-presion"><small>${ico("wave")} Presión</small><b>–</b><span>cargando…</span></div>
    </div>
    <div class="tabs" role="tablist">
      <button class="on" data-tab="res">Resumen</button><button data-tab="wx">Tiempo</button><button data-tab="wind">Viento</button><button data-tab="moon">Luna</button><button data-tab="topo">Mapa</button>
    </div>
    <section class="pane on" data-pane="res">${res}</section>
    <section class="pane" data-pane="wx" id="p-wx">${tiene ? '<div class="empty">Cargando el tiempo…</div>' : sinCoord}</section>
    <section class="pane" data-pane="wind" id="p-wind">${tiene ? '<div class="empty">Cargando el viento…</div>' : sinCoord}</section>
    <section class="pane" data-pane="moon">${lunaHtml(la, lo)}</section>
    <section class="pane" data-pane="topo">${tiene ? `<div id="tmap"></div>
      <div class="hist"><label>Imagen de otra época <select id="histsel" aria-label="Imagen histórica">${histOpciones()}</select></label>
        <label class="hrange"><span>Actual</span><input type="range" id="histop" min="0" max="100" value="100" disabled aria-label="Mezcla entre la imagen actual y la histórica"><span>Histórica</span></label></div>
      <p class="src">Elige una fecha y desliza para comparar con la imagen actual. Cada año del IGN cubre solo algunas zonas: si ves la imagen actual debajo, ese año no hay foto aquí, prueba otro. Con el embalse bajo (por ejemplo 2022-2023) se ven puntas, islas y antiguos cauces; las fotos de 1956 a 1986 enseñan el terreno antes de que se inundara. Capas: satélite, topográfica (OpenTopoMap), fotos aéreas del IGN y satélite por año de Esri.</p>
      <div class="goto"><a class="btn-go alt" target="_blank" rel="noopener" href="https://earth.google.com/web/@${e.lat},${e.lon},400a,6000d,35y,0h,0t,0r">Abrir en Google Earth ↗</a></div>
      <p class="src">En Google Earth Pro (gratis, para ordenador) tienes además la regla del tiempo con todas las imágenes antiguas.</p>` : sinCoord}</section>`;
  $("#modal .sheet").innerHTML = h;
  $("#modal").classList.add("open"); document.body.style.overflow = "hidden";
  $("#modal").scrollTop = 0;
  if (map && tiene){ map.setView([e.lat,e.lon], 10); markers.get(e.id)?.openPopup(); }

  // Pestañas
  $("#modal .tabs").onclick = (ev) => {
    const b = ev.target.closest("[data-tab]"); if (!b) return;
    document.querySelectorAll("#modal .tabs button").forEach(x => x.classList.toggle("on", x === b));
    document.querySelectorAll("#modal .pane").forEach(p => p.classList.toggle("on", p.dataset.pane === b.dataset.tab));
    if (b.dataset.tab === "topo") topoMapa(e);
  };

  // Tiempo y viento (Open-Meteo)
  if (tiene) getWx(e.lat, e.lon).then(w => {
    if (fichaId !== id) return;
    const c = w.current, ic = wmo(c.weather_code), pr = presion(w);
    $("#q-viento").innerHTML = `<small>${ico("wind")} Viento</small><b>${fmt(c.wind_speed_10m,0)} <i>km/h</i></b><span>${dirTxt(c.wind_direction_10m)} · rachas ${fmt(c.wind_gusts_10m,0)}</span>`;
    $("#q-tiempo").innerHTML = `<small>${ico(ic.i)} Tiempo</small><b>${fmt(c.temperature_2m,0)}°</b><span>${ic.t} · ${fmt(pr.hpa,0)} hPa</span>`;
    $("#q-presion").innerHTML = `<small>${ico("wave")} Presión</small><b>${fmt(pr.hpa,0)} <i>hPa</i></b><span class="${pr.cls||""}">${pr.dif == null ? "sin tendencia" : (pr.dif >= 0 ? "+" : "") + fmt(pr.dif,1) + " en 3 h · " + pr.txt}</span>`;
    $("#p-wx").innerHTML = wxHtml(w);
    $("#p-wind").innerHTML = vientoHtml(w, e.lat, e.lon);
    try { const sem = mejorSemana(w, e.lat, e.lon); mejorCache.set(id, sem); $("#p-mejor").innerHTML = mejorHtml(sem); pintaMejorFav(id); } catch (err) { console.warn("mejor día", err); }
  }).catch(() => {
    if (fichaId !== id) return;
    $("#q-viento").innerHTML = `<small>${ico("wind")} Viento</small><b>–</b><span>sin datos</span>`;
    $("#q-tiempo").innerHTML = `<small>${ico("cloudsun")} Tiempo</small><b>–</b><span>sin datos</span>`;
    $("#q-presion").innerHTML = `<small>${ico("wave")} Presión</small><b>–</b><span>sin datos</span>`;
    $("#p-wx").innerHTML = $("#p-wind").innerHTML = '<div class="empty">No se pudo cargar el tiempo ahora mismo.</div>';
  });

  if (tiene){
    getTemps(e.lat, e.lon).then(j => { if (fichaId === id && $("#p-agua")) $("#p-agua").innerHTML = aguaHtml(aguaEstimada(j)); }).catch(() => {});
    buscaRampas(e.lat, e.lon).then(r => { if (fichaId === id && $("#p-rampas")) $("#p-rampas").innerHTML = rampasHtml(r); })
      .catch(() => { if (fichaId === id && $("#p-rampas")) $("#p-rampas").innerHTML = '<p class="src" style="margin:0">Ahora mismo no se pueden consultar las rampas (el servicio de OpenStreetMap está saturado). Mira el mapa de satélite en la pestaña Mapa.</p>'; });
  }

  // Histórico semanal desde el servicio del Ministerio (se consulta en el momento)
  if (e.extra) return;
  try {
    const desde = Date.now() - 2 * 366 * 864e5;
    const q = new URLSearchParams({where:`EMBALSE_ID=${e.id} AND fecha>=timestamp '${new Date(desde).toISOString().slice(0,10)} 00:00:00'`, outFields:"fecha,agua_actual", orderByFields:"fecha ASC", f:"json"});
    const j = await (await fetch(`${SERV}?${q}`)).json();
    const rows = (j.features||[]).map(x => [x.attributes.fecha, x.attributes.agua_actual]).filter(r => r[1] != null);
    const box = $("#hist"); if (!box || !$("#modal").classList.contains("open")) return;
    const ahora = rows.length ? rows[rows.length-1][0] : Date.now();
    const cur = rows.filter(r => r[0] > ahora - 366*864e5);
    const prev = rows.filter(r => r[0] <= ahora - 366*864e5).map(r => [r[0] + 366*864e5, r[1]]);
    const all2 = [...cur, ...prev], y0 = Math.min(...all2.map(r=>r[1])), y1 = Math.max(...all2.map(r=>r[1]));
    const w = 600, hh = 150, x0 = ahora - 366*864e5, X = x => (x-x0)/(ahora-x0)*(w-8)+4, Y = y => hh-6-(y-y0)/((y1-y0)||1)*(hh-14);
    const path = a => a.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join("");
    const hace = prev.length ? prev[prev.length-1][1] : null;
    box.innerHTML = `<small>Volumen semanal (hm³): <span style="color:#f0c874">■</span> último año · <span style="color:#8fb1bd">■</span> año anterior</small>
      <svg viewBox="0 0 ${w} ${hh}" width="100%" height="${hh}" preserveAspectRatio="none">
        <path d="${path(prev)}" fill="none" stroke="#8fb1bd" stroke-width="1.8" opacity=".8"/>
        <path d="${path(cur)}" fill="none" stroke="#f0c874" stroke-width="2.4" stroke-linejoin="round"/></svg>
      <div class="axis"><span>mín. ${fmt(y0)} hm³</span><span>${hace!=null?"hace un año: "+fmt(hace)+" hm³":""}</span><span>máx. ${fmt(y1)} hm³</span></div>`;
  } catch { const b = $("#hist"); if (b) b.innerHTML = '<small>Volumen semanal</small><div class="empty" style="padding:16px">No se pudo cargar el histórico.</div>'; }
}
function closeDetail(deHash){
  if (!deHash && /^#\/embalse\//.test(location.hash)){
    if (history.state && history.state.ficha) history.back(); else history.replaceState(null, "", location.pathname + location.search);
  }
  metaBase();
  $("#modal").classList.remove("open"); document.body.style.overflow = ""; fichaId = null;
  if (tmap){ tmap.remove(); tmap = null; }
  $("#modal .sheet").innerHTML = ""; // también detiene el mapa de viento incrustado
}

/* ---------- Fotos: cinta decorativa ---------- */
const nn = (i) => String(i).padStart(2, "0");
// Solo se muestran fotos de peces solos o del barco (sin personas)
const FOTOS = [17, 18, 20, 21, 26, 30, 34];
function initFotos(){
  // Con pocas fotos la cinta se repite varias veces para que el bucle no deje huecos
  const cinta = FOTOS.map(i => `<img loading="lazy" decoding="async" src="/img/t/f${nn(i)}.webp" alt="" width="210" height="280">`).join("");
  const mitad = cinta + cinta;
  const cintaEl = $("#ribbon");
  if (cintaEl) cintaEl.innerHTML = mitad + mitad;
}

// ================= TABLA SOLUNAR =================
// Zona elegida: "centro" (Madrid) o el id de un embalse con coordenadas
function zonaSolunar(){
  const v = $("#solzona")?.value;
  const e = v && v !== "centro" ? all.find(x => x.id === +v) : null;
  return e ? {lat: e.lat, lon: e.lon, nombre: e.nombre} : {lat: MADRID[0], lon: MADRID[1], nombre: "centro de España"};
}
const dia0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const VEREDICTO = ["", "Floja", "Normal", "Buena", "Muy buena", "Excelente"];
const larga = (d) => d.toLocaleDateString("es-ES", {weekday:"long", day:"numeric", month:"long"});
const lapso = (m) => m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;

let solFecha = dia0(new Date()), calMes = new Date(solFecha.getFullYear(), solFecha.getMonth(), 1);

// Próximas lunas nuevas y llenas (aprox. al día)
function proximasLunas(desde){
  const out = {nueva: null, llena: null};
  let prev = SunCalc.getMoonIllumination(new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 12)).phase;
  for (let i = 1; i <= 40 && (!out.nueva || !out.llena); i++){
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i, 12), p = SunCalc.getMoonIllumination(d).phase;
    if (p < prev && !out.nueva) out.nueva = d;
    if (prev < 0.5 && p >= 0.5 && !out.llena) out.llena = d;
    prev = p;
  }
  return out;
}

function lineaDiaPro(s, ahoraMin){
  const seg = s.per.map(p => {
    const ini = Math.max(0, p.ini), fin = Math.min(1440, p.fin);
    return `<i class="${p.t}" style="left:${ini / 14.4}%;width:${(fin - ini) / 14.4}%" title="${p.n} ${hhmm(ini)}–${hhmm(fin)}"><em>${p.k}</em></i>`;
  }).join("");
  const sol = [[s.orto, "Amanecer", "sun"], [s.ocaso, "Atardecer", "sun"]].filter(x => x[0] != null)
    .map(([m, n]) => `<b class="${n === "Amanecer" ? "am" : "at"}" style="left:${m / 14.4}%" title="${n} ${hhmm(m)}"></b>`).join("");
  const now = ahoraMin != null ? `<u class="ahora" style="left:${ahoraMin / 14.4}%" title="Ahora ${hhmm(ahoraMin)}"></u>` : "";
  return `<div class="dia pro"><div class="bar24">${seg}${sol}${now}</div><div class="ticks"><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span></div>
    <div class="leyenda"><span><i class="mayor"></i>Mayor (M)</span><span><i class="menor"></i>Menor (m)</span><span><i class="sol"></i>Amanecer / atardecer</span>${ahoraMin != null ? '<span><i class="now"></i>Ahora</span>' : ""}</div></div>`;
}

function renderHoy(){
  try {
    const z = zonaSolunar(), ahora = new Date(), esHoy = mismoDia(solFecha, ahora);
    const s = solunar(solFecha, z.lat, z.lon), min = ahora.getHours() * 60 + ahora.getMinutes();
    const activo = esHoy ? s.per.find(p => min >= p.ini && min <= p.fin) : null;
    const sig = esHoy ? s.per.find(p => p.ini > min) : null;
    const mejor = [...s.per].sort((a, b) => (a.t === "mayor" ? 0 : 1) - (b.t === "mayor" ? 0 : 1) || a.c - b.c)
      .find(p => p.t === "mayor" && [s.orto, s.ocaso].some(x => x != null && Math.abs(x - p.c) <= 90)) || s.per.find(p => p.t === "mayor");
    const lun = proximasLunas(solFecha);
    const enDias = (d) => { const n = Math.round((dia0(d) - dia0(solFecha)) / 864e5); return n === 1 ? "mañana" : `en ${n} días`; };
    const fechaCorta = (d) => d.toLocaleDateString("es-ES", {weekday:"short", day:"numeric", month:"short"});

    $("#hoy").innerHTML = `
      <div class="soltop">
        <div class="moonglow">${lunaSvg(s.fase, 96)}</div>
        <div class="solinfo">
          <small class="cap">${larga(solFecha)}${esHoy ? " · hoy" : ""} · ${esc(z.nombre)}</small>
          <h3>${s.nombre}</h3>
          <div class="chips2"><span>${fmt(s.fraccion * 100, 0)} % iluminada</span><span>${fmt(s.edad, 1)} días de edad</span></div>
          <div class="rate"><span class="est big">${estrellas(s.estrellas)}</span><b>${s.estrellas}/5</b><em class="v${s.estrellas}">${VEREDICTO[s.estrellas]}</em></div>
          <div class="meter" title="Índice de actividad"><i style="width:${s.estrellas * 20}%"></i></div>
        </div>
        <div class="solnow">
          ${esHoy ? (activo
            ? `<div class="estado on"><small>Ahora</small><b>Periodo ${activo.t === "mayor" ? "mayor" : "menor"} (${activo.k})</b><span>termina en ${lapso(Math.max(1, Math.round(activo.fin - min)))}</span></div>`
            : sig ? `<div class="estado"><small>Próximo periodo</small><b>${sig.k} · ${hhmm(sig.ini)}</b><span>empieza en ${lapso(Math.round(sig.ini - min))}</span></div>`
              : `<div class="estado"><small>Hoy</small><b>Sin más periodos</b><span>mira mañana</span></div>`) : ""}
          ${mejor ? `<div class="estado best"><small>Mejor ventana del día</small><b>${mejor.k} · ${hhmm(Math.max(0, mejor.ini))}–${hhmm(Math.min(1440, mejor.fin))}</b><span>${mejor.n}${[s.orto, s.ocaso].some(x => x != null && Math.abs(x - mejor.c) <= 90) ? " · junto al amanecer o atardecer" : ""}</span></div>` : ""}
        </div>
      </div>
      <ul class="why">${s.razones.map(r => `<li>${r}</li>`).join("")}</ul>
      <div class="sunmoon">
        <div><small>Amanecer</small><b>${s.orto != null ? hhmm(s.orto) : "–"}</b></div>
        <div><small>Atardecer</small><b>${s.ocaso != null ? hhmm(s.ocaso) : "–"}</b></div>
        <div><small>Sale la luna</small><b>${s.sal != null ? hhmm(s.sal) : "–"}</b></div>
        <div><small>Se pone la luna</small><b>${s.pue != null ? hhmm(s.pue) : "–"}</b></div>
      </div>
      ${lineaDiaPro(s, esHoy ? min : null)}
      <ul class="per">${s.per.map(p => `<li class="${p.t}"><span><b class="k">${p.k}</b> ${p.t === "mayor" ? "Mayor" : "Menor"} · ${p.n}</span><b>${hhmm(Math.max(0, p.ini))}–${hhmm(Math.min(1440, p.fin))}</b></li>`).join("")}</ul>
      <p class="proxl">${lun.llena ? `${lunaSvg(0.5, 18)} Próxima luna llena: <b>${fechaCorta(lun.llena)}</b> (${enDias(lun.llena)})` : ""}${lun.nueva ? ` &nbsp;·&nbsp; ${lunaSvg(0, 18)} Próxima luna nueva: <b>${fechaCorta(lun.nueva)}</b> (${enDias(lun.nueva)})` : ""}</p>`;

    $("#soldate").value = isoLocal(solFecha);
    $("#solhoy").disabled = esHoy;
    // Calendario, mejores días y tabla (muchos cálculos): solo cuando el visitante llega a la sección
    const extras = () => { calendarioSolunar(z); mejoresDias(z); tablaSolunar(z); };
    if (solVisto) extras(); else solPendiente = extras;
  } catch (err) { console.error(err); $("#solunar").hidden = true; }
}
let solVisto = false, solPendiente = null;
alVer("#solunar", () => { solVisto = true; if (solPendiente){ const f = solPendiente; solPendiente = null; enReposo(f); } }, "500px");

// Calendario del mes: luna y estrellas de cada día; se pulsa un día para verlo
function calendarioSolunar(z){
  const y = calMes.getFullYear(), m = calMes.getMonth(), hoy = dia0(new Date());
  const primero = new Date(y, m, 1), huecos = (primero.getDay() + 6) % 7, nDias = new Date(y, m + 1, 0).getDate();
  const celdas = Array.from({length: huecos}, () => '<span class="vacio"></span>');
  for (let d = 1; d <= nDias; d++){
    const f = new Date(y, m, d), s = solunar(f, z.lat, z.lon);
    const cl = ["dd", s.estrellas >= 4 ? "best" : "", mismoDia(f, hoy) ? "esh" : "", mismoDia(f, solFecha) ? "sel" : ""].join(" ");
    celdas.push(`<button class="${cl}" data-dia="${isoLocal(f)}" title="${larga(f)} · ${s.nombre} · actividad ${s.estrellas}/5"><b>${d}</b>${lunaSvg(s.fase, 24)}<span>${"★".repeat(s.estrellas)}</span></button>`);
  }
  $("#solcal").innerHTML = `<div class="calhead"><button data-mes="-1" aria-label="Mes anterior">‹</button><b>${calMes.toLocaleDateString("es-ES", {month:"long", year:"numeric"})}</b><button data-mes="1" aria-label="Mes siguiente">›</button></div>
    <div class="calgrid"><span class="dow">L</span><span class="dow">M</span><span class="dow">X</span><span class="dow">J</span><span class="dow">V</span><span class="dow">S</span><span class="dow">D</span>${celdas.join("")}</div>
    <p class="src">Los días con borde dorado tienen una actividad estimada de 4 o 5 estrellas.</p>`;
}

// Los mejores días de los próximos 30
function mejoresDias(z){
  const hoy = dia0(new Date()), lista = [];
  for (let i = 0; i < 30; i++){ const f = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i); lista.push({f, s: solunar(f, z.lat, z.lon), i}); }
  const top = lista.sort((a, b) => b.s.estrellas - a.s.estrellas || a.i - b.i).slice(0, 4).sort((a, b) => a.i - b.i);
  $("#solbest").innerHTML = `<small class="cap">Mejores días de los próximos 30</small><div class="bestrow">${top.map(({f, s}) =>
    `<button data-dia="${isoLocal(f)}">${lunaSvg(s.fase, 30)}<span><b>${f.toLocaleDateString("es-ES", {weekday:"short", day:"numeric", month:"short"})}</b><em>${"★".repeat(s.estrellas)} ${VEREDICTO[s.estrellas]}</em></span></button>`).join("")}</div>`;
}

// Tabla de los 7 días a partir del día elegido
function tablaSolunar(z){
  const filas = [];
  for (let i = 0; i < 7; i++){
    const f = new Date(solFecha.getFullYear(), solFecha.getMonth(), solFecha.getDate() + i), s = solunar(f, z.lat, z.lon);
    const t = (k) => { const p = s.per.find(x => x.k === k); return p ? hhmm(Math.max(0, p.ini)) + "–" + hhmm(Math.min(1440, p.fin)) : "–"; };
    filas.push(`<tr class="${i === 0 ? "diahoy" : ""}${s.estrellas >= 4 ? " top" : ""}" data-dia="${isoLocal(f)}"><td><div class="ph">${lunaSvg(s.fase, 34)}<div><b>${f.toLocaleDateString("es-ES", {weekday:"long", day:"numeric", month:"short"})}</b><span>${s.nombre} · ${fmt(s.fraccion * 100, 0)} %</span></div></div></td>
      <td class="M">${t("M1")}</td><td class="M">${t("M2")}</td><td class="m">${t("m1")}</td><td class="m">${t("m2")}</td>
      <td>${s.orto != null ? hhmm(s.orto) : "–"} · ${s.ocaso != null ? hhmm(s.ocaso) : "–"}</td>
      <td class="est">${estrellas(s.estrellas)}<span class="vv">${VEREDICTO[s.estrellas]}</span></td></tr>`);
  }
  $("#soltabla").innerHTML = `<thead><tr><th>Día</th><th>M1 · mayor</th><th>M2 · mayor</th><th>m1 · menor</th><th>m2 · menor</th><th>Sol (sale · se pone)</th><th>Actividad</th></tr></thead><tbody>${filas.join("")}</tbody>`;
}

// Controles: zona, día anterior/siguiente, selector de fecha, mes del calendario y clic en un día
function initSolunar(){
  $("#solzona").addEventListener("input", renderHoy);
  const ir = (f) => { solFecha = dia0(f); calMes = new Date(solFecha.getFullYear(), solFecha.getMonth(), 1); renderHoy(); };
  $("#solprev").onclick = () => ir(new Date(solFecha.getFullYear(), solFecha.getMonth(), solFecha.getDate() - 1));
  $("#solnext").onclick = () => ir(new Date(solFecha.getFullYear(), solFecha.getMonth(), solFecha.getDate() + 1));
  $("#solhoy").onclick = () => ir(new Date());
  $("#soldate").addEventListener("input", (ev) => { if (ev.target.value) ir(new Date(ev.target.value + "T12:00")); });
  $("#solunar").addEventListener("click", (ev) => {
    const mes = ev.target.closest("[data-mes]");
    if (mes){ calMes = new Date(calMes.getFullYear(), calMes.getMonth() + +mes.dataset.mes, 1); renderHoy(); return; }
    const d = ev.target.closest("[data-dia]");
    if (d){ solFecha = new Date(d.dataset.dia + "T12:00"); solFecha = dia0(solFecha); calMes = new Date(solFecha.getFullYear(), solFecha.getMonth(), 1); renderHoy(); $("#hoy").scrollIntoView({behavior:"smooth", block:"nearest"}); }
  });
}

function initHoy(){
  // Menú: resalta la sección en la que estás
  const links = [...document.querySelectorAll("#tblinks a")], secs = links.map(a => a.getAttribute("href").startsWith("#") ? document.querySelector(a.getAttribute("href")) : null), RUTAS = {solunar: "/solunar/", lista: "/embalses/", confinados: "/confinados/"};
  const spy = () => {
    let k = -1;
    if (document.body.dataset.page) k = links.findIndex(a => a.getAttribute("href") === RUTAS[document.body.dataset.page]);
    else secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= 120) k = i; });
    links.forEach((a, i) => a.classList.toggle("on", i === k));
    // Centra el enlace activo dentro de la propia barra. No se usa scrollIntoView: con la barra "sticky"
    // el navegador intentaba llevar la página arriba del todo y la subía sola al hacer scroll.
    const caja = $("#tblinks"), a = links[k];
    if (a && caja.scrollWidth > caja.clientWidth){
      const objetivo = a.offsetLeft - (caja.clientWidth - a.offsetWidth) / 2;
      if (Math.abs(caja.scrollLeft - objetivo) > 4) caja.scrollLeft = objetivo;
    }
  };
  addEventListener("scroll", spy, {passive:true}); spy();
  setInterval(() => { if (all.length) renderHoy(); }, 60 * 1000); // el solunar se refresca solo

  const url = "https://embed.windy.com/embed2.html?lat=40.2&lon=-3.7&detailLat=40.2&detailLon=-3.7&zoom=6&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=&calendar=now&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1";
  // El mapa de viento es de un tercero (Windy): solo se carga cuando el visitante lo pide, así no se mandan datos antes de tiempo
  const box = $("#windbox");
  box.innerHTML = `<div class="windask"><svg class="i" aria-hidden="true"><use href="#i-wind"/></svg><p>Mapa de viento en tiempo real de <b>Windy.com</b></p><button type="button" id="windgo">Ver el mapa de viento</button><small>Al pulsar se carga contenido de windy.com</small></div>`;
  $("#windgo").addEventListener("click", () => { box.innerHTML = `<iframe title="Mapa de viento Windy" src="${url}" allowfullscreen></iframe>`; });
}

function pintaStamp(d){
  const f = new Date(d.fecha_boletin + "T00:00").toLocaleDateString("es-ES", {day:"numeric", month:"long", year:"numeric"});
  const act = new Date(d.actualizado).toLocaleString("es-ES", {dateStyle:"medium", timeStyle:"short"});
  const h = (Date.now() - new Date(d.actualizado)) / 36e5, cl = h > 6 ? "old" : h > 2 ? "mid" : "";
  $("#stamp").innerHTML = `<span class="pill">Boletín semanal del <b>${f}</b></span><span class="pill ${cl}" title="Última vez que la web consultó las fuentes">Comprobado <b>${act}</b>${h > 2 ? ` · hace ${Math.round(h)} h` : ""}</span><span class="pill"><b>${all.filter(e => e.vivo).length}</b> embalses en directo</span>`;
}
// El SAIH del Ebro no responde desde los servidores de GitHub, pero sí permite leerlo desde el navegador del visitante
let ebroDatos = null;
const normN = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\bembalse\b|\bpantano\b/g, "").replace(/\b(de|del|la|las|el|los|l|d)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
function aplicaEbro(){
  if (!ebroDatos) return false;
  const por = new Map(all.filter(e => e.cuenca === "Ebro" && (!e.vivo || e.vivo.fuente === "SAIH Ebro")).map(e => [normN(e.nombre), e]));
  let n = 0;
  for (const x of ebroDatos){
    const e = por.get(normN(x.nombre)); if (!e) continue;
    e.vivo = {fuente: "SAIH Ebro", volumen: x.volumen, nmn: x.nmn, porcentaje: x.porcentaje, cota: null, cota_aliviadero: null, entrada: null, salida: null, fecha: x.fecha, url: x.url, diario: true, var24h: null, historial: []};
    n++;
  }
  return n > 0;
}
async function cargarEbro(){
  try {
    const j = await (await fetch("https://www.saihebro.com/api/principal/getVolumenesEmbalsados", {signal: AbortSignal.timeout(10000)})).json();
    ebroDatos = Object.entries(j.volumenes || {}).filter(([k, v]) => /^E\d+$/.test(k) && v.fechaAnsi).map(([k, v]) => {
      const a = v.data?.[1], vol = parseFloat(a?.volumen), pct = a?.y;
      return vol >= 0 && pct > 0 ? {nombre: v.zona, volumen: vol, porcentaje: pct, nmn: Math.round(vol / pct * 1000) / 10, fecha: v.fechaAnsi + "T00:00", url: "https://www.saihebro.com/info/volumenes-embalsados-embalse-" + k} : null;
    }).filter(Boolean);
    if (aplicaEbro()){
      pintaStamp(window.EMBALSES_DATA); render(); revisarAlertas();
      // si llegaron directos a la ficha de un embalse del Ebro, se rehace con el dato nuevo
      const abierto = all.find(x => x.id === fichaId);
      if (abierto && abierto.cuenca === "Ebro" && !$("#modal").dataset.ebro){ $("#modal").dataset.ebro = "1"; openDetail(fichaId, true); }
    }
  } catch {}
}
// Con la web abierta se vuelven a pedir los datos cada 10 minutos (sin recargar la página)
async function refrescarDatos(){
  if (document.hidden || $("#modal").classList.contains("open")) return;
  try {
    const d = await (await fetch("/data/embalses.json?" + Date.now())).json();
    // Si hay una versión nueva de la web, se ofrece cargarla (el navegador a veces conserva la antigua)
    const mia = document.querySelector('meta[name="lb-version"]')?.content;
    if (d.version && mia && d.version !== mia && !$("#toast.on")) toast("Hay una versión nueva de LevelBass.", 0, [{t: "Actualizar", f: () => { location.href = location.pathname + "?r=" + Date.now(); }}, {t: "Luego", f: () => {}}]);
    if (!d.embalses?.length || d.actualizado === window.EMBALSES_DATA?.actualizado) { pintaStamp(window.EMBALSES_DATA || d); return; }
    window.EMBALSES_DATA = d; all = d.embalses; aplicaEbro(); initSlugs(); pintaStamp(d); render(); revisarAlertas();
  } catch {}
}

async function init(){
  try { initFotos(); } catch (e) { console.warn("fotos", e); } // lo decorativo nunca debe romper la página
  initHoy();
  let d = window.EMBALSES_DATA;
  if (!d){
    try { d = await (await fetch("/data/embalses.json?" + Date.now())).json(); }
    catch { $("#stamp").innerHTML = '<span class="pill">No se pudieron cargar los datos.</span><button type="button" class="pill retry" onclick="location.reload()">Reintentar</button>'; return; }
  }
  all = d.embalses;
  const nLive = all.filter(e => e.vivo).length;

  const f = new Date(d.fecha_boletin + "T00:00").toLocaleDateString("es-ES", {day:"numeric", month:"long", year:"numeric"});
  pintaStamp(d);
  $("#foot").innerHTML = `
    <p>Fuente: <a href="https://www.miteco.gob.es/es/agua/temas/evaluacion-de-los-recursos-hidricos/boletin-hidrologico.html">MITECO · Boletín Hidrológico semanal</a>. Embalses peninsulares de más de 5 hm³. Datos provisionales sujetos a revisión. Los embalses más pequeños que publican las confederaciones (Tajo, Guadiana, Guadalquivir, Júcar y Duero) se añaden solo con su lectura en directo.</p>
    <p><b>Datos semanales:</b> el Ministerio publica el boletín una vez por semana (martes) para todos los embalses peninsulares de más de 5 hm³. <b>Datos en directo:</b> los sistemas SAIH de las confederaciones publican lecturas cada 5–15 minutos, pero cada una en su propia web y formato. Hoy la web lee en directo las cuencas del <b>Guadalquivir</b>, <b>Guadiana</b>, <b>Tajo</b>, <b>Júcar</b>, <b>Duero</b> y <b>Ebro</b> (el Ebro publica un valor al día y tu navegador lo consulta directamente en su web); el resto (Segura, Miño-Sil, Cantábrico…) muestra el dato semanal. Donde la fuente lo da, se muestra también cota y caudales de entrada y salida. La web consulta las fuentes de forma automática varias veces al día: en «Comprobado» ves cuándo fue la última vez, y cada embalse indica la antigüedad de su dato.</p>
    <p>Tiempo y presión: <a href="https://open-meteo.com">Open-Meteo</a>. Viento: <a href="https://www.windy.com">Windy</a>. Mapas: OpenStreetMap, OpenTopoMap y Esri. Fases lunares calculadas con SunCalc; los periodos solunares son una referencia tradicional de pesca, no una predicción científica.</p>
    <p>Las etiquetas de pesca (barco, pato, orillas inundadas o expuestas) son orientativas y se deducen del tamaño y del nivel del embalse. La web no mide la temperatura del agua (la que ves es una estimación a partir del aire), la vegetación ni la actividad de los peces. Consulta la normativa y el permiso de pesca de cada comunidad y cuenca antes de salir.</p>`;

  cookiesInit();
  const cuencas = [...new Set(all.map(e => e.cuenca))].sort((a,b) => a.localeCompare(b,"es"));
  $("#cuenca").innerHTML = '<option value="">Todas las cuencas</option>' + cuencas.map(c => `<option>${esc(c)}</option>`).join("");
  $("#solzona").innerHTML = '<option value="centro">Centro de España (Madrid)</option>' + all.filter(e => e.lat != null).map(e => `<option value="${e.id}">${esc(e.nombre)}${e.provincia ? " · " + esc(e.provincia) : ""}</option>`).join("");
  initSlugs();
  initCarousels();
  addEventListener("load", () => document.querySelectorAll(".ccar").forEach(carArrows));
  $("#confchips").addEventListener("click", ev => { const b = ev.target.closest("[data-cc]"); if (b){ confCuenca = b.dataset.cc; renderConf(); } });
  addEventListener("hashchange", routeFromHash);
  initSolunar();
  if (document.body.dataset.page === "solunar") solVisto = true; // en su página el calendario y la tabla se pintan ya
  renderHoy();
  const provs = [...new Set(all.map(e => e.provincia).filter(Boolean))].sort((a,b) => a.localeCompare(b,"es"));
  $("#prov").innerHTML = '<option value="">Todas las provincias</option>' + provs.map(p => `<option>${esc(p)}</option>`).join("");
  $("#prov").hidden = !provs.length;
  const grandes = ["Tajo","Guadiana","Guadalquivir","Ebro","Duero","Júcar","Segura"].filter(c => cuencas.includes(c));
  $("#quick").innerHTML = grandes.map(c => `<button type="button" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  $("#quick").addEventListener("click", ev => {
    const b = ev.target.closest("[data-c]"); if (!b) return;
    $("#cuenca").value = b.dataset.c; shown = PASO; render(); irLista();
  });

  // El mapa se crea solo cuando el visitante se acerca a él (carga más rápida)
  alVer("#mapa", () => {
    try {
      map = L.map("map", {scrollWheelZoom:false}).setView([39.9, -3.5], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18, className:"tiles-dark", attribution:"© OpenStreetMap"}).addTo(map);
      layer = L.layerGroup().addTo(map);
      pintarMapa(ultimaLista);
    } catch { map = null; $("#map").innerHTML = '<div class="empty">No se pudo cargar el mapa.</div>'; }
  }, "600px");

  for (const id of ["#q","#cuenca","#prov","#sort"]) $(id).addEventListener("input", () => { shown = PASO; render(); });
  $("#go").addEventListener("click", irLista);
  $("#q").addEventListener("keydown", ev => { if (ev.key === "Enter") irLista(); });
  $("#chips").addEventListener("click", ev => {
    const b = ev.target.closest(".chip"); if (!b) return;
    tfilter = b.dataset.t; shown = PASO;
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === b));
    render();
  });
  document.addEventListener("change", ev => {
    if (ev.target.id !== "altipo") return;
    const pr = ev.target.value === "presion";
    $("#alval").value = pr ? 3 : 40; $("#alval").max = pr ? 20 : 100; $("#alud").textContent = pr ? "hPa en 3 h" : "%";
  });
  document.addEventListener("click", ev => {
    const sh = ev.target.closest("[data-share]"); if (sh){ compartir(+sh.dataset.share); return; }
    if (ev.target.closest("#favlink")){ compartirFavs(); return; }
    const ad = ev.target.closest("[data-aladd]");
    if (ad){
      const a = {id: +ad.dataset.aladd, tipo: $("#altipo").value, valor: parseFloat(String($("#alval").value).replace(",", "."))};
      if (!(a.valor > 0) || (a.tipo !== "presion" && a.valor > 100)){ toast("Pon un valor válido.", 3000); return; }
      if (!alertas.some(x => claveAl(x) === claveAl(a))) alertas.push(a);
      guardaAl(); pintaAlertasFicha(); revisarAlertas(); return;
    }
    const dl = ev.target.closest("[data-aldel]");
    if (dl){ const a = alertas[+dl.dataset.aldel]; if (a){ delete estadoAl[claveAl(a)]; alertas.splice(+dl.dataset.aldel, 1); guardaAl(); pintaAlertasFicha(); revisarAlertas(); } return; }
    if (ev.target.closest("[data-alperm]")){ try { Promise.resolve(Notification.requestPermission()).then(pintaAlertasFicha); } catch {} return; }
    const s = ev.target.closest("[data-fav]");
    if (s){
      const id = +s.dataset.fav;
      favs.has(id) ? favs.delete(id) : favs.add(id);
      saveFavs(); render();
      const fb = document.querySelector(".fav-big"); // botón de la ficha abierta
      if (fb && +fb.dataset.fav === id){ fb.classList.toggle("on", favs.has(id)); fb.textContent = favs.has(id) ? "★ Favorito" : "☆ Guardar"; }
      return;
    }
    const c = ev.target.closest(".res, [data-open]");
    if (c) openDetail(+(c.dataset.id || c.dataset.open));
    // Se cierra con la X o pulsando fuera de la ficha
    if (ev.target.closest(".sheet .x") || ev.target.id === "modal") closeDetail();
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape") closeDetail();
    if (ev.key === "Enter" && ev.target.matches?.(".fav")) openDetail(+ev.target.dataset.open);
  });
  render();
  $("#vermas").addEventListener("click", () => { shown += PASO; render(); });
  filtrosDeLaUrl();
  render();
  routeFromHash(); // si llegan con un enlace #/embalse/..., se abre su ficha
  cargarEbro();
  revisarAlertas();
  setInterval(() => { cargarEbro(); }, 30 * 60 * 1000);
  setInterval(refrescarDatos, 10 * 60 * 1000);
  setInterval(revisarAlertas, 10 * 60 * 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescarDatos(); });
}

let ultimaLista = [];
// Ejecuta fn cuando el elemento se acerca a la pantalla (o ya, si el navegador no lo permite)
function alVer(sel, fn, margen = "300px"){
  const el = document.querySelector(sel); if (!el) return;
  if (!("IntersectionObserver" in window)) return fn();
  const io = new IntersectionObserver((en) => { if (en.some(x => x.isIntersecting)){ io.disconnect(); fn(); } }, {rootMargin: margen});
  io.observe(el);
}
const enReposo = (fn) => ("requestIdleCallback" in window) ? requestIdleCallback(fn, {timeout: 400}) : setTimeout(fn, 30);
function pintarMapa(list){
  if (!map) return;
  layer.clearLayers(); markers.clear();
  for (const e of list){
    if (e.lat == null) continue;
    const r = Math.max(5, Math.min(18, Math.sqrt(e.capacidad||1)*0.7));
    const m = L.circleMarker([e.lat,e.lon], {radius:r, color:"#06141c", weight:1.5, fillColor:hex(lvl(e).pct), fillOpacity:.9})
      .bindPopup(`<b>${esc(e.nombre)}</b><br>${esc(e.cuenca)}<br>${fmt(lvl(e).pct,1)} % · ${fmt(lvl(e).vol, 1)} / ${fmt(e.capacidad)} hm³${e.vivo?' · <b style="color:#f0c874">en directo</b>':''}<br><a href="#" onclick="openDetail(${e.id});return false">Ver ficha</a>`);
    m.addTo(layer); markers.set(e.id, m);
  }
  if (list.length && list.length < all.length){
    const pts = list.filter(e => e.lat != null).map(e => [e.lat,e.lon]);
    if (pts.length) map.fitBounds(pts, {padding:[30,30], maxZoom:10});
  } else if (list.length === all.length) map.setView([39.9,-3.5], 6);
}
let renderToken = 0;

function render(){
  const q = norm($("#q").value.trim()), c = $("#cuenca").value, pv = $("#prov").value;
  const base = all.filter(e => (!q || norm(e.nombre).includes(q) || norm(natural(e.nombre)).includes(q) || norm(e.cuenca).includes(q) || norm(e.provincia || "").includes(q)) && (!c || e.cuenca === c) && (!pv || e.provincia === pv));
  const list = base.filter(e => !tfilter || trendOf(e) === tfilter);

  // Indicador general sobre la selección (cuenca/búsqueda). Se usa la lectura en directo si existe.
  const vol = base.reduce((s,e) => s + (lvl(e).vol||0), 0), cap = base.reduce((s,e) => s + (e.capacidad||0), 0);
  // Hace una semana: en los embalses solo en directo no hay dato semanal, así que no cuentan en la variación
  const prev = base.reduce((s,e) => s + (e.extra ? lvl(e).vol : (e.volumen||0) - (e.variacion_hm3||0)), 0);
  const p = cap ? vol/cap*100 : 0, dv = vol - prev;
  const sube = base.filter(e => trendOf(e)==="sube").length, baja = base.filter(e => trendOf(e)==="baja").length;
  $("#gpct").textContent = fmt(p,1) + " %";
  $("#glbl").textContent = pv || c || (q ? "Selección de la búsqueda" : "Llenado total en España");
  $("#ring").style.strokeDashoffset = 515.2 * (1 - Math.min(p,100)/100);
  $("#ring").style.stroke = hex(p);
  $("#kpis").innerHTML = `
    <div class="card kpi"><small>Agua almacenada</small><b>${fmt(vol)} hm³</b><span>de ${fmt(cap)} hm³ de capacidad</span></div>
    <div class="card kpi"><small>Vs. semana anterior</small><b class="${dv>=0?'up':'down'}">${dv>=0?'+':''}${fmt(dv,0)} hm³</b><span>${dv>=0?'ganan agua':'pierden agua'} en conjunto</span></div>
    <div class="card kpi"><small>Subiendo</small><b class="up">${ico("up")} ${fmt(sube)}</b><span>embalses con más agua que hace una semana</span></div>
    <div class="card kpi"><small>Bajando</small><b class="down">${ico("down")} ${fmt(baja)}</b><span>embalses con menos agua que hace una semana</span></div>`;

  // Favoritos
  const fl = all.filter(e => favs.has(e.id));
  $("#favcount").textContent = $("#tbcount").textContent = fl.length ? `(${fl.length})` : "";
  $("#favs").innerHTML = fl.length ? fl.map(favCard).join("") : '<div class="empty favvacio">Pulsa la ☆ de cualquier embalse para guardarlo aquí y tenerlo siempre a mano. Se queda guardado en este navegador.</div>';
  const ft = $("#favtools"); if (ft) ft.hidden = !fl.length;
  fl.forEach(e => pintaMejorFav(e.id));

  // Mapa (se pinta cuando existe; si aún no se ha creado, se pinta al crearlo)
  ultimaLista = list;
  pintarMapa(list);

  // Lista
  const [k, dir] = $("#sort").value.split("-");
  const key = {nombre:"nombre", porcentaje:"porcentaje", capacidad:"capacidad", variacion:"variacion_hm3"}[k];
  list.sort((a,b) => {
    const x = a[key], y = b[key];
    const r = typeof x === "string" ? x.localeCompare(y,"es") : (x ?? -Infinity) - (y ?? -Infinity);
    return dir === "d" ? -r : r;
  });
  $("#count").textContent = `${fmt(list.length)} embalses` + (q ? ` para «${$("#q").value.trim()}»` : "");
  const gridEl = $("#grid"), clave = [q, c, pv, $("#sort").value, tfilter].join("|");
  const sl = clave === lastGridKey ? gridEl.scrollLeft : 0; lastGridKey = clave;
  // En su página (/embalses/) se enseñan de 48 en 48 con «Ver más»; en la portada, el carrusel completo
  if (document.body.dataset.page === "lista"){
    const vm = $("#vermas");
    gridEl.innerHTML = list.slice(0, shown).map(card).join("") || '<div class="empty">Sin resultados</div>';
    if (vm){ vm.hidden = list.length <= shown; vm.textContent = `Ver más (${fmt(list.length - shown)} embalses más)`; }
    renderConf(); cargarMejorDia(); return;
  }
  // Las tarjetas se pintan por tandas: las primeras al momento y el resto cuando el navegador está libre
  const token = ++renderToken, LOTE = 36;
  gridEl.innerHTML = list.slice(0, LOTE).map(card).join("") || '<div class="empty">Sin resultados</div>';
  gridEl.scrollLeft = sl; carArrows(gridEl);
  let desde = LOTE;
  const resto = () => {
    if (token !== renderToken || desde >= list.length) return;
    gridEl.insertAdjacentHTML("beforeend", list.slice(desde, desde + 60).map(card).join(""));
    desde += 60; carArrows(gridEl);
    if (sl && gridEl.scrollLeft < sl) gridEl.scrollLeft = sl;
    if (desde < list.length) enReposo(resto);
  };
  if (list.length > LOTE) enReposo(resto);
  renderConf();
  cargarMejorDia();
}

init();