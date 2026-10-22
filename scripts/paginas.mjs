// Genera las páginas propias (/jornada/, /solunar/, /embalses/, /confinados/) a partir de index.html.
// Cada una es el mismo index.html con <body data-page="..."> (app.js solo muestra su sección), rutas absolutas y sus propios títulos.
// Se ejecuta desde actualizar.mjs tras sellar la versión de index.html, o a mano: node scripts/paginas.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PAGINAS = [
  { dir: "jornada", page: "jornada", titulo: "Planifica tu jornada de pesca | LevelBass",
    desc: "Elige embalse y día y te resumimos todo: nivel del agua, tiempo, viento, luna y las mejores horas para pescar black bass." },
  { dir: "solunar", page: "solunar", titulo: "Tabla solunar para pescar black bass | LevelBass",
    desc: "Fase de la luna, periodos mayores y menores de actividad y mejores días para pescar black bass en los embalses de España." },
  { dir: "embalses", page: "lista", titulo: "Nivel de todos los embalses de España | LevelBass",
    desc: "El nivel de agua de todos los embalses de España al día: busca el tuyo, mira si sube o baja y guarda tus favoritos." },
  { dir: "confinados", page: "confinados", titulo: "Embalses confinados por mejillón cebra | LevelBass",
    desc: "Embalses donde la barca queda confinada por el mejillón cebra y las normas de cada confederación hidrográfica." },
];

export async function generarPaginas(raiz) {
  const ix = await readFile(join(raiz, "index.html"), "utf8");
  const attr = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  for (const p of PAGINAS) {
    const url = `https://levelbass.es/${p.dir}/`;
    let h = ix
      .replace(/(href|src)="(?!https?:|\/|#|data:|mailto:)([^"]+)"/g, '$1="/$2"')   // rutas relativas -> absolutas
      .replace(/href="#(top|favoritos|mapa|viento)"/g, (_, a) => `href="/${a === "top" ? "" : "#" + a}"`)
      .replace("<body>", `<body data-page="${p.page}">`)
      .replace(/\s*<div class="ribbon"[^\n]*<\/div><\/div>/, "")   // la cinta de fotos solo va en la portada
      .replace(/<title>[^<]*<\/title>/, `<title>${attr(p.titulo)}</title>`)
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${attr(p.titulo)}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${attr(p.titulo)}$2`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${attr(p.desc)}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${attr(p.desc)}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${attr(p.desc)}$2`);
    await mkdir(join(raiz, p.dir), { recursive: true });
    await writeFile(join(raiz, p.dir, "index.html"), h);
  }
  // sitemap con la portada y las páginas
  const urls = ["", ...PAGINAS.map((p) => p.dir + "/")].map((u) => `<url><loc>https://levelbass.es/${u}</loc></url>`).join("");
  await writeFile(join(raiz, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await generarPaginas(join(dirname(fileURLToPath(import.meta.url)), ".."));
  console.log("Páginas generadas:", PAGINAS.map((p) => p.dir).join(", "));
}
