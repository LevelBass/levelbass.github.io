// Descarga los datos de embalses y los guarda en data/embalses.json y data/embalses.js
//  1) Base semanal oficial: MITECO · Boletín Hidrológico (todos los embalses peninsulares > 5 hm³)
//  2) Capa "en directo": SAIH de las confederaciones (cada fuente tiene su propio lector)
// Uso: node scripts/actualizar.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
const UA = { "User-Agent": "Mozilla/5.0 (embalses-espana)" };
const redondea = (n, d = 1) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const num = (s) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return Number.isNaN(n) ? null : n; };
const norm = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\bembalse\b|\bpantano\b/g, "").replace(/\b(de|del|la|las|el|los|l|d)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();


// "2026-10-19T11:00" en UTC -> hora local de España "2026-10-19T13:00"
const utcAMadrid = (iso, desfaseHoras = 0) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(new Date(iso + ":00Z").getTime() - desfaseHoras * 3600e3)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
// nombre en el SAIH (normalizado) -> nombre en el boletín del Ministerio (normalizado)
const ALIAS = { "puerto vallehermoso": "pto vallehermoso", "torre abraham": "torre abrahan", "cornalvo": "cornalbo", "guadiloba caceres": "caceres guadiloba" };
// ---------------------------------------------------------------- 1) Boletín semanal
const SERVICIO = "https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services/Embalses_Mapa/FeatureServer/0/query";
const res = await fetch(`${SERVICIO}?${new URLSearchParams({ where: "1=1", outFields: "*", outSR: "4326", f: "json" })}`, { headers: UA });
if (!res.ok) throw new Error(`HTTP ${res.status} al consultar el MITECO`);
const json = await res.json();
if (json.error) throw new Error(`Error del servicio: ${JSON.stringify(json.error)}`);
if (!json.features?.length) throw new Error("El servicio no devolvió embalses");

const embalses = json.features
  .map((f) => {
    const a = f.attributes;
    return {
      id: a.EMBALSE_ID,
      nombre: a.embalse_nombre,
      cuenca: a.ambito_nombre,
      uso: a.Uso,
      electrico: a.electrico_flag === 1,
      capacidad: a.agua_total,
      volumen: a.agua_actual,
      porcentaje: redondea(a.Porcentaje_Reserva),
      variacion_hm3: redondea(a.Variacion_Reserva),
      variacion_pct: redondea(a.Variacion_Porcentaje),
      fecha: new Date(a.fecha).toISOString().slice(0, 10),
      lat: redondea(f.geometry?.y, 5),
      lon: redondea(f.geometry?.x, 5),
    };
  })
  .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));

