// Crea img/c/<slug>.jpg (1200x630): la imagen que sale al compartir un embalse por WhatsApp, etc.
// Solo se generan las que faltan. Uso: NAVEGADOR=msedge node scripts/imagenes-compartir.mjs
import { readFile, writeFile, rm, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = await import("playwright-core");
const datos = JSON.parse(await readFile(join(RAIZ, "data", "embalses.json"), "utf8"));
const sl = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const url = (p) => pathToFileURL(join(RAIZ, p)).href;
// "Fernandina, La" -> "La Fernandina"
const natural = (n) => n.replace(/^(.+?),\s*(El|La|Los|Las)$/i, "$2 $1");

await mkdir(join(RAIZ, "img", "c"), { recursive: true });
const b = await chromium.launch({ channel: process.env.NAVEGADOR || "chrome", headless: true });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
const usados = new Set();
let hechas = 0;
for (const e of datos.embalses) {
  let s = sl(e.nombre) || "embalse";
  if (usados.has(s)) s += "-" + e.id;
  usados.add(s);
  const fich = join(RAIZ, "img", "c", s + ".jpg");
  if (await access(fich).then(() => true, () => false)) continue;
  const nombre = natural(e.nombre), tam = nombre.length > 26 ? 76 : nombre.length > 18 ? 96 : 116;
  const plantilla = join(RAIZ, "scripts", ".plantilla.html");
  await writeFile(plantilla, `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Oswald;src:url(${url("fonts/oswald-latin.woff2")});font-weight:200 700}
    @font-face{font-family:Inter;src:url(${url("fonts/inter-latin.woff2")});font-weight:100 900}
    *{box-sizing:border-box;margin:0}
    body{width:1200px;height:630px;overflow:hidden;font-family:Inter,sans-serif;color:#eaf2f4;
      background:radial-gradient(900px 500px at 85% 40%,#14384a 0,transparent 70%),linear-gradient(160deg,#0d2531,#06141c)}
    .w{position:absolute;inset:0;padding:70px 70px 0 80px;display:flex;align-items:center}
    .t{width:690px}
    .k{font:500 26px Oswald;letter-spacing:.22em;text-transform:uppercase;color:#d6a24a}
    h1{font:700 ${tam}px/1.02 Oswald;text-transform:uppercase;margin:18px 0 22px;color:#f0c874}
    .s{font:400 34px Inter;color:#eaf2f4}
    .s b{color:#8fb1bd;font-weight:500}
    .m{font:400 26px Inter;color:#8fb1bd;margin-top:30px}
    img{position:absolute;right:70px;top:115px;width:400px;height:400px;border-radius:50%;box-shadow:0 20px 60px rgba(0,0,0,.55),0 0 0 6px #d6a24a}
    .l{position:absolute;left:0;right:0;bottom:0;height:16px;background:linear-gradient(90deg,#d6a24a,#f0c874,#d6a24a)}
  </style></head><body><div class="w"><div class="t">
    <div class="k">Nivel del embalse</div><h1>${esc(nombre)}</h1>
    <div class="s">${esc(e.cuenca)}${e.provincia ? ` <b>·</b> ${esc(e.provincia)}` : ""}</div>
    <div class="m">Nivel · tiempo · presión · viento · luna</div>
  </div></div><img src="${url("img/logo-400.webp")}"><div class="l"></div></body></html>`);
  await p.goto(pathToFileURL(plantilla).href);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: fich, type: "jpeg", quality: 72 });
  hechas++;
}
await b.close();
await rm(join(RAIZ, "scripts", ".plantilla.html"), { force: true });
console.log(`Imágenes creadas: ${hechas}`);
