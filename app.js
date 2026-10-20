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

let lastGridKey = "", all = [], map, layer, markers = new Map(), shown = 24, tfilter = "";
let favs = new Set();
try { favs = new Set(JSON.parse(localStorage.getItem("favs") || "[]")); } catch {}
const saveFavs = () => { try { localStorage.setItem("favs", JSON.stringify([...favs])); } catch {} };

// Nivel actual: si hay lectura en directo se usa esa; si no, el boletín semanal
const lvl = (e) => e.vivo ? {vol:e.vivo.volumen, pct:e.vivo.porcentaje} : {vol:e.volumen, pct:e.porcentaje};
const fdt = (s) => new Date(s).toLocaleString("es-ES", {day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});

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
    <div class="sub">${esc(e.provincia || e.cuenca)}</div>
    <div class="fr"><b style="color:${hex(L.pct)}">${fmt(L.pct,0)}<small> %</small></b><span class="${t==='sube'?'up':t==='baja'?'down':''}">${txt} hm³<br><em>${e.extra ? "24 h" : "semana"}</em></span></div>
    <div class="tank"><i class="${lvlClass(L.pct)}" style="width:${Math.min(L.pct,100)}%"></i></div>
    <span class="ver">Ver ficha →</span>
  </article>`;
}

function card(e){
  const t = trendOf(e), v = varDe(e), L = lvl(e), dec = e.extra ? 2 : 1;
  const txt = t === "sube" ? `▲ +${fmt(v,dec)} hm³` : t === "baja" ? `▼ ${fmt(v,dec)} hm³` : "= Estable";
  return `<article class="res" data-id="${e.id}">
    <button class="star ${favs.has(e.id)?'on':''}" data-fav="${e.id}" aria-label="Marcar favorito" title="Favorito">${favs.has(e.id)?'★':'☆'}</button>
    <h3>${esc(e.nombre)}</h3>
    <div class="sub">${e.provincia ? esc(e.provincia) + " · " : ""}${esc(e.cuenca)} ${e.vivo?'<span class="live">● En directo</span>':''}</div>
    <div class="badges">${badges(e, L)}</div>
    <div class="row">
      <div class="pc">${fmt(L.pct,0)}<small> %</small></div>
      <div class="trend ${t==='sube'?'up':t==='baja'?'down':''}">${txt}<br><span>${e.extra ? "últimas 24 h" : "vs. semana ant."}</span></div>
    </div>
    <div class="tank"><i class="${lvlClass(L.pct)}" style="width:${Math.min(L.pct,100)}%"></i></div>
    <div class="meta"><span>${fmt(L.vol, e.vivo?1:0)} hm³</span><span>${e.vivo?'a las '+fdt(e.vivo.fecha):'de '+fmt(e.capacidad, e.capacidad < 20 ? 1 : 0)+' hm³'}</span></div>
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
      latitude: lat, longitude: lon, timezone: "Europe/Madrid", forecast_days: 5, past_hours: 6, wind_speed_unit: "kmh",
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
  for (let m = 0; m < 1440; m += 4){
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
  const dias = w.daily.time.map((t, i) => {
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
    setTimeout(() => tmap && tmap.invalidateSize(), 60);
  } catch { box.innerHTML = '<div class="empty">No se pudo cargar el mapa.</div>'; }
}

/* ---------- Ficha de embalse ---------- */
let fichaId = null;
const SITE = "https://levelbass.github.io/";
const baseTitle = document.title, baseDesc = document.querySelector('meta[name="description"]').content;
const slugs = new Map(), idPorSlug = new Map();
function initSlugs(){
  const sl = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (const e of all){
    let s = sl(e.nombre) || "embalse";
    if (idPorSlug.has(s)) s += "-" + e.id;
    slugs.set(e.id, s); idPorSlug.set(s, e.id);
  }
}
function metaFicha(e){
  const L = lvl(e), t = `${e.nombre} · nivel del embalse | LevelBass`;
  const d = `${e.nombre} (${e.cuenca}): ${fmt(L.pct,1)} % de capacidad, ${fmt(L.vol, e.vivo?2:0)} de ${fmt(e.capacidad)} hm³. Tiempo, presión, viento y luna para pescar black bass.`;
  const url = e ? SITE + "#/embalse/" + slugs.get(e.id) : SITE;
  document.title = t;
  const set = (sel, v) => { const n = document.querySelector(sel); if (n) n.setAttribute(n.tagName === "LINK" ? "href" : "content", v); };
  set('meta[name="description"]', d); set('meta[property="og:title"]', t); set('meta[property="og:description"]', d); set('meta[property="og:url"]', url);
  set('meta[name="twitter:title"]', t); set('meta[name="twitter:description"]', d); set('link[rel="canonical"]', SITE);
}
function metaBase(){
  document.title = baseTitle;
  const set = (sel, v) => { const n = document.querySelector(sel); if (n) n.setAttribute(n.tagName === "LINK" ? "href" : "content", v); };
  set('meta[name="description"]', baseDesc); set('meta[property="og:title"]', "LevelBass · Nivel de los embalses de España");
  set('meta[property="og:description"]', baseDesc); set('meta[property="og:url"]', SITE);
  set('meta[name="twitter:title"]', "LevelBass · Nivel de los embalses de España"); set('meta[name="twitter:description"]', baseDesc); set('link[rel="canonical"]', SITE);
}
function routeFromHash(){
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
    </div>`;
  if (e.vivo){
    const v = e.vivo;
    res += `<h4><span class="live">● En directo</span> · ${esc(v.fuente)} · ${fdt(v.fecha)}</h4>
    <div class="stats">
      ${stat("Cota", v.cota!=null?fmt(v.cota,2)+" m":"–", v.cota_aliviadero!=null?"cota máxima "+fmt(v.cota_aliviadero,2)+" m":"")}
      ${stat("Entrada", v.entrada!=null?fmt(v.entrada,2)+" m³/s":"–", "caudal recibido")}
      ${stat("Salida", v.salida!=null?fmt(v.salida,2)+" m³/s":"–", "caudal desembalsado")}
      ${stat("Últimas 24 h", v.var24h!=null?`<span class="${v.var24h>0?'up':v.var24h<0?'down':''}">${v.var24h>0?'+':''}${fmt(v.var24h,2)} hm³</span>`:"–", v.var24h!=null?"":"acumulando historial")}
    </div>`;
    const pts = (v.historial||[]).map(([t,x]) => [new Date(t).getTime(), x]);
    if (pts.length > 1) res += `<div class="chart"><small>Volumen en directo, últimos días</small>${spark(pts, 600, 110, "#f0c874")}</div>`;
    res += `<p class="src"><a href="${esc(v.url)}" target="_blank" rel="noopener">Ver en el SAIH oficial ↗</a></p>`;
  }
  if (!e.extra) res += `<div class="chart" id="hist"><small>Volumen semanal, último año frente al anterior</small><div class="empty" style="padding:16px">Cargando histórico…</div></div>`;
  if (tiene) res += `<div class="goto"><a class="btn-go" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${e.lat},${e.lon}">${ico("pin")} Cómo llegar</a><a class="btn-go alt" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lon}">Ver en Google Maps ↗</a></div><p class="src">Coordenadas ${e.lat}, ${e.lon}</p>`;

  const sinCoord = '<div class="empty">Este embalse no tiene coordenadas en los datos oficiales, así que no se puede mostrar esta sección.</div>';
  const h = `<button class="x" data-close aria-label="Cerrar">×</button>
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
    <section class="pane" data-pane="topo">${tiene ? '<div id="tmap"></div><p class="src">Capas de satélite y topográfica (OpenTopoMap) para localizar reculas, puntas, vaguadas y estructuras. Usa el selector de capas arriba a la derecha.</p>' : sinCoord}</section>`;
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
  }).catch(() => {
    if (fichaId !== id) return;
    $("#q-viento").innerHTML = `<small>${ico("wind")} Viento</small><b>–</b><span>sin datos</span>`;
    $("#q-tiempo").innerHTML = `<small>${ico("cloudsun")} Tiempo</small><b>–</b><span>sin datos</span>`;
    $("#q-presion").innerHTML = `<small>${ico("wave")} Presión</small><b>–</b><span>sin datos</span>`;
    $("#p-wx").innerHTML = $("#p-wind").innerHTML = '<div class="empty">No se pudo cargar el tiempo ahora mismo.</div>';
  });

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

/* ---------- Fotos: cinta, galería y visor ---------- */
const nn = (i) => String(i).padStart(2, "0");
// Solo se muestran fotos de peces solos o del barco (sin personas)
const FOTOS = [17, 18, 20, 21, 26, 30, 34];
let lbIdx = 0; // posición dentro de FOTOS
function initFotos(){
  $("#gallery").innerHTML = FOTOS.map((n, pos) => `<button data-lb="${pos}" aria-label="Ver foto ${pos + 1}"><img loading="lazy" decoding="async" src="img/t/f${nn(n)}.webp" alt="Captura de black bass nº ${pos + 1}" width="210" height="280"></button>`).join("");
  // Con pocas fotos la cinta se repite varias veces para que el bucle no deje huecos
  const cinta = FOTOS.map(i => `<img loading="lazy" decoding="async" src="img/t/f${nn(i)}.webp" alt="" width="210" height="280">`).join("");
  const mitad = cinta + cinta;
  $("#ribbon").innerHTML = mitad + mitad;
  const show = (pos) => { lbIdx = (pos + FOTOS.length) % FOTOS.length; $("#lb img").src = `img/f${nn(FOTOS[lbIdx])}.webp`; $("#lb").classList.add("open"); };
  $("#gallery").addEventListener("click", ev => { const b = ev.target.closest("[data-lb]"); if (b) show(+b.dataset.lb); });
  $("#lb .x").onclick = () => $("#lb").classList.remove("open");
  $("#lb .pv").onclick = (ev) => { ev.stopPropagation(); show(lbIdx - 1); };
  $("#lb .nx").onclick = (ev) => { ev.stopPropagation(); show(lbIdx + 1); };
  $("#lb").addEventListener("click", ev => { if (ev.target.id === "lb") $("#lb").classList.remove("open"); });
  document.addEventListener("keydown", ev => {
    if (!$("#lb").classList.contains("open")) return;
    if (ev.key === "Escape") $("#lb").classList.remove("open");
    if (ev.key === "ArrowLeft") show(lbIdx - 1);
    if (ev.key === "ArrowRight") show(lbIdx + 1);
  });
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
    calendarioSolunar(z);
    mejoresDias(z);
    tablaSolunar(z);
  } catch (err) { console.error(err); $("#solunar").hidden = true; }
}

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
    filas.push(`<tr class="${i === 0 ? "hoy" : ""}${s.estrellas >= 4 ? " top" : ""}" data-dia="${isoLocal(f)}"><td><div class="ph">${lunaSvg(s.fase, 34)}<div><b>${f.toLocaleDateString("es-ES", {weekday:"long", day:"numeric", month:"short"})}</b><span>${s.nombre} · ${fmt(s.fraccion * 100, 0)} %</span></div></div></td>
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
  const links = [...document.querySelectorAll("#tblinks a")], secs = links.map(a => document.querySelector(a.getAttribute("href")));
  const spy = () => {
    let k = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= 120) k = i; });
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
  const box = $("#windbox"), poner = () => { if (!box.firstChild) box.innerHTML = `<iframe title="Mapa de viento Windy" loading="lazy" src="${url}" allowfullscreen></iframe>`; };
  if ("IntersectionObserver" in window) new IntersectionObserver((en, ob) => { if (en.some(x => x.isIntersecting)){ poner(); ob.disconnect(); } }, {rootMargin:"300px"}).observe(box);
  else poner();
}

