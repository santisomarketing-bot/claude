# LinkedIn Opportunity Scanner

Scrollea tu feed de LinkedIn **con tu propia sesión** y te extrae las **oportunidades comerciales** para la agencia: gente/empresas que **necesitan marketing** (buscan agencia, se quejan de su proveedor, lanzan producto, no consiguen clientes…). Descarta ofertas de empleo y ruido publicitario.

## ⚠️ Aviso importante

Automatizar LinkedIn va **contra sus Términos de Servicio**. Esta herramienta usa **tu propia sesión** y un ritmo lento y humano para minimizar el riesgo, pero **el riesgo de bloqueo no es cero**. Úsala con criterio y con moderación. No metas credenciales en ningún sitio: inicias sesión tú a mano en tu navegador.

## Instalación (una vez)

```bash
npm install
npx playwright install chromium
```

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

Ejemplo más agresivo:

```bash
npm run scan -- --scrolls=40 --min-score=5 --out=barrido-lunes
```

## Afinar qué se considera oportunidad

Todo lo que dispara (o descarta) una oportunidad está en **`signals.mjs`**, en castellano y comentado:

- `SIGNALS` — frases que **suman** ("busco agencia", "no me funciona la publicidad"…), cada una con su peso.
- `DESCARTES` — frases que **tiran** el post (hiring, spam de grupos…).
- `IGNORAR_AUTORES` — marcas/anunciantes a ignorar.

Edítalo sin miedo: escribe siempre **en minúsculas y sin acentos** (el texto se normaliza antes de comparar).

## Cómo funciona (resumen honesto)

- Yo (Claude, en la nube) **no** puedo scrollear tu LinkedIn: no tengo tu sesión y hacerlo desde un servidor te arriesgaría la cuenta.
- Este script corre **en tu ordenador**, con **tu** navegador y **tu** login → LinkedIn te ve como tú.
- El filtrado es por palabras clave (rápido y transparente). El siguiente paso, si quieres, es pasar cada oportunidad por IA para redactar el mensaje de contacto y volcarla a HubSpot.
