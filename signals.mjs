// ============================================================================
//  SEÑALES DE OPORTUNIDAD  —  edita este fichero para afinar la busqueda
// ============================================================================
//
//  Buscamos personas/empresas que NECESITAN marketing.
//  NO buscamos ofertas de empleo / "estamos contratando" (eso se descarta abajo).
//
//  Cada señal tiene:
//    - patrones: expresiones (en minusculas, sin acentos) que disparan la señal
//    - peso: cuanto suma al score de la oportunidad (mas peso = mas caliente)
//
//  El texto de cada post se normaliza (minusculas, sin acentos) antes de comparar,
//  asi que aqui escribimos siempre sin acentos: "campana", no "campaña".
// ============================================================================

export const SIGNALS = [
  {
    id: "busca-agencia",
    etiqueta: "Busca agencia / freelance",
    peso: 10,
    patrones: [
      "busco agencia", "buscamos agencia", "recomendais agencia", "recomendais alguna agencia",
      "recomendais a alguien", "conoceis agencia", "alguna agencia de", "necesito una agencia",
      "busco freelance", "busco community manager", "busco alguien que lleve", "alguien que gestione",
      "que me lleve las redes", "que me lleve el marketing", "llevar mis redes", "gestionar mis redes",
      "recomendais community manager", "busco social media", "necesito community manager",
      "busco consultor de marketing", "busco experto en", "recomendaciones de agencia",
    ],
  },
  {
    id: "necesita-marketing",
    etiqueta: "Expresa necesidad de marketing/visibilidad",
    peso: 7,
    patrones: [
      "necesito ayuda con", "necesito mejorar", "no se como hacer marketing", "no se por donde empezar",
      "quiero mejorar mi presencia", "mejorar mi visibilidad", "darme a conocer", "conseguir mas clientes",
      "conseguir mas leads", "generar leads", "captar clientes", "atraer clientes", "no me llegan clientes",
      "necesito vender mas", "quiero vender mas", "aumentar ventas", "necesito una web", "quiero una web",
      "rehacer la web", "renovar la web", "necesito una tienda online", "montar un ecommerce",
      "posicionar mi marca", "trabajar mi marca", "estrategia de contenidos", "plan de marketing",
      "no tengo tiempo para las redes", "las redes me superan", "no controlo las redes",
    ],
  },
  {
    id: "queja-proveedor",
    etiqueta: "Queja del proveedor / resultados actuales",
    peso: 9,
    patrones: [
      "no me funciona la publicidad", "no me funcionan los anuncios", "tirando el dinero",
      "malas experiencias con agencias", "mi agencia no", "cambiar de agencia", "dejar mi agencia",
      "decepcionado con la agencia", "no veo resultados", "no consigo resultados", "sin resultados",
      "el ads no me", "meta ads no", "google ads no me funciona", "gasto en publicidad y",
      "harto de agencias", "estafa agencia", "me han fallado",
    ],
  },
  {
    id: "lanzamiento",
    etiqueta: "Lanza producto/negocio (visibilidad justo ahora)",
    peso: 5,
    // Solo primera persona: quien LANZA algo suyo, no quien habla de emprender.
    // (Nada de "emprendimiento"/"nuevo proyecto"/"nueva marca" a secas: en un feed
    //  lleno de profesionales del marketing eso son falsos positivos constantes.)
    patrones: [
      "lanzo mi", "acabo de lanzar", "acabamos de lanzar", "estamos lanzando mi",
      "abro mi negocio", "acabo de montar", "hemos montado", "acabamos de abrir",
      "presentamos nuestra nueva marca", "en fase de lanzamiento",
    ],
  },
  {
    id: "pide-recomendacion",
    etiqueta: "Pide recomendaciones/herramientas de marketing",
    peso: 4,
    patrones: [
      "que herramienta recomendais", "que me recomendais para", "como conseguir seguidores",
      "como hacer crecer", "consejos para redes", "ayuda con instagram", "ayuda con tiktok",
      "ayuda con linkedin", "como hago publicidad", "como empiezo con ads", "dudas sobre marketing",
    ],
  },
];

// ----------------------------------------------------------------------------
//  DESCARTES DUROS: si el post encaja aqui, se tira aunque tenga señales.
//  (El usuario NO quiere ofertas de empleo / hiring, ni spam de grupos.)
// ----------------------------------------------------------------------------
export const DESCARTES = [
  "estamos contratando", "buscamos incorporar", "oferta de empleo", "nueva vacante", "vacante",
  "we are hiring", "we're hiring", "estamos buscando talento", "unete a nuestro equipo",
  "unete al equipo", "buscamos perfil", "buscamos un", "buscamos una", "buscamos a un", "buscamos a una",
  "apply now", "aplica aqui", "envia tu cv", "manda tu cv", "posicion abierta", "job opening",
  "hiring", "reclutando", "seleccionamos", "incorporamos", "nueva posicion",
  // spam de grupos / cadenas
  "join our group", "unete al grupo", "add me", "follow for follow", "sigueme y te sigo",
];

// ----------------------------------------------------------------------------
//  Marcas/anunciantes a ignorar como lead (posts promocionados de grandes marcas).
//  Amplia esta lista con lo que veas que es puro anuncio.
// ----------------------------------------------------------------------------
export const IGNORAR_AUTORES = [
  "notion", "l'oreal", "loreal", "gucci", "visiotech", "pmfarma", "julius baer", "amazon",
  "microsoft", "google", "linkedin", "meta", "adobe",
];
