// Embalses donde la barca queda "confinada" (mejillón cebra). Revisado el 19/10/2026 con las listas oficiales de cada confederación.
// id = id del embalse en embalses.json · c = cuenca · n = nota · f = fuente
window.CONFINADOS = {
  actualizado: "2026-10-19",
  fuentes: {
    ebro: {nombre: "CHE · Navegación en embalses (Tipo A, mar. 2026)", url: "https://www.chebro.es/navegacion-en-embalses"},
    jucar: {nombre: "CHJ · Prohibiciones y limitaciones a la navegación", url: "https://www.chj.es/es-es/ciudadano/masinformaciontramites/Documents/Procedimientos%20relativos%20a%20los%20usos%20comunes%20especiales%20del%20DPH%20sometidos%20a%20Declaracion%20Responsable/Listado%20especifico%20prohibiciones1.pdf"},
    guadalquivir: {nombre: "CHG · Información de relevancia jurídica (resoluciones de confinamiento)", url: "https://www.chguadalquivir.es/informacion-de-relevancia-juridica"},
    guadalquivir_torre: {nombre: "CHG · Resolución de Torre del Águila", url: "https://www.chguadalquivir.es/-/la-confederacion-hidrografica-del-guadalquivir-confina-la-navegacion-en-el-embalse-de-torre-del-aguila-para-evitar-la-expansion-del-mejillon-cebra"},
    guadalquivir_giribaile: {nombre: "CHG · Resolución de Giribaile", url: "https://www.chguadalquivir.es/-/la-confederacion-hidrografica-del-guadalquivir-confina-la-navegacion-en-el-embalse-de-giribaile-jaen-para-frenar-la-expansion-del-mejillon-cebra"}
  },
  e: [
    // Ebro (Tipo A: embalses afectados; solo se puede navegar en un embalse por declaración)
    {id: 19,  c: "Ebro", f: "ebro", n: "Zona de navegación delimitada por boyas. Remo y vela."},
    {id: 62,  c: "Ebro", f: "ebro", n: "Navegación conjunta posible con Lanuza (remo y vela)."},
    {id: 70,  c: "Ebro", f: "ebro", n: "Motor hasta 20 CV. Navegación conjunta posible con la Estanca de Alcañiz."},
    {id: 123, c: "Ebro", f: "ebro", n: "Prohibido navegar a menos de 200 m de la orilla y 300 m de la presa."},
    {id: 13,  c: "Ebro", f: "ebro", n: "Navegación conjunta posible con Calanda (remo, vela y motor)."},
    {id: 403, c: "Ebro", f: "ebro", n: "Navegación conjunta posible con Mequinenza y Ribarroja."},
    {id: 160, c: "Ebro", f: "ebro", n: "Remo y vela. Prohibido a menos de 200 m de la presa."},
    {id: 38,  c: "Ebro", f: "ebro", n: "También llamado Joaquín Costa. Prohibido a menos de 200 m de la presa."},
    {id: 183, c: "Ebro", f: "ebro", n: "Navegación conjunta posible con Búbal (remo y vela)."},
    {id: 200, c: "Ebro", f: "ebro", n: "Navegación conjunta posible con Ribarroja y Flix (remo, vela y motor)."},
    {id: 363, c: "Ebro", f: "ebro", n: "Motor hasta 150 CV. Prohibido a menos de 500 m de la presa."},
    {id: 255, c: "Ebro", f: "ebro", n: "Navegación conjunta posible con Mequinenza y Flix."},
    {id: 386, c: "Ebro", f: "ebro", n: "San Lorenzo de Mongay. Remo y vela."},
    {id: 283, c: "Ebro", f: "ebro", n: "Motor hasta 50 CV. Prohibido a menos de 200 m de la presa."},
    {id: 297, c: "Ebro", f: "ebro", n: "Motor hasta 20 CV. Zona no navegable junto a la central de Garoña."},
    {id: 299, c: "Ebro", f: "ebro", n: "Motor hasta 50 CV. Prohibido a menos de 200 m de la presa."},
    {id: 318, c: "Ebro", f: "ebro", n: "Tremp o San Antonio."},
    {id: 317, c: "Ebro", f: "ebro", n: "Motor hasta 50 CV. Cota mínima de navegación 665 m."},
    {id: 319, c: "Ebro", f: "ebro", n: "Ullivarri-Gamboa. Motor solo para servicios públicos. Navegación conjunta posible con Urrúnaga."},
    {id: 323, c: "Ebro", f: "ebro", n: "Remo y vela. Navegación conjunta posible con Ullivarri."},
    // Júcar (zona CEBRA: solo se navega con las embarcaciones confinadas)
    {id: 28,  c: "Júcar", f: "jucar", n: "Prohibido a menos de 250 m de la presa."},
    {id: 294, c: "Júcar", f: "jucar", n: "Prohibido a menos de 250 m de la presa."},
    {id: 358238, c: "Júcar", f: "jucar", n: "L'Alcora. Prohibido a menos de 250 m de la presa."},
    {id: 9,   c: "Júcar", f: "jucar", n: "Prohibido a menos de 250 m de la presa."},
    {id: 112, c: "Júcar", f: "jucar", n: "Solo se puede navegar entre la antigua presa de Embarcaderos y las boyas del tramo final."},
    {id: 126, c: "Júcar", f: "jucar", n: "Prohibido a menos de 200 m de la presa."},
    {id: 315, c: "Júcar", f: "jucar", n: "Prohibido a menos de 1.500 m de la presa. Motor de explosión limitado."},
    {id: 139, c: "Júcar", f: "jucar", n: "Prohibido a menos de 300 m de la presa."},
    {id: 23,  c: "Júcar", f: "jucar", n: "Motor de explosión limitado. Prohibido a menos de 250 m de la presa."},
    {id: 49,  c: "Júcar", f: "jucar", n: "Abastecimiento: motor ecológico o eléctrico. Prohibido a menos de 200 m de la presa."},
    {id: 31,  c: "Júcar", f: "jucar", n: "Mejillón cebra. Solo motor eléctrico, sin competiciones (salvo remo)."},
    // Guadalquivir (lista de las resoluciones de la CHG, sept. 2026)
    {id: 52,  c: "Guadalquivir", f: "guadalquivir", n: "Bermejales: mejillón cebra detectado en 2009."},
    {id: 171, c: "Guadalquivir", f: "guadalquivir", n: "Iznájar: mejillón cebra detectado en 2012."},
    {id: 376, c: "Guadalquivir", f: "guadalquivir", n: "La Breña II: mejillón cebra detectado en 2015."},
    {id: 104, c: "Guadalquivir", f: "guadalquivir", n: "Colomera: mejillón cebra detectado en 2016."},
    {id: 115, c: "Guadalquivir", f: "guadalquivir", n: "Cubillas: mejillón cebra detectado en 2018."},
    {id: 135, c: "Guadalquivir", f: "guadalquivir", n: "La Fernandina: mejillón cebra detectado en 2023."},
    {id: 312, c: "Guadalquivir", f: "guadalquivir_torre", n: "Confinado desde el 2 de septiembre de 2026. Autorización exclusiva de la CHG."},
    {id: 148, c: "Guadalquivir", f: "guadalquivir_giribaile", n: "Confinado desde el 24 de septiembre de 2026. Autorización exclusiva de la CHG."}
  ]
};
