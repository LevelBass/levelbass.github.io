// Descarga el estado actual de los embalses desde el servicio oficial del MITECO
// (Boletín Hidrológico) y lo guarda en data/embalses.json.
// Uso: node scripts/actualizar.mjs
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVICIO =
  "https://services-eu1.arcgis.com/RvnYk1PBUJ9rrAuT/arcgis/rest/services/Embalses_Mapa/FeatureServer/0/query";

const params = new URLSearchParams({
  where: "1=1",
  outFields: "*",
  outSR: "4326",
  f: "json",
});

const res = await fetch(`${SERVICIO}?${params}`, {
  headers: { "User-Agent": "embalses-espana/1.0" },
});
if (!res.ok) throw new Error(`HTTP ${res.status} al consultar el MITECO`);
const json = await res.json();
if (json.error) throw new Error(`Error del servicio: ${JSON.stringify(json.error)}`);
if (!json.features?.length) throw new Error("El servicio no devolvió embalses");

const redondea = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

const embalses = json.features
  .map((f) => {
    const a = f.attributes;
    return {
      id: a.EMBALSE_ID,
      nombre: a.embalse_nombre,
      cuenca: a.ambito_nombre,
      uso: a.Uso,
      capacidad: a.agua_total, // hm³
      volumen: a.agua_actual, // hm³
      porcentaje: redondea(a.Porcentaje_Reserva),
      variacion_hm3: redondea(a.Variacion_Reserva),
      variacion_pct: redondea(a.Variacion_Porcentaje),
      fecha: new Date(a.fecha).toISOString().slice(0, 10),
      lat: redondea(f.geometry?.y, 5),
      lon: redondea(f.geometry?.x, 5),
    };
  })
  .sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));

const fechas = [...new Set(embalses.map((e) => e.fecha))].sort();
const salida = {
  fuente: "MITECO · Boletín Hidrológico semanal",
  actualizado: new Date().toISOString(),
  fecha_boletin: fechas[fechas.length - 1],
  embalses,
};

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, "embalses.json"), JSON.stringify(salida));
console.log(`OK: ${embalses.length} embalses · boletín ${salida.fecha_boletin}`);