async function init(){
  initFotos();
  initHoy();
  let d = window.EMBALSES_DATA;
  if (!d){
    try { d = await (await fetch("data/embalses.json?" + Date.now())).json(); }
    catch { $("#stamp").innerHTML = '<span class="pill">No se pudieron cargar los datos.</span><button type="button" class="pill retry" onclick="location.reload()">Reintentar</button>'; return; }
  }
  all = d.embalses;
  const nLive = all.filter(e => e.vivo).length;

  const f = new Date(d.fecha_boletin + "T00:00").toLocaleDateString("es-ES", {day:"numeric", month:"long", year:"numeric"});
  const act = new Date(d.actualizado).toLocaleString("es-ES", {dateStyle:"medium", timeStyle:"short"});
  $("#stamp").innerHTML = `<span class="pill">Boletín semanal del <b>${f}</b></span><span class="pill">Comprobado <b>${act}</b></span><span class="pill"><b>${nLive}</b> embalses en directo</span>`;
  $("#foot").innerHTML = `
    <p>Fuente: <a href="https://www.miteco.gob.es/es/agua/temas/evaluacion-de-los-recursos-hidricos/boletin-hidrologico.html">MITECO · Boletín Hidrológico semanal</a>. Embalses peninsulares de más de 5 hm³. Datos provisionales sujetos a revisión. Los embalses más pequeños que publican las confederaciones (Tajo, Guadiana, Guadalquivir y Júcar) se añaden solo con su lectura en directo.</p>
    <p><b>Datos semanales:</b> el Ministerio publica el boletín una vez por semana (martes) para todos los embalses peninsulares de más de 5 hm³. <b>Datos en directo:</b> los sistemas SAIH de las confederaciones publican lecturas cada 5–15 minutos, pero cada una en su propia web y formato. Hoy la web lee en directo las cuencas del <b>Guadalquivir</b>, <b>Guadiana</b>, <b>Tajo</b> y <b>Júcar</b>; el resto (Ebro, Duero, Segura, Miño-Sil, Cantábrico…) muestra el dato semanal. Donde la fuente lo da, se muestra también cota y caudales de entrada y salida. La web se actualiza cada hora.</p>
    <p>Tiempo y presión: <a href="https://open-meteo.com">Open-Meteo</a>. Viento: <a href="https://www.windy.com">Windy</a>. Mapas: OpenStreetMap, OpenTopoMap y Esri. Fases lunares calculadas con SunCalc; los periodos solunares son una referencia tradicional de pesca, no una predicción científica.</p>
    <p>Las etiquetas de pesca (barco, pato, orillas inundadas o expuestas) son orientativas y se deducen del tamaño y del nivel del embalse. La web no mide la temperatura del agua, la vegetación ni la actividad de los peces. Consulta la normativa y el permiso de pesca de cada comunidad y cuenca antes de salir.</p>`;

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
  renderHoy();
  const provs = [...new Set(all.map(e => e.provincia).filter(Boolean))].sort((a,b) => a.localeCompare(b,"es"));
  $("#prov").innerHTML = '<option value="">Todas las provincias</option>' + provs.map(p => `<option>${esc(p)}</option>`).join("");
  $("#prov").hidden = !provs.length;
  const grandes = ["Tajo","Guadiana","Guadalquivir","Ebro","Duero","Júcar","Segura"].filter(c => cuencas.includes(c));
  $("#quick").innerHTML = grandes.map(c => `<button type="button" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  $("#quick").addEventListener("click", ev => {
    const b = ev.target.closest("[data-c]"); if (!b) return;
    $("#cuenca").value = b.dataset.c; shown = 24; render(); $("#lista").scrollIntoView({behavior:"smooth"});
  });

  try {
    map = L.map("map", {scrollWheelZoom:false}).setView([39.9, -3.5], 6);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:18, className:"tiles-dark", attribution:"© OpenStreetMap"}).addTo(map);
    layer = L.layerGroup().addTo(map);
  } catch { map = null; $("#map").innerHTML = '<div class="empty">No se pudo cargar el mapa.</div>'; }

  for (const id of ["#q","#cuenca","#prov","#sort"]) $(id).addEventListener("input", () => { shown = 24; render(); });
  const irLista = () => $("#lista").scrollIntoView({behavior:"smooth"});
  $("#go").addEventListener("click", irLista);
  $("#q").addEventListener("keydown", ev => { if (ev.key === "Enter") irLista(); });
  $("#chips").addEventListener("click", ev => {
    const b = ev.target.closest(".chip"); if (!b) return;
    tfilter = b.dataset.t; shown = 24;
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === b));
    render();
  });
  document.addEventListener("click", ev => {
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
  routeFromHash(); // si llegan con un enlace #/embalse/..., se abre su ficha
}

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

  // Mapa
  if (map){ layer.clearLayers(); markers.clear(); }
  for (const e of (map ? list : [])){
    if (e.lat == null) continue;
    const r = Math.max(5, Math.min(18, Math.sqrt(e.capacidad||1)*0.7));
    const m = L.circleMarker([e.lat,e.lon], {radius:r, color:"#06141c", weight:1.5, fillColor:hex(lvl(e).pct), fillOpacity:.9})
      .bindPopup(`<b>${esc(e.nombre)}</b><br>${esc(e.cuenca)}<br>${fmt(lvl(e).pct,1)} % · ${fmt(lvl(e).vol, 1)} / ${fmt(e.capacidad)} hm³${e.vivo?' · <b style="color:#f0c874">en directo</b>':''}<br><a href="#" onclick="openDetail(${e.id});return false">Ver ficha</a>`);
    m.addTo(layer); markers.set(e.id, m);
  }
  if (map && list.length && list.length < all.length){
    const pts = list.filter(e => e.lat != null).map(e => [e.lat,e.lon]);
    if (pts.length) map.fitBounds(pts, {padding:[30,30], maxZoom:10});
  } else if (map && list.length === all.length) map.setView([39.9,-3.5], 6);

  // Lista
  const [k, dir] = $("#sort").value.split("-");
  const key = {nombre:"nombre", porcentaje:"porcentaje", capacidad:"capacidad", variacion:"variacion_hm3"}[k];
  list.sort((a,b) => {
    const x = a[key], y = b[key];
    const r = typeof x === "string" ? x.localeCompare(y,"es") : (x ?? -Infinity) - (y ?? -Infinity);
    return dir === "d" ? -r : r;
  });
  $("#count").textContent = `${fmt(list.length)} embalses`;
  const gridEl = $("#grid"), clave = [q, c, pv, $("#sort").value, tfilter].join("|");
  const sl = clave === lastGridKey ? gridEl.scrollLeft : 0; lastGridKey = clave;
  gridEl.innerHTML = list.map(card).join("") || '<div class="empty">Sin resultados</div>';
  gridEl.scrollLeft = sl; carArrows(gridEl);
  renderConf();
}

init();
