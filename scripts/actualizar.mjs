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
};

const fuentes = { jucar: "SAIH Júcar" };
const porNombre = new Map(embalses.map((e) => [norm(e.nombre), e]));

const estado = {};
const sinEmparejar = [];
for (const [clave, leer] of Object.entries(lectores)) {
  try {
    const lista = await leer();
    let ok = 0;
    for (const l of lista) {
      const n = norm(l.nombre);
      let e = porNombre.get(n);
      if (!e && n.length >= 4) { // "Tous" ↔ "Tous - La Ribera"
        const c = embalses.filter((x) => { const m = norm(x.nombre); return m.startsWith(n + " ") || n.startsWith(m + " "); });
        if (c.length === 1) e = c[0];
      }
      if (!e || l.volumen == null) { sinEmparejar.push(`${clave}: ${l.nombre}`); continue; }
      e.vivo = {
        fuente: fuentes[clave], volumen: l.volumen, nmn: l.nmn,
        porcentaje: redondea(e.capacidad ? (l.volumen / e.capacidad) * 100 : null),
        cota: l.cota, cota_aliviadero: l.cota_aliviadero, entrada: l.entrada, salida: l.salida,
        fecha: l.fecha, url: l.url,
      };
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
  const ult = h[h.length - 1];
  if (!ult || ult[0] !== e.vivo.fecha) h.push([e.vivo.fecha, e.vivo.volumen]);
  hist[e.id] = h.filter(([t]) => new Date(t).getTime() > corte);
  // variación en directo frente a la lectura más antigua disponible (hasta 24 h)
  const ref = hist[e.id].find(([t]) => new Date(e.vivo.fecha).getTime() - new Date(t).getTime() <= 24 * 3600 * 1000);
  e.vivo.var24h = ref && ref[0] !== e.vivo.fecha ? redondea(e.vivo.volumen - ref[1], 2) : null;
  e.vivo.historial = hist[e.id].map(([t, v]) => [t, v]);
}

const fechas = [...new Set(embalses.map((e) => e.fecha))].sort();
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