// ---------------------------------------------------------------- 2) Lectores en directo
// Cada lector devuelve [{ nombre, volumen, nmn, cota, cota_aliviadero, entrada, salida, fecha:"AAAA-MM-DDTHH:mm", url }]
const lectores = {
  async jucar() {
    const url = "https://saih.chj.es/embalses";
    const html = await (await fetch(url, { headers: UA })).text();
    const filas = [...html.matchAll(/<tr><td class="text-nowrap pe-2">(EMBALSE[^<]+)<\/td>(.*?)<\/tr>/gs)];
    const out = [];
    for (const [, nombre, resto] of filas) {
      const c = [...resto.matchAll(/<td[^>]*>(?:<span[^>]*>)?([^<]*)(?:<\/span>)?<\/td>/g)].map((m) => m[1].trim());
      const ficha = resto.match(/href="(\/embalses\/\d+)"/)?.[1];
      const f = c[1]?.match(/(\d\d)-(\d\d)-(\d{4}) (\d\d:\d\d)/);
      if (!f) continue;
      out.push({
        nombre,
        volumen: num(c[0]), nmn: num(c[2]), cota: num(c[3]), cota_aliviadero: num(c[4]),
        entrada: num(c[5]), salida: num(c[6]),
        fecha: `${f[3]}-${f[2]}-${f[1]}T${f[4]}`,
        url: ficha ? `https://saih.chj.es${ficha}` : url,
      });
    }
    return out;
  },

  async guadalquivir() {
    // La web del SAIH es ASP.NET: hay que pedir cada zona con un "postback" del desplegable.
    const url = "https://www.chguadalquivir.es/saih/EmbalNiv.aspx";
    const dec = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)).replace(/&amp;/g, "&");
    const r0 = await fetch(url, { headers: UA });
    const cookie = (r0.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    const html0 = await r0.text();
    const out = [], vistos = new Set();
    const leer = (html) => {
      const m = html.match(/Actualizados:\s*(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)/);
      const fecha = m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}` : new Date().toISOString().slice(0, 16);
      const tabla = html.match(/<table[^>]*GridNivelesEmbalses[^>]*>(.*?)<\/table>/s)?.[1] ?? "";
      for (const [, fila] of tabla.matchAll(/<tr class="filasGridView">(.*?)<\/tr>/gs)) {
        const c = [...fila.matchAll(/<td[^>]*>(.*?)<\/td>/gs)].map((x) => dec(x[1].replace(/<[^>]+>/g, "")).trim());
        if (c.length < 8) continue; // nombre, NMN, nivel, icono, capacidad, volumen, icono, %
        const codigo = c[0].match(/^([A-Z]\d+)/)?.[1];
        if (codigo && vistos.has(codigo)) continue;
        if (codigo) vistos.add(codigo);
        const nombre = c[0].replace(/^[A-Z]\d+\s+/, "").replace(/\s*\([A-Z]{1,3}\)\s*$/, "").trim();
        out.push({ nombre, cota_aliviadero: num(c[1]), cota: num(c[2]), nmn: num(c[4]), volumen: num(c[5]), fecha, url });
      }
    };
    leer(html0);
    for (const zona of ["CO", "GR", "JA", "SE", "RG"]) {
      const campos = {};
      for (const [, tag] of html0.matchAll(/<input([^>]*)>/g)) {
        const nombre = tag.match(/name="([^"]+)"/)?.[1];
        if (nombre && /^__|^TreeS|^TreeT|^TreeE|^TreeM/.test(nombre)) campos[nombre] = dec(tag.match(/value="([^"]*)"/)?.[1] ?? "");
      }
      campos.__EVENTTARGET = "ctl00$ContentPlaceHolder1$DDBzona";
      campos.__EVENTARGUMENT = "";
      campos["ctl00$ContentPlaceHolder1$DDBzona"] = zona;
      const r = await fetch(url, { method: "POST", headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie, Referer: url }, body: new URLSearchParams(campos) });
      leer(await r.text());
    }
    return out;
  },

  async tajo() {
    const base = "https://saihtajo.chtajo.es/";
    const H = { ...UA, Referer: base, "X-Requested-With": "XMLHttpRequest" };
    const quita = (t) => JSON.parse(t.replace(/^\uFEFF/, "")).response;
    const home = await (await fetch(base, { headers: UA })).text();
    // El enlace del menú es estable; si no aparece en la portada se usa el último conocido.
    const enlace = home.match(/href="(index\.php\?w=get-embalses[^"]+)"/)?.[1]?.replace(/&amp;/g, "&")
      ?? "index.php?w=get-embalses&x=6JpzkjTQWNkOrV5tiYDGg9yJrm0S4LHfAbFJ0%2BLefGPnUGhtVafg8CQe0l7DRMrSJUKgHMt%2FllUCePWaLlCp%2Bg%3D%3D";
    const lista = quita(await (await fetch(base + enlace, { headers: H })).text()).embalses;
    const out = [];
    const una = async (e) => {
      const r = quita(await (await fetch(base + e.estacion.url.replace(/&amp;/g, "&"), { headers: H })).text());
      const sen = (tipo) => r.senales.find((s) => s.tiposenal === tipo);
      const ult = (s) => [...(s?.valores ?? [])].reverse().find((v) => v.valor != null);
      const vol = ult(sen("VE"));
      if (!vol) return;
      const t = vol.tiempo.match(/(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)/);
      const fecha = utcAMadrid(`${t[3]}-${t[2]}-${t[1]}T${t[4]}`, 1); // el SAIH Tajo da la hora en UTC+1
      const historial = (sen("VE").valores ?? []).filter((v) => v.valor != null).map((v) => {
        const m = v.tiempo.match(/(\d\d)\/(\d\d)\/(\d{4}) (\d\d:\d\d)/);
        return [utcAMadrid(`${m[3]}-${m[2]}-${m[1]}T${m[4]}`, 1), v.valor];
      });
      out.push({
        nombre: e.nombre, volumen: vol.valor, nmn: parseFloat(sen("VE").maximo) || null, porcentaje: ult(sen("PO"))?.valor ?? null,
        cota: ult(sen("NE"))?.valor ?? null, cota_aliviadero: parseFloat(sen("NE")?.maximo) || null, salida: ult(sen("CSR"))?.valor ?? null,
        fecha, historial, url: base,
        utm: e.estacion?.utm?.x ? { x: parseFloat(e.estacion.utm.x), y: parseFloat(e.estacion.utm.y), huso: e.estacion.utm.huso } : null,
      });
    };
    const cola = [...lista];
    await Promise.all(Array.from({ length: 5 }, async () => { for (let e; (e = cola.shift()); ) { try { await una(e); } catch {} } }));
    return out;
  },

  async guadiana() {
    // SIRA Guadiana es una aplicación que carga los datos con JavaScript: se lee con un navegador sin ventana.
    const { chromium } = await import("playwright-core");
    const b = await chromium.launch({ channel: process.env.NAVEGADOR || "chrome", headless: true });
    try {
      const p = await b.newPage();
      await p.goto("https://www.siraguadiana.com/E/DATOS", { waitUntil: "networkidle", timeout: 60000 });
      await p.waitForSelector("tr td", { timeout: 30000 });
      await p.waitForTimeout(2500);
      const filas = await p.$$eval("tr", (trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((c) => c.innerText.replace(/\s+/g, " ").trim())));
      const out = [];
      for (const c of filas) {
        if (c.length < 11 || !/^E\d-\d+/.test(c[0])) continue;
        const f = c[10].match(/(\d{4})\.(\d\d)\.(\d\d) (\d\d:\d\d)/);
        const volumen = num(c[3]);
        if (!f || volumen == null) continue;
        out.push({
          nombre: c[1], cota: num(c[2]), volumen, porcentaje: num(c[4]), salida: num(c[5]),
          fecha: utcAMadrid(`${f[1]}-${f[2]}-${f[3]}T${f[4]}`), url: "https://www.siraguadiana.com/E/DATOS",
        });
      }
      return out;
    } finally { await b.close(); }
  },
};

const fuentes = { jucar: "SAIH Júcar", guadalquivir: "SAIH Guadalquivir", tajo: "SAIH Tajo", guadiana: "SIRA Guadiana" };
const porNombre = new Map(embalses.map((e) => [norm(e.nombre), e]));

const CUENCA_DE = { jucar: "Júcar", guadalquivir: "Guadalquivir", tajo: "Tajo", guadiana: "Guadiana" };
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// Coordenadas UTM (ETRS89/WGS84) -> latitud y longitud
const utmALatLon = (x, y, huso) => {
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const m = y / k0, mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const fp = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
  const c1 = ep2 * Math.cos(fp) ** 2, t1 = Math.tan(fp) ** 2, n1 = a / Math.sqrt(1 - e2 * Math.sin(fp) ** 2);
  const r1 = a * (1 - e2) / (1 - e2 * Math.sin(fp) ** 2) ** 1.5, d = (x - 500000) / (n1 * k0);
  const lat = fp - (n1 * Math.tan(fp) / r1) * (d ** 2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ep2) * d ** 4 / 24);
  const lon = (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ep2 + 24 * t1 ** 2) * d ** 5 / 120) / Math.cos(fp);
  return [(lat * 180) / Math.PI, (huso * 6 - 183) + (lon * 180) / Math.PI];
};

const estado = {};
const semillas = new Map(); // historial que ya trae la propia fuente (p. ej. Tajo: últimas 23 h)
const sinEmparejar = [];
for (const [clave, leer] of Object.entries(lectores)) {
  try {
    const lista = await leer();
    let ok = 0;
    for (const l of lista) {
      const ahora = utcAMadrid(new Date().toISOString().slice(0, 16));
      if (l.fecha > ahora) l.fecha = ahora; // algún SAIH tiene el reloj adelantado
      const n = norm(l.nombre);
      let e = porNombre.get(ALIAS[n] ?? n);
      if (!e && n.length >= 4) { // "Tous" ↔ "Tous - La Ribera"
        const c = embalses.filter((x) => { const m = norm(x.nombre); return m.startsWith(n + " ") || n.startsWith(m + " "); });
        if (c.length === 1) e = c[0];
      }
      if (!e && l.volumen != null && !/azud|deriv|contraemb/i.test(l.nombre)) {
        // Embalse que el SAIH publica pero que no está en el boletín semanal (menos de 5 hm³): se añade solo con dato en directo
        // La capacidad se deduce del volumen y el % de la fuente (el máximo que publican algunos SAIH no siempre cuadra)
        const cap = l.porcentaje > 1 ? (l.volumen / l.porcentaje) * 100 : l.nmn > 0 && l.nmn < 100000 ? l.nmn : null;
        const nombre = l.nombre.toLowerCase().replace(/(^|[\s(-])\p{L}/gu, (m) => m.toUpperCase()).replace(/\b(De|Del|La|Las|El|Los|Y)\b/g, (m) => m.toLowerCase()).replace(/^embalse de /i, "");
        const ll = l.utm ? utmALatLon(l.utm.x, l.utm.y, l.utm.huso) : null;
        e = {
          id: 100000 + (hash(`${clave}:${norm(l.nombre)}`) % 800000), nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
          cuenca: CUENCA_DE[clave], uso: null, electrico: false, capacidad: cap != null ? redondea(cap, 2) : null,
          volumen: null, porcentaje: null, variacion_hm3: null, variacion_pct: null, fecha: null,
          lat: ll ? redondea(ll[0], 5) : null, lon: ll ? redondea(ll[1], 5) : null, extra: true,
        };
        embalses.push(e);
      } else if (!e || l.volumen == null) { sinEmparejar.push(`${clave}: ${l.nombre}`); continue; }
      e.vivo = {
        fuente: fuentes[clave], volumen: l.volumen, nmn: l.nmn,
        porcentaje: l.porcentaje != null ? redondea(l.porcentaje) : redondea(e.capacidad ? (l.volumen / e.capacidad) * 100 : null),
        // (si e es nuevo y la fuente no da %, el cálculo anterior ya usa la capacidad deducida)
        cota: l.cota, cota_aliviadero: l.cota_aliviadero, entrada: l.entrada, salida: l.salida,
        fecha: l.fecha, url: l.url,
      };
      if (l.historial?.length) semillas.set(e.id, l.historial);
      ok++;
    }
    estado[clave] = { ok, total: lista.length };
  } catch (err) {
    estado[clave] = { error: String(err.message || err) };
  }
}

// ---------------------------------------------------------------- 3) Historial en directo (7 días)
await mkdir(DIR, { recursive: true });
let hist = {};
try { hist = JSON.parse(await readFile(join(DIR, "historial.json"), "utf8")); } catch {}
const corte = Date.now() - 7 * 24 * 3600 * 1000;
for (const e of embalses) {
  if (!e.vivo) continue;
  const h = (hist[e.id] ||= []);
  for (const [t, v] of semillas.get(e.id) ?? []) if (!h.some((x) => x[0] === t)) h.push([t, v]);
  h.sort((a, b) => a[0].localeCompare(b[0]));
  const ult = h[h.length - 1];
  if (!ult || ult[0] !== e.vivo.fecha) h.push([e.vivo.fecha, e.vivo.volumen]);
  hist[e.id] = h.filter(([t]) => new Date(t).getTime() > corte);
  // variación en directo frente a la lectura más antigua disponible (hasta 24 h)
  const ref = hist[e.id].find(([t]) => new Date(e.vivo.fecha).getTime() - new Date(t).getTime() <= 24 * 3600 * 1000);
  e.vivo.var24h = ref && ref[0] !== e.vivo.fecha ? redondea(e.vivo.volumen - ref[1], 2) : null;
  e.vivo.historial = hist[e.id].map(([t, v]) => [t, v]);
}

embalses.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));
const fechas = [...new Set(embalses.filter((e) => e.fecha).map((e) => e.fecha))].sort();
const salida = {
  fuente: "MITECO · Boletín Hidrológico semanal + SAIH en directo",
  actualizado: new Date().toISOString(),
  fecha_boletin: fechas[fechas.length - 1],
  en_directo: { fuentes: estado, embalses: embalses.filter((e) => e.vivo).length },
  embalses,
};
await writeFile(join(DIR, "historial.json"), JSON.stringify(hist));
await writeFile(join(DIR, "embalses.json"), JSON.stringify(salida));
await writeFile(join(DIR, "embalses.js"), `window.EMBALSES_DATA=${JSON.stringify(salida)};`);
console.log(`OK: ${embalses.length} embalses · boletín ${salida.fecha_boletin} · en directo: ${salida.en_directo.embalses}`);
console.log("Fuentes:", JSON.stringify(estado));
if (sinEmparejar.length) console.log("Sin emparejar:", sinEmparejar.join("; "));
