# LinkedIn Opportunity Scanner

Scrollea tu feed de LinkedIn **con tu propia sesión** y te extrae las **oportunidades comerciales** para la agencia: gente/empresas que **necesitan marketing** (buscan agencia, se quejan de su proveedor, lanzan producto, no consiguen clientes…). Descarta ofertas de empleo y ruido publicitario.

> 📬 **Envío diario por correo:** además del escáner manual, hay una automatización
> que cada día a las 17:00 (hora España) busca posts públicos de "busco agencia" y
> te los manda por email. Ver **[DAILY_LEADS.md](./DAILY_LEADS.md)**.

> 📍 **Google Maps / Local SEO en masa:** mismo patrón (tu sesión, ritmo humano) pero
> para sacar CID/Place ID/NAP+ de negocios, ver ranking en el local pack por ciudad o cuadrícula
> geográfica, o encontrar negocios con poca presencia digital como leads de SEO local.
> Ver **[MAPS_SCAN.md](./MAPS_SCAN.md)**.

> 🔍 **Análisis de SERP de Google:** AI Overview, Ads y Local Pack en una búsqueda normal
> (no Maps). Ver **[SERP_SCAN.md](./SERP_SCAN.md)**.

> ⏰ **Rastreos programados:** cómo automatizar corridas periódicas de estos scripts en tu propia
> máquina (Programador de tareas de Windows) para armar histórico sin lanzarlas a mano cada vez.
> Ver **[SCHEDULED_SCANS.md](./SCHEDULED_SCANS.md)**.

> 📇 **NAP-W (directorios locales):** en qué directorios locales aparece un negocio (y en
> cuáles no) para priorizar altas. Ver **[NAPW_CHECK.md](./NAPW_CHECK.md)**.

## ⚠️ Aviso importante

Automatizar LinkedIn va **contra sus Términos de Servicio**. Esta herramienta usa **tu propia sesión** y un ritmo lento y humano para minimizar el riesgo, pero **el riesgo de bloqueo no es cero**. Úsala con criterio y con moderación. No metas credenciales en ningún sitio: inicias sesión tú a mano en tu navegador.

## Instalación (una vez)

```bash
npm install
npx playwright install chromium
```

## 🟢 Modo seguro recomendado: sobre un HTML guardado (SIN riesgo)

La opción con **cero riesgo de bloqueo** es no automatizar nada: abres LinkedIn tú
mismo (feed, o mejor una **búsqueda**), guardas la página (`Ctrl+S` → "Página web
completa" o "Solo HTML") y le pasas el fichero al script:

```bash
npm run scan -- --html=mi-busqueda.html --debug
```

Esto corre el **mismo motor de extracción y filtrado** sobre el HTML guardado, sin
tocar LinkedIn. Es la forma ideal de probar y afinar `signals.mjs`.

> **El origen importa más que la herramienta.** Tu feed personal está lleno de
> colegas del marketing y anuncios → casi ningún comprador. Donde esto brilla es
> sobre una **búsqueda** de LinkedIn con intención de compra, p. ej.:
> `"busco agencia de marketing"`, `"recomendáis agencia"`, `"necesito llevar mis redes"`.
> Guarda esa página de resultados y pásala con `--html`.

### Modo en vivo (scroll automático) — más cómodo, algo de riesgo

## 1) Iniciar sesión (una vez)

```bash
npm run login
```

Se abre un Chrome. Inicia sesión en LinkedIn a mano. Cuando veas tu feed, vuelve a la terminal y pulsa **ENTER**. La sesión queda guardada en `.chrome-profile/` (no se sube a git).

## 2) Escanear

```bash
npm run scan -- --scrolls=25
```

Hace 25 scrolls, extrae los posts y te deja:

- `leads.csv` — ábrelo en Excel/Google Sheets
- `leads.json` — para automatizar después (HubSpot, etc.)

Y te imprime el TOP 10 en la terminal.

### Opciones

| Flag | Qué hace | Def. |
|------|----------|------|
| `--scrolls=N` | nº de scrolls | 25 |
| `--min-score=N` | score mínimo para contar como oportunidad | 4 |
| `--out=nombre` | nombre base de los ficheros de salida | `leads` |
| `--delay=MS` | pausa entre scrolls (ritmo humano) | 2500 |
| `--html=fichero` | modo offline: analiza un HTML guardado (sin tocar LinkedIn) | — |
| `--debug` | muestra la disposición de cada post (✓ oportunidad / ✗ descarte / · bajo umbral) | — |

> Si ya tienes un Chromium en el sistema y no quieres que Playwright descargue el
> suyo, exporta `CHROME_PATH=/ruta/al/chrome` antes de lanzar el comando.

### Validado con feeds reales

- Posts con intención real ("estamos buscando agencia…", "no me funciona la
  publicidad, harto de agencias", "acabo de abrir y necesito darme a conocer") →
  **detectados** con score alto.
- Anuncios (marcados "Promocionado") y ofertas de empleo → **descartados solos**.
- Un feed personal lleno de profesionales del marketing → **0 falsos positivos**
  (por eso conviene apuntar a búsquedas, no al feed de inicio).

Ejemplo más agresivo:

```bash
npm run scan -- --scrolls=40 --min-score=5 --out=barrido-lunes
```

## Afinar qué se considera oportunidad

Todo lo que dispara (o descarta) una oportunidad está en **`signals.mjs`**, en castellano y comentado:

- `SIGNALS` — frases que **suman** ("busco agencia", "no me funciona la publicidad"…), cada una con su peso.
- `DESCARTES` — frases que **tiran** el post (hiring, spam de grupos…).
- `IGNORAR_AUTORES` — marcas/anunciantes a ignorar (los anuncios "Promocionado" ya se descartan solos).

Truco para afinar: corre con `--html=... --min-score=1 --debug` y mira qué frase
dispara cada post. Si algo cuela, añade la frase a `DESCARTES`; si algo real se
escapa, añade su frase a la señal correspondiente en `SIGNALS`.

Edítalo sin miedo: escribe siempre **en minúsculas y sin acentos** (el texto se normaliza antes de comparar).

## Cómo funciona (resumen honesto)

- Yo (Claude, en la nube) **no** puedo scrollear tu LinkedIn: no tengo tu sesión y hacerlo desde un servidor te arriesgaría la cuenta.
- Este script corre **en tu ordenador**, con **tu** navegador y **tu** login → LinkedIn te ve como tú.
- El filtrado es por palabras clave (rápido y transparente). El siguiente paso, si quieres, es pasar cada oportunidad por IA para redactar el mensaje de contacto y volcarla a HubSpot.
