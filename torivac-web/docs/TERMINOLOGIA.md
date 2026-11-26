# Terminología: «variador de tensión» no es «inverter»

## Qué pasaba
La traducción automática de la web original dejó, en inglés, **«variador de tensión» como «inverter» o «variable speed drive»**. Un variador de tensión es un
**autotransformador variable** (*variable autotransformer*, *variac*); un *inverter* convierte corriente continua en alterna y un *variable speed drive* regula la
velocidad de un motor. Eran nombres de producto equivocados (p. ej. «Single-phase manual variable speed drive», «Motorized three-phase inverter»), categorías, textos
de ficha, la portada y varios artículos.

## Qué se corrigió (solo inglés)
`data/catalog/terminology.curated.json` guarda 19 reglas; `site/lib/terminology.mjs` las aplica **en memoria al compilar** (los JSON de `data/catalog` no se tocan) y
`scripts/test-terminology.mjs` las comprueba (también en `qa-all.sh` y en el CI). Cada regla dice dónde se aplica (un producto, una categoría o una página), en qué campos y qué
frases cambian, y cita el texto en castellano del que parte. Si una frase deja de aparecer, el build lo avisa (`[TERMINOLOGÍA] sin efecto`).

| Antes (inglés) | Ahora |
|---|---|
| Single-phase manual variable speed drive | Single-phase manual voltage variator |
| Single-phase motorized inverter | Single-phase motorized voltage variator |
| Manual Three-Phase Inverter | Manual three-phase voltage variator |
| Motorized three-phase inverter | Motorized three-phase voltage variator |
| Single Phase Inverters (categoría) | Single-phase voltage variators |
| Three-phase drives (categoría) | Three-phase voltage variators |
| «Variable voltage drives» (portada) | Voltage variators |
| «Toroidal shocks» (portada) | Toroidal chokes |

Además se corrigieron los textos de las fichas 328, 874, 882, 886, 888 y 965, las categorías 19, 33, 37, 40 y 45, la portada, la página de productos y cuatro artículos.

**No se tocó** lo que sí es un inversor o un variador de velocidad: *Frequency inverters*, *PV / photovoltaic inverters*, *variable speed and frequency drives* en las
resistencias de frenado, *drive* en «drive shaft» ni los verbos («drives growth»).

## Lo que NO cambia
- **Las URL y los slugs** siguen siendo los de la web original (`/en/product/manual-three-phase-inverter/`, `/en/product-category/…/single-phase-inverters/`,
  `…/three-phase-drives/`), para no romper enlaces ni posicionamiento. Si se quiere que también la URL diga «voltage variator», hay que cambiar el slug y añadir una
  redirección 301 desde la antigua (decisión pendiente).
- **El castellano**, que es la fuente. Ojo: algunos textos de la ficha 328 en castellano mezclan «variador» de tensión con variador de velocidad («controlan la velocidad
  de los motores de inducción», «Alimenta, regula y controla un motor de CA», «los variadores suelen tener una eficiencia entre el 95 % y…»). Se tradujeron fielmente; el
  contenido en sí conviene que lo revise Torivac.

## Pendiente de validar: francés y alemán tienen el mismo error
No se aplicó nada en FR/DE (las traducciones las valida una persona, ver `TEXTOS-DE-INTERFAZ.md`). Encontrado:

| Producto / categoría | Francés ahora | Alemán ahora | Propuesta |
|---|---|---|---|
| 866 Variador monofásico manual | Variateur de vitesse manuel monophasé | Einphasiger manueller Antrieb mit variabler Geschwindigkeit | FR: Variateur de tension manuel monophasé · DE: Einphasiger manueller Stelltransformator |
| 867 Variador monofásico motorizado | Inverseur motorisé monophasé | Einphasiger motorisierter Wechselrichter | FR: Variateur de tension motorisé monophasé · DE: Einphasiger motorisierter Stelltransformator |
| 326 Variador trifásico manual | Onduleur triphasé manuel | (sin traducción) | FR: Variateur de tension triphasé manuel · DE: Dreiphasiger manueller Stelltransformator |
| 328 Variador trifásico motorizado | Inverseur motorisé triphasé | Dreiphasiger motorisierter Wechselrichter | FR: Variateur de tension triphasé motorisé · DE: Dreiphasiger motorisierter Stelltransformator |
| 308 Variador doble motorizado | Double inverseur motorisé | «Dubbele gemotoriseerde variator» (es neerlandés) | FR: Double variateur de tension motorisé · DE: Doppelter motorisierter Stelltransformator |
| Cat. 33 Variador doble | Double onduleur | Doppelter Wechselrichter | FR: Double variateur de tension · DE: Doppelter Stelltransformator |
| Cat. 37 Variadores monofásicos | Onduleurs monophasés | Einphasen-Wechselrichter | FR: Variateurs de tension monophasés · DE: Einphasige Stelltransformatoren |
| Cat. 40 Variadores trifásicos | Entraînements triphasés | Dreiphasige Antriebe | FR: Variateurs de tension triphasés · DE: Dreiphasige Stelltransformatoren |

Los términos propuestos son los habituales en el sector (*variateur de tension / autotransformateur variable*, *Stelltransformator*); conviene que los confirme una
persona que conozca el vocabulario técnico antes de aplicarlos. Para aplicarlos, basta añadir reglas con `lang: "fr"` o `"de"` al mismo archivo.
