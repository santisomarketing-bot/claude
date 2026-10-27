# 05 · Análisis del árbol de categorías de grupotorivac.com

> Informe de la tarea "árbol de categorías" (generado el 2026-10-27, solo con ficheros locales, sin peticiones de red).  
> Datos completos y trazables en `data/analysis/categories-analysis.json` (cada categoría lleva su campo `source`).  
> Regla aplicada: los datos son los de la web original tal cual (erratas incluidas, anotadas en `quality_flags`); lo que no consta en las fuentes va a `null` y a la lista de huecos (apartado 7).

## 1. Resumen

La web actual (WooCommerce + WPML) tiene **91 categorías de producto en español** (82 en inglés, 82 en francés, 82 en alemán), repartidas en **25 raíces** y hasta **3 niveles**. Los **80 productos** están publicados. De las 91 categorías, **12 están vacías**, **11 se proponen fusionar** (duplicadas, casi duplicadas o con nombre de producto), **10 no tienen traducción en ningún idioma** y 4 productos cuelgan de "Sin categorizar".

Lo más importante:

1. **Raíces duplicadas y vacías.** "Equipos de sobremesa" existe 3 veces, "Equipos industriales" 2, "Fabricaciones a medida" 2 (más "Fabricación a medida" como hija de Variadores), "Portaled"/"Portaleds", "Hembrillas"/"Hembrillas de seguridad", "Botones de mando"/"Botones de mando y accesorios" y "Potenciómetros y reóstatos"/"Reostatos y potenciómetros bobinados". Las copias están vacías, sin enlaces entrantes y fuera del sitemap: son restos de estructuras anteriores.
2. **53 de las 91 URLs de categoría en español no son una categoría.** Cada categoría con un único producto sirve la ficha de ese producto (clase `single-product` y canonical al producto). En EN/FR/DE ocurre en 53/53/52 URLs, y en 37/38/35 de ellas el canonical apunta a la ficha en **español** (canonical cruzado entre idiomas).
3. **La estructura "Equipos de sobremesa" es incoherente.** La categoría que está en uso (45, slug `en-caja`) cuelga de Variadores de tensión y contiene tres hijas ("En caja", "Variador de tensión industriales", "Cuba de aceite"); el contenido industrial real está anidado ahí, mientras que las dos raíces "Equipos industriales" están vacías.
4. **Contadores desfasados** en 7 categorías (la rama "Equipos electrónicos" declara 0 productos y tiene 11), por lo que `/productos/` no muestra su recuento.
5. **Traducciones.** 10 categorías ES sin equivalente en ningún idioma, 29 traducciones dudosas (variador traducido como inversor/onduleur/Wechselrichter, "Manual" como "Handbuch", "Portaled" como "Porté"/"Portiert") y nombres y slugs del alemán que están en **neerlandés** en muchas categorías (detección por vocabulario, requiere revisión nativa).
6. **Encabezados.** Todos los archivos de categoría saltan de H1 a H3 sin H2 (38/38 en ES; 28/28 EN, 28/28 FR, 29/29 DE).

**Propuesta:** pasar de 91 a **79 categorías** y de 25 a **13 raíces**, sin cambiar el padre de ninguna categoría que se conserva, fusionando 11 categorías vacías o duplicadas con 301, vaciando "Sin categorizar" y reasignando 5 productos. Todos los nombres, en los cuatro idiomas, salen de categorías existentes; donde falta la traducción queda `null`. Se conserva el slug (y por tanto la URL) de la categoría canónica de cada grupo. Hay **8 decisiones** que debe tomar el usuario (apartado 6).

### Cifras de partida (verificadas contra los datos en bruto)

| Dato | Valor |
|---|---|
| Categorías por idioma (ES / EN / FR / DE) | 91 / 82 / 82 / 82 |
| Raíces ES · profundidad máxima | 25 · 3 niveles |
| Categorías ES con traducción a los 3 idiomas | 81 (243 enlaces: 96 por `hreflang` y 147 por productos y jerarquía; sin discrepancias entre métodos) |
| Categorías ES sin ninguna traducción | 10 (ids 25, 31, 32, 36, 47, 49, 99, 102, 699, 700) |
| Categorías solo en otros idiomas | 1 ("2x3W", EN 631 / FR 632 / DE 633, 0 productos) |
| Categorías vacías (ES) | 12 |
| Contadores de WooCommerce desfasados (ES) | 7 |
| Productos ES | 80 (todos publicados) |
| Productos en "Sin categorizar" (ES) | 4 (155, 878, 905, 909) |
| Productos en más de una categoría | 46 (casi todos "hoja + ancestros"; 1 en ramas distintas) |
| URLs ES de categoría que son archivo real / sirven una ficha de producto | 38 / 53 |
| URLs ES de categoría en `product_cat-sitemap.xml` | 79 (todas en español) |

## 2. Árbol actual (tal cual está hoy)

Hijos ordenados por nombre. Columnas: **Prod.** = productos con esa categoría asignada directamente / total con descendientes (cálculo propio sobre `product.product_cat`); **WP** = campo `count` que declara WooCommerce; **Idiomas** = traducciones enlazadas (EN·FR·DE); **URL ES** = qué sirve la URL en español.

| ID | Categoría (ES) | Slug ES | Prod. | WP | Idiomas | URL ES | Notas |
|---:|---|---|---:|---:|---|---|---|
| 22 | Bobinas encapsuladas | `bobinas-encapsuladas` | 2/2 | 2 | 515·512·518 | archivo |  |
| 119 | &emsp;↳ Cuadradas | `cuadradas` | 1/1 | 1 | 578·579·580 | ficha de producto |  |
| 118 | &emsp;↳ Redondas | `redondas` | 1/1 | 1 | 516·514·519 | ficha de producto |  |
| 30 | Botones de mando | `botones-de-mando` | 9/11 | 11 | 569·570·571 | archivo |  |
| 77 | &emsp;↳ Aros con flecha | `aros-con-flecha` | 1/1 | 1 | 658·659·660 | ficha de producto |  |
| 74 | &emsp;↳ Botones de mando serie BM (Mate) | `botones-de-mando-serie-bm-mate` | 1/1 | 1 | 661·662·663 | ficha de producto |  |
| 72 | &emsp;↳ Botones de mando serie BO (brillante) | `botones-de-mando-serie-bo-brillante` | 1/1 | 1 | 664·665·666 | ficha de producto |  |
| 73 | &emsp;↳ Botones de mando Serie BO con linea | `botones-de-mando-serie-bo-con-linea` | 1/1 | 1 | 667·668·669 | ficha de producto |  |
| 82 | &emsp;↳ Caratulas graduadas | `caratulas-graduadas` | 1/1 | 1 | 670·671·672 | ficha de producto |  |
| 80 | &emsp;↳ Cubretercas | `cubretercas` | 1/1 | 1 | 673·674·675 | ficha de producto |  |
| 81 | &emsp;↳ Discos Flecha | `discos-flecha` | 1/1 | 1 | 676·677·678 | ficha de producto |  |
| 78 | &emsp;↳ Discos graduados | `discos-graduados` | 1/1 | 1 | 679·680·681 | ficha de producto |  |
| 442 | &emsp;↳ Estators | `estators` | 1/1 | 1 | 682·683·684 | ficha de producto |  |
| 76 | &emsp;↳ Tapas Serie BM | `tapas-serie-bm` | 1/1 | 1 | 685·686·687 | ficha de producto |  |
| 75 | &emsp;↳ Tapas serie BO | `tapas-serie-bo` | 1/1 | 1 | 688·689·690 | ficha de producto |  |
| 27 | Botones de mando y accesorios | `botones-de-mando-y-accesorios` | 1/1 | 1 | 550·452·447 | ficha de producto |  |
| 63 | Choques \| Inductancias \| Reactancias toroidales | `choques` | 1/1 | 1 | 572·573·574 | ficha de producto |  |
| 50 | Comunicación MODBUS | `comunicacion-modbus` | 0/0 | 0 | 693·694·695 | archivo | vacía |
| 31 | Controlador 0-10VDC | `controlador-0-10vdc` | 0/0 | 0 | ninguno | archivo | vacía |
| 39 | Equipos de sobremesa | `equipos-de-sobremesa` | 0/0 | 0 | 593·594·595 | archivo | vacía |
| 46 | Equipos de Sobremesa | `equipos-de-sobremesa-en-caja` | 0/0 | 1 | 598·597·596 | archivo | vacía, contador desfasado |
| 96 | Equipos electrónicos | `electronica` | 11/11 | 0 | 492·489·495 | archivo | contador desfasado |
| 101 | &emsp;↳ Control industrial | `control-industrial` | 2/2 | 0 | 493·490·554 | archivo | contador desfasado |
| 97 | &emsp;↳ Convertidores | `convertidores` | 1/1 | 0 | 503·502·501 | ficha de producto | contador desfasado |
| 100 | &emsp;↳ Energias renovables | `energias-renovables` | 4/4 | 0 | 494·496·497 | archivo | contador desfasado |
| 99 | &emsp;↳ Fuente de alimentación CA | `fuente-de-alimentacion-ca` | 1/1 | 0 | ninguno | ficha de producto | contador desfasado |
| 98 | &emsp;↳ Fuentes de alimentación CC | `fuentes-de-alimentacion-cc` | 2/2 | 0 | 499·498·500 | archivo | contador desfasado |
| 36 | Equipos industriales | `equipos-industriales` | 0/0 | 0 | ninguno | archivo | vacía |
| 47 | Equipos industriales | `equipos-industriales-en-caja` | 0/0 | 0 | ninguno | archivo | vacía |
| 60 | Estabilizadores de tensión | `estabilizadores-de-tension` | 1/5 | 5 | 463·523·525 | archivo |  |
| 61 | &emsp;↳ Estabilizadores Serie AVS: electromecánicos con servomotor | `serie-avs` | 0/2 | 2 | 607·608·609 | archivo |  |
| 103 | &emsp;&emsp;↳ Monofásico | `monofasico-serie-avs` | 1/1 | 1 | 613·614·615 | ficha de producto |  |
| 104 | &emsp;&emsp;↳ Trifásico | `trifasico-serie-avs` | 1/1 | 1 | 616·617·618 | ficha de producto |  |
| 62 | &emsp;↳ Serie BAVS: Electrónicos | `serie-bavs` | 0/2 | 2 | 610·611·612 | archivo |  |
| 105 | &emsp;&emsp;↳ Monofásico | `monofasico-serie-bavs` | 1/1 | 1 | 622·623·624 | ficha de producto |  |
| 106 | &emsp;&emsp;↳ Trifásico | `trifasico-serie-bavs` | 1/1 | 1 | 619·620·621 | ficha de producto |  |
| 49 | Fabricaciones a Medida | `fabricaciones-a-medida` | 0/0 | 0 | ninguno | archivo | vacía |
| 102 | Fabricaciones a medida | `fabricaciones-a-medida-transformadores-toroidales` | 0/0 | 0 | ninguno | archivo | vacía |
| 83 | Hembrillas | `hembrillas` | 1/4 | 4 | 575·576·577 | archivo |  |
| 85 | &emsp;↳ Hembrilla de seguridad HBS4 | `hembrilla-de-seguridad-hbs4` | 1/1 | 1 | 647·652·653 | ficha de producto |  |
| 86 | &emsp;↳ hembrilla de seguridad HR4 | `hembrilla-de-seguridad-hr4` | 1/1 | 1 | 649·656·657 | ficha de producto |  |
| 87 | &emsp;↳ Hembrilla de seguridad HSR4 | `hembrilla-de-seguridad-hsr4` | 1/1 | 1 | 648·654·655 | ficha de producto |  |
| 84 | &emsp;↳ Hembrilla HB4 | `hembrilla-hb4` | 1/1 | 1 | 646·650·651 | ficha de producto |  |
| 25 | Hembrillas de seguridad | `hembrillas-de-seguridad` | 0/0 | 0 | ninguno | archivo | vacía |
| 64 | Nucleos | `nucleos` | 1/1 | 1 | 560·561·562 | ficha de producto |  |
| 65 | Portaled | `portaled` | 0/4 | 4 | 563·564·565 | archivo |  |
| 69 | &emsp;↳ led 10mm | `led-10mm` | 1/1 | 1 | 642·634·635 | ficha de producto |  |
| 66 | &emsp;↳ led 3mm | `led-3mm` | 1/1 | 1 | 645·636·637 | ficha de producto |  |
| 67 | &emsp;↳ led 5mm | `led-5mm` | 1/1 | 1 | 644·638·640 | ficha de producto |  |
| 68 | &emsp;↳ led 8mm | `led-8mm` | 1/1 | 1 | 643·639·641 | ficha de producto |  |
| 24 | Portaleds | `portaleds` | 0/0 | 0 | 696·697·698 | archivo | vacía |
| 26 | Potenciómetros y reóstatos | `potenciometros-y-reostatos` | 0/0 | 0 | 566·567·568 | archivo | vacía |
| 122 | Reostatos y potenciómetros bobinados | `reostatos-y-potenciometros-bobinados` | 1/9 | 9 | 521·520·522 | archivo |  |
| 107 | &emsp;↳ Potenciometros | `potenciometros` | 3/3 | 3 | 599·600·601 | archivo |  |
| 111 | &emsp;&emsp;↳ Dobles | `dobles-potenciometros` | 1/1 | 1 | 627·628·629 | ficha de producto |  |
| 108 | &emsp;&emsp;↳ Simples | `simples` | 2/2 | 2 | 630·602·603 | archivo |  |
| 112 | &emsp;↳ Reóstatos cerámicos | `ceramicos` | 5/5 | 5 | 485·483·487 | archivo |  |
| 88 | Resistencias \| Bancos de carga | `resistencias` | 7/7 | 7 | 476·474·478 | archivo |  |
| 93 | &emsp;↳ Bancos de carga | `bancos-de-carga` | 1/1 | 1 | 508·506·510 | ficha de producto |  |
| 92 | &emsp;↳ Cementadas | `cementadas` | 1/1 | 1 | 482·480·484 | ficha de producto |  |
| 120 | &emsp;↳ En caja | `en-caja-resistencias` | 1/1 | 1 | 477·475·479 | ficha de producto |  |
| 90 | &emsp;↳ Helicoidales | `helicoidales` | 1/1 | 1 | 488·486·491 | ficha de producto |  |
| 94 | &emsp;↳ Resistencias de arranque | `resistencias-de-arranque` | 1/1 | 1 | 511·509·513 | ficha de producto |  |
| 444 | &emsp;↳ Resistencias de frenado | `resistencias-de-frenado` | 1/1 | 1 | 481·691·692 | ficha de producto |  |
| 95 | &emsp;↳ Resistencias de puesta a tierra | `resistencias-de-puesta-a-tierra` | 1/1 | 1 | 505·504·507 | ficha de producto |  |
| 18 | Sin categorizar | `sin-categorizar` | 4/4 | 4 | 517·451·446 | archivo | categoría por defecto de WooCommerce |
| 51 | Transformadores | `transformadores` | 2/6 | 6 | 456·469·453 | archivo |  |
| 56 | &emsp;↳ Transformador convencional | `transformador-convencional` | 3/3 | 3 | 464·466·460 | archivo |  |
| 57 | &emsp;&emsp;↳ Serie TC | `serie-tc` | 1/1 | 1 | 465·467·461 | ficha de producto |  |
| 58 | &emsp;&emsp;↳ Serie TCE | `serie-tce` | 1/1 | 1 | 472·524·468 | ficha de producto |  |
| 59 | &emsp;&emsp;↳ TCT | `tct` | 1/1 | 1 | 527·526·528 | ficha de producto |  |
| 52 | &emsp;↳ Transformadores toroidales | `transformadores-toroidales-transformadores` | 3/3 | 3 | 457·470·454 | archivo |  |
| 55 | &emsp;&emsp;↳ Serie TCi (encapsulado para circuito impreso) | `serie-tci` | 1/1 | 1 | 459·473·462 | ficha de producto |  |
| 54 | &emsp;&emsp;↳ Serie TE | `serie-te` | 1/1 | 1 | 458·471·455 | ficha de producto |  |
| 53 | &emsp;&emsp;↳ Serie TT | `serie-tt` | 1/1 | 1 | 530·529·531 | ficha de producto |  |
| 19 | Variadores de tensión - Autotransformadores regulables | `variadores-de-tension` | 9/15 | 15 | 448·532·533 | archivo |  |
| 29 | &emsp;↳ Accesorios de regulación | `accesorios-de-regulacion` | 3/3 | 3 | 449·546·555 | archivo |  |
| 45 | &emsp;↳ Equipos de sobremesa | `en-caja` | 1/3 | 3 | 590·591·592 | archivo |  |
| 32 | &emsp;&emsp;↳ Cuba de aceite | `cuba-de-aceite` | 0/0 | 0 | ninguno | archivo | vacía |
| 700 | &emsp;&emsp;↳ En caja | `variador-de-tension-en-caja` | 1/1 | 1 | ninguno | ficha de producto |  |
| 699 | &emsp;&emsp;↳ Variador de tensión industriales | `variador-de-tension-industriales` | 1/1 | 1 | ninguno | ficha de producto |  |
| 28 | &emsp;↳ Fabricación a medida | `fabricacion-a-media` | 1/1 | 1 | 450·549·556 | ficha de producto |  |
| 33 | &emsp;↳ Variador Doble | `dobles` | 2/2 | 2 | 581·582·583 | archivo |  |
| 44 | &emsp;&emsp;↳ Doble manual | `doble-manual` | 1/1 | 1 | 584·585·586 | ficha de producto |  |
| 34 | &emsp;&emsp;↳ Doble motorizado | `doble-motorizado` | 1/1 | 1 | 587·588·589 | ficha de producto |  |
| 37 | &emsp;↳ Variadores Monofasicos | `monofasico` | 2/2 | 2 | 536·534·557 | archivo |  |
| 38 | &emsp;&emsp;↳ Manual | `monofasicos-manual` | 1/1 | 1 | 543·540·559 | ficha de producto |  |
| 43 | &emsp;&emsp;↳ Motorizado | `motorizado-monofasico` | 1/1 | 1 | 537·535·558 | ficha de producto |  |
| 40 | &emsp;↳ Variadores Trifásicos | `trifasico` | 1/2 | 2 | 544·541·538 | archivo |  |
| 41 | &emsp;&emsp;↳ Manual | `manual-trifasico` | 1/1 | 1 | 545·542·626 | ficha de producto |  |
| 42 | &emsp;&emsp;↳ Motorizado | `motorizado` | 1/1 | 1 | 548·547·539 | ficha de producto |  |

Además existe `2x3W` (EN 631, FR 632, DE 633), sin categoría ES y sin productos.

Rutas completas, nombres y slugs en los 4 idiomas, descripciones, imagen y SEO de cada categoría: `data/analysis/categories-analysis.json` → `tree.nodes[]` (campos `name`, `slug`, `url`, `description`, `image`, `seo`, `archive_page`).

## 3. Problemas detectados

### 3.1 Categorías duplicadas o casi duplicadas

| Grupo | Categorías | Qué cuelga de cada una | Recomendación | Decisión |
|---|---|---|---|---|
| D01 'Equipos de sobremesa' x3 | 45 «Equipos de sobremesa»; 39 «Equipos de sobremesa»; 46 «Equipos de Sobremesa» | 45: 306; 39: sin productos propios; 46: sin productos propios | fusionar 39 y 46 en 45 con 301; descartar las raíces vacías | no |
| D02 'Equipos industriales' x2 | 36 «Equipos industriales»; 47 «Equipos industriales» | 36: sin productos propios; 47: sin productos propios | fusionar 36 y 47 en 699 con 301 (o, si se decide, promover 699 a hermana de 45 con el nombre 'Equipos industriales') | D2 |
| D03 'Fabricaciones a medida' x2 (+ 'Fabricación a medida') | 49 «Fabricaciones a Medida»; 102 «Fabricaciones a medida»; 28 «Fabricación a medida» | 49: sin productos propios; 102: sin productos propios; 28: 294 | dejar una sola raíz 'Fabricaciones a medida' (slug de 49, nombre de 102) para el servicio transversal y mantener 28 como hija de Variadores; asignar 878 a la raíz | D1 |
| D04 'Portaled' / 'Portaleds' | 65 «Portaled»; 24 «Portaleds» | 65: sin productos propios; 24: sin productos propios | mantener URL/slug de 65 y fusionar 24 con 301; nombre visible a decidir ('Portaled' vs 'Portaleds') | D3 |
| D05 'Hembrillas' / 'Hembrillas de seguridad' | 83 «Hembrillas»; 25 «Hembrillas de seguridad» | 83: 954; 25: sin productos propios | fusionar 25 en 83 con 301 | no |
| D06 'Botones de mando' / 'Botones de mando y accesorios' | 30 «Botones de mando»; 27 «Botones de mando y accesorios» | 30: 936, 938, 940, 942, 943, 945, 947, 949, 951; 27: 155 | fusionar 27 en 30 y mover el producto 155 a 'Tapas Serie BM' (76) | D5 |
| D07 'Potenciómetros y reóstatos' en tres categorías | 122 «Reostatos y potenciómetros bobinados»; 26 «Potenciómetros y reóstatos»; 107 «Potenciometros» | 122: 904; 26: sin productos propios; 107: 906, 907, 908 | fusionar 26 en 122 con 301; 107 se mantiene como hija | no |
| D08 'Accesorios de regulación' y raíces con nombre de producto | 29 «Accesorios de regulación»; 31 «Controlador 0-10VDC»; 50 «Comunicación MODBUS» | 29: 301, 304, 882; 31: sin productos propios; 50: sin productos propios | fusionar 31 y 50 en 29 con 301 (alternativa: dejarlas como hijas de 29) | D4 |
| D09 Mismo nombre bajo padres distintos (aceptable por la jerarquía) | 38 «Manual»; 41 «Manual»; 42 «Motorizado»; 43 «Motorizado»; 103 «Monofásico»; 105 «Monofásico»; 104 «Trifásico»; 106 «Trifásico»; 120 «En caja»; 700 «En caja» | 38: 866; 41: 326; 42: 328; 43: 867; 103: 897; 105: 900; 104: 898; 106: 901; 120: 15355; 700: 874 | no fusionar; mostrar siempre el padre en migas, filtros y presupuesto, y diferenciar el título SEO | no |

Pruebas por grupo (ids, slugs, descripciones, enlaces entrantes, sitemap): `duplicates.groups[].evidence`. Además hay descripciones copiadas entre categorías distintas (`duplicates.same_description`): 19 y 49 (Variadores y la raíz vacía "Fabricaciones a Medida"); 38 y 41 ("Manual"); 42 y 43 ("Motorizado"); y 96, 98, 100 y 101 ("Equipos electrónicos" y sus tres hijas con el mismo texto de ingeniería).

En EN/FR/DE las dos raíces duplicadas de "Equipos de sobremesa" se tradujeron igual (EN "Benchtop Units", FR "Unités de paillasse", DE "Tafelmodellen") mientras que la que está en uso se tradujo distinto (EN "Desktop equipment", FR "Équipement de bureau", DE "Schreibtischgeräte").

### 3.2 Categorías vacías (12)

WooCommerce las oculta en la Store API; no salen en `/shop/`, ni en el sitemap, y ninguna recibe enlaces internos (salvo 32, con 1).

| ID | Nombre | Slug | Traducciones | Observación |
|---:|---|---|---|---|
| 24 | Portaleds | `portaleds` | EN 696 · FR 697 · DE 698 | duplicada de 65 «Portaled» |
| 25 | Hembrillas de seguridad | `hembrillas-de-seguridad` | ninguna | duplicada de 83 «Hembrillas» |
| 26 | Potenciómetros y reóstatos | `potenciometros-y-reostatos` | EN 566 · FR 567 · DE 568 | duplicada de 122 (nombre invertido) |
| 31 | Controlador 0-10VDC | `controlador-0-10vdc` | ninguna | nombre de producto (producto 304 ya está en 29) |
| 32 | Cuba de aceite | `cuba-de-aceite` | ninguna | hija de 45 con descripción propia; el producto 306 «Cuba de aceite» está en 45 |
| 36 | Equipos industriales | `equipos-industriales` | ninguna | duplicada (36 y 47) |
| 39 | Equipos de sobremesa | `equipos-de-sobremesa` | EN 593 · FR 594 · DE 595 | duplicada de 45 |
| 46 | Equipos de Sobremesa | `equipos-de-sobremesa-en-caja` | EN 598 · FR 597 · DE 596 | duplicada de 45; contador desfasado (declara 1) |
| 47 | Equipos industriales | `equipos-industriales-en-caja` | ninguna | duplicada (36 y 47) |
| 49 | Fabricaciones a Medida | `fabricaciones-a-medida` | ninguna | descripción copiada de 19 (Variadores) |
| 50 | Comunicación MODBUS | `comunicacion-modbus` | EN 693 · FR 694 · DE 695 | nombre de producto (producto 882 ya está en 29) |
| 102 | Fabricaciones a medida | `fabricaciones-a-medida-transformadores-toroidales` | ninguna | duplicada de 49; su canonical apunta a una ruta que no es la suya |

### 3.3 Contadores desfasados (7)

| ID | Categoría | Declara WooCommerce | Productos reales (con descendientes) |
|---:|---|---:|---:|
| 96 | Equipos electrónicos | 0 | 11 |
| 97 | Convertidores | 0 | 1 |
| 98 | Fuentes de alimentación CC | 0 | 2 |
| 99 | Fuente de alimentación CA | 0 | 1 |
| 100 | Energias renovables | 0 | 4 |
| 101 | Control industrial | 0 | 2 |
| 46 | Equipos de Sobremesa | 1 | 0 |

### 3.4 Traducciones: categorías huérfanas y productos sin traducir

**Categorías ES sin traducción en ningún idioma (10):** 25 «Hembrillas de seguridad»; 31 «Controlador 0-10VDC»; 32 «Cuba de aceite»; 36 «Equipos industriales»; 47 «Equipos industriales»; 49 «Fabricaciones a Medida»; 99 «Fuente de alimentación CA»; 102 «Fabricaciones a medida»; 699 «Variador de tensión industriales»; 700 «En caja».

**Solo en otros idiomas:** "2x3W" (EN 631, FR 632, DE 633; 0 productos; coincide con el nombre del producto 908 "doble 2x3W"; probable resto de una traducción WPML).

**Productos traducidos que han quedado sin categoría** (sus categorías ES, 699 y 700, no existen en otros idiomas):

| Idioma | Producto | Producto ES | Categoría ES que le correspondería |
|---|---|---|---|
| EN | 16305 «Voltage regulator Industrial equipment» | 876 | 699 «Variador de tensión industriales» |
| EN | 15626 «Boxed» | 874 | 700 «En caja» |
| FR | 16306 «Régulateur de tension Équipement industriel» | 876 | 699 «Variador de tensión industriales» |
| FR | 15624 «En boîte» | 874 | 700 «En caja» |
| DE | 16307 «Spannungsregler Industrielle Geräte» | 876 | 699 «Variador de tensión industriales» |
| DE | 15628 «Boxen» | 874 | 700 «En caja» |

**Productos ES sin traducción:** 16633, 972, 974, 976 y 977 no tienen traducción en ningún idioma; el alemán carece además del 326. Por eso las ramas "Equipos electrónicos" y "Variadores" tienen menos productos en EN/FR/DE que en ES. En FR hay además un producto huérfano, 4323 «Equipos de sobremesa» (título en español, sin producto ES asociado), en «Sans catégorie».

**Calidad de las traducciones existentes** (detalle por categoría en `tree.nodes[].quality_flags`):

- *Variador* traducido de tres formas distintas: «inverters»/«onduleurs»/«Wechselrichter» (= inversor), «drives»/«entraînements»/«Antriebe» (= accionamiento) y «variators»/«régulateurs de tension»/«Spannungsregler». Afecta a 33, 37 y 40.
- «Manual» → DE «Handbuch» (= libro de instrucciones) en 38 y 41.
- «Portaled» → FR «Porté» (slug `portail`) y DE «Portiert» (slug `geportaliseerd`); la home FR usa «Portails».
- «Tapas serie BO» → FR «La série BO couvre» y DE «BO-Serie umfasst» (traducción literal como verbo).
- «Hembrillas» → DE «Socket Jack» (inglés); «Discos Flecha» → FR «Disques Arrow» (mezcla de idiomas).
- «Comunicación MODBUS» → EN «Modbus comunication» (errata) y FR «communicateur Modbus».
- **Alemán en neerlandés:** nombres como «Tafelmodellen», «Monofase», «Driefasen», «Dubbele motor», «Potentiometers en reostaten» y 36 slugs (p. ej. `bedieningsknoppen`, `veiligheidsaansluiting`, `geportaliseerd`); 8 descripciones contienen neerlandés. Detección heurística: validar con un nativo.
- 4 de los tiles de la home en EN/FR/DE (Choques, Botones de mando, Portaled, Núcleos) enlazan a la URL en **español**.

### 3.5 Productos sin categorizar (4)

El REST de WordPress los lista en "Sin categorizar" (18); la Store API de WooCommerce devuelve `categories=[]` para 878, 905 y 909. La categoría 18 está en el sitemap, tiene archivo público y la enlaza `/shop/`. A qué categoría parecen pertenecer, según su nombre y su texto:

| Producto | Nombre | Parece pertenecer a | Confianza | Motivo |
|---:|---|---|---|---|
| 155 | Tapas para botones – BM mate | 76 «Tapas Serie BM» | alta | El extracto es el del producto 940 'Tapas serie BM' (categoría 76) y de la descripción de 76, con la línea 'Colores: negro, rojo, azul, gris y verde.' en lugar de 'Ver ficha técnica'; además ya está asignado a 27 'Botones de mando y accesorios'. |
| 878 | Fabricaciones a medida | 49 «Fabricaciones a Medida» | media | Extracto ('Cada cliente es único... eje más largo... armario') igual al del producto 294 'Variador de tensión a medida' (que sí está en 28, y que es idéntico a la descripción de 28) más la nota '(link al cuestionario)'. Título 'Fabricaciones a medida' = nombre de las raíces vacías 49/102. |
| 905 | Reostatos y potenciometros bobinados | 107 «Potenciometros» | alta | Texto sobre potenciómetros y reóstatos (3 y 5 W) IDÉNTICO a la descripción de la categoría 107 'Potenciometros'; mismo título que 904 (que ya está en 122) y que 909; imagen 'reostato-ceramico-torivac.jpg'. |
| 909 | Reostatos y potenciometros bobinados | 112 «Reóstatos cerámicos» | alta | El extracto (reóstatos desde 12 W, ventilación) es IDÉNTICO a la descripción de la categoría 112 'Reóstatos cerámicos'; sin contenido ni imágenes propios. |

Los cuatro textos duplican la descripción de una categoría o el extracto de otro producto. Es posible que sean **textos de portada de categoría** y no productos de catálogo: decisión D5. Productos equivalentes en EN/FR/DE: están también en "Uncategorized" / "Sans catégorie" / "Nicht kategorisiert" (el 155 además en la categoría de botones).

### 3.6 Productos en varias categorías (46)

| Patrón de asignación actual | Productos |
|---|---:|
| Categorías de ramas distintas (el caso problemático) | 1 |
| Una sola categoría, de nivel hijo (el padre lo cuenta por herencia) | 24 |
| Hoja + todos sus ancestros | 38 |
| Una sola categoría y es raíz | 10 |
| Hoja + parte de los ancestros | 7 |

Los 46 "multi-categoría" son, salvo uno, cadenas normales de WooCommerce (hoja + padre). **El único caso real de ramas distintas es el producto 155** («Tapas para botones – BM mate»: «Sin categorizar» + «Botones de mando y accesorios»). Como el sitio asigna a veces hoja+padre y a veces solo la hoja, el padre de "Variadores" declara 15 productos aunque solo 9 tienen la categoría 19 asignada directamente. Detalle por producto: `products_in_multiple_categories.chain_multi`.

### 3.7 Hallazgos de la web actual (SEO y técnicos)

| Código | Gravedad | Hallazgo |
|---|---|---|
| S01 | alta | 53 de las 91 URLs de categoría ES (y 53/53/52 en EN/FR/DE) sirven la ficha del producto único en lugar de un archivo de categoría: el HTML capturado trae la clase 'single-product' y el canonical apunta al producto. En ES se cumple sin excepción: las 53 tienen exactamente 1 producto y ningún archivo real tiene un solo producto. Solo 38 URLs ES son archivos reales (12 de ellos vacíos). |
| S02 | media | product_cat-sitemap.xml lista 79 URLs, todas ES; no hay URLs de categoría EN/FR/DE. De las 79, 53 sirven ficha de producto (ver S01). |
| S03 | media | 34 canonicals de categoría (los de Yoast en el REST) no coinciden con su URL: 3 en ES (38 'manual' en vez de 'monofasicos-manual'; 76 con la errata 'tapas-seerie-bm'; 102 con una ruta que no es la suya), 13 en EN, 10 en FR y 8 en DE (el canonical omite la ruta del padre: p. ej. EN 477 '/boxed/' en vez de '/resistors-load-banks/boxed/'). |
| S04 | media | Los tiles de la home en EN, FR y DE enlazan 4 de las 10 categorías (Choques, Botones de mando, Portaled, Núcleos) a la URL en español: el idioma 'salta' al ES al hacer clic. |
| S05 | baja | Las etiquetas de la home difieren del nombre de la categoría: 'Choques toroidales' (63), 'Botones de mando y bornes' (30), 'Potenciómentros y reostatos' (122, con errata en origen), 'Portaleds' (65), 'Resistencias' (88), 'Bobina para electroimanes' (22), 'Núcleos toroidales' (64), 'Transformadores toroidales' (51). Traducciones dudosas de los tiles: EN 'Toroidal shocks', FR 'Chocs toroïdaux' y 'Portails', DE 'Toroidale Schocks'. |
| S06 | media | La página /en/shop/ se captura con contenido en español y enlaza 'Sin categorizar' (18) y 'Botones de mando y accesorios' (27) como categorías visibles. |
| S07 | media | Los textos de descripción de DE contienen neerlandés en 8 categorías (34, 66, 67, 68, 69, 83, 105, 106) y los nombres/slugs DE usan neerlandés en muchos casos (p. ej. 'Dubbele motor', 'Driefasen', 'Monofase', 'Tafelmodellen', 'bedieningsknoppen'). Detección heurística por vocabulario; requiere revisión nativa. |
| S08 | media | Contadores desfasados en 7 categorías ES: 96, 97, 98, 99, 100 y 101 declaran 0 pero tienen 11/1/2/1/4/2 productos; 46 declara 1 y tiene 0. Por eso /productos/ no muestra el recuento de 'Equipos electrónicos'. |
| S09 | media | Productos traducidos sin ninguna categoría: EN 15626/16305, FR 15624/16306, DE 15628/16307 (las traducciones de 874 'En caja' y 876 'Variador de tensión Equipos industriales'); sus categorías ES 700/699 no existen en otros idiomas. |
| S10 | baja | Cinco productos ES no tienen traducción en ningún idioma (16633, 972, 974, 976, 977) y el DE carece además de 326: por eso las categorías de 'Equipos electrónicos' y 'Variadores' tienen menos productos en EN/FR/DE que en ES. |
| S11 | baja | Imágenes de categoría: 57 de 78 sin texto alternativo; 6 con el alt en otro idioma (DE: 53, 57, 90, 92; FR: 94; EN: 120); 103 'Monofásico AVS' reutiliza la imagen de 106 'Trifásico BAVS' (id 9201). |
| S12 | media | La descripción de 27 'Botones de mando y accesorios' (ES/EN/FR/DE) es un shortcode WPBakery sin renderizar; su contenido decodificado referencia el dominio de pruebas torivac.santisomarketing.com y habla de variadores de tensión. |
| S13 | alta | En 37 páginas EN, 38 FR y 35 DE de categorías de 1 producto, el canonical del HTML apunta a la ficha del producto en ESPAÑOL (p. ej. la página FR de 'Aros con flecha' declara canonical https://grupotorivac.com/product/aros-con-flecha-2/): canonical cruzado entre idiomas. |
| S14 | media | Todos los archivos de categoría saltan de H1 a H3 sin H2 (las subcategorías y el bloque 'Productos' son H3): ES 38/38, EN 28/28, FR 28/28, DE 29/29. Ninguno tiene H2. |
| S15 | media | Las páginas EN/FR/DE servidas en URLs de categoría de 1 producto no tienen ningún <h1> (EN 53/53, FR 53/53, DE 52/52); las ES sí tienen H1 (53/53). Es un rasgo de la plantilla de ficha de producto, no de la categoría. |

## 4. Propuesta de árbol limpio

Principios (los mismos que figuran en `proposal.principles`):

- No se inventan nombres: cada nombre sale de una categoría existente; si falta la traducción, null.
- Se conserva el slug (y por tanto la URL) de la categoría canónica de cada grupo; las categorías fusionadas redirigen con 301.
- La estructura de las categorías conservadas NO cambia respecto de la actual (mismo padre); la limpieza consiste en fusionar duplicadas vacías, vaciar 'Sin categorizar' y reasignar 5 productos.
- Asignar cada producto solo a su categoría hoja; los ancestros heredan (evita el patrón mixto actual hoja+padre / solo hoja).
- Orden de las raíces = orden de las tarjetas de la página /productos/ actual, seguido de Equipos electrónicos y Fabricaciones a medida; el orden de las hijas es propuesta lógica (a confirmar).

Resumen: **91 → 79 categorías**, 25 → 13 raíces, 11 categorías fusionadas, 1 vaciada («Sin categorizar»), 5 productos reasignados, 1 categoría de otros idiomas descartada («2x3W»). Los 80 productos quedan asignados a exactamente una categoría hoja.

### 4.1 Árbol propuesto

Orden de las raíces = orden de las tarjetas de la página `/productos/` actual, seguido de «Equipos electrónicos» y «Fabricaciones a medida»; el orden de las hijas es una propuesta lógica (a confirmar). `null` = no existe traducción en las fuentes. La columna *Fusiona* lista los ids ES que desaparecen y redirigen a esta categoría.

| Id | ES | EN | FR | DE | Slug ES (se conserva) | Id ES canónico | Fusiona | Prod. propios |
|---|---|---|---|---|---|---:|---|---|
| **C01** | Transformadores | Transformers | Transformateurs | Transformatoren | `transformadores` | 51 |  |  |
| &emsp;↳ C01.01 | Transformadores toroidales | Toroidal transformers | Transformateurs toroïdaux | Ringkerntransformatoren | `transformadores-toroidales-transformadores` | 52 |  |  |
| &emsp;&emsp;↳ C01.01.01 | Serie TT | TT Series | Série TT | TT-Serie | `serie-tt` | 53 |  | 884 |
| &emsp;&emsp;↳ C01.01.02 | Serie TE | TE Series | Série TE | TE-Serie | `serie-te` | 54 |  | 886 |
| &emsp;&emsp;↳ C01.01.03 | Serie TCi (encapsulado para circuito impreso) | TCi Series (printed circuit board enclosure) | Série TCi (encapsulation de circuits imprimés) | TCi-Serie (Verkapselung von Leiterplatten) | `serie-tci` | 55 |  | 888 |
| &emsp;↳ C01.02 | Transformador convencional | Conventional transformer | Transformateur conventionnel | Konventioneller Transformator | `transformador-convencional` | 56 |  |  |
| &emsp;&emsp;↳ C01.02.01 | Serie TC | TC Series | Série TC | TC Serie | `serie-tc` | 57 |  | 890 |
| &emsp;&emsp;↳ C01.02.02 | Serie TCE | TCE Series | Série TCE | TCE-Serie | `serie-tce` | 58 |  | 891 |
| &emsp;&emsp;↳ C01.02.03 | TCT | TCT | TCT | TCT | `tct` | 59 |  | 892 |
| **C02** | Variadores de tensión - Autotransformadores regulables | Voltage variators - Adjustable autotransformers | Régulateurs de tension - Autotransformateurs réglables | Spannungsregler - Einstellbare Spartransformatoren | `variadores-de-tension` | 19 |  | 879, 16633 |
| &emsp;↳ C02.01 | Variadores Monofasicos | Single Phase Inverters | Onduleurs monophasés | Einphasen-Wechselrichter | `monofasico` | 37 |  |  |
| &emsp;&emsp;↳ C02.01.01 | Manual | Manual | Manuel | Handbuch | `monofasicos-manual` | 38 |  | 866 |
| &emsp;&emsp;↳ C02.01.02 | Motorizado | Motorized | Motorisé | Motorisiert | `motorizado-monofasico` | 43 |  | 867 |
| &emsp;↳ C02.02 | Variadores Trifásicos | Three-phase drives | Entraînements triphasés | Dreiphasige Antriebe | `trifasico` | 40 |  |  |
| &emsp;&emsp;↳ C02.02.01 | Manual | Manual | Manuel | Handbuch | `manual-trifasico` | 41 |  | 326 |
| &emsp;&emsp;↳ C02.02.02 | Motorizado | Motorized | Motorisé | Motorisiert | `motorizado` | 42 |  | 328 |
| &emsp;↳ C02.03 | Variador Doble | Double Variator | Double onduleur | Doppelter Wechselrichter | `dobles` | 33 |  |  |
| &emsp;&emsp;↳ C02.03.01 | Doble manual | Double manual | Double manuel | Doppelt manuell | `doble-manual` | 44 |  | 310 |
| &emsp;&emsp;↳ C02.03.02 | Doble motorizado | Dual motorized | Double motorisation | Dubbele motor | `doble-motorizado` | 34 |  | 308 |
| &emsp;↳ C02.04 | Equipos de sobremesa | Desktop equipment | Équipement de bureau | Schreibtischgeräte | `en-caja` | 45 | 39, 46 |  |
| &emsp;&emsp;↳ C02.04.01 | En caja | `null` | `null` | `null` | `variador-de-tension-en-caja` | 700 |  | 874 |
| &emsp;&emsp;↳ C02.04.02 | Variador de tensión industriales | `null` | `null` | `null` | `variador-de-tension-industriales` | 699 | 36, 47 | 876 |
| &emsp;&emsp;↳ C02.04.03 | Cuba de aceite | `null` | `null` | `null` | `cuba-de-aceite` | 32 |  | 306 |
| &emsp;↳ C02.05 | Accesorios de regulación | Regulating accessories | Accessoires de régulation | Zubehör zum Regulieren | `accesorios-de-regulacion` | 29 | 31, 50 | 301, 304, 882 |
| &emsp;↳ C02.06 | Fabricación a medida | Custom manufacturing | Production sur mesure | Maßgeschneiderte Fertigung | `fabricacion-a-media` | 28 |  | 294 |
| **C03** | Estabilizadores de tensión | Voltage stabilizers | Stabilisateurs de tension | Spannungsstabilisatoren | `estabilizadores-de-tension` | 60 |  | 895 |
| &emsp;↳ C03.01 | Estabilizadores Serie AVS: electromecánicos con servomotor | AVS Series Stabilizers: electromechanical with servo motor | Stabilisateurs de la série AVS : électromécaniques avec servomoteur | Stabilisatoren der AVS-Serie: elektromechanisch mit Servomotor | `serie-avs` | 61 |  |  |
| &emsp;&emsp;↳ C03.01.01 | Monofásico | Single-phase | Monophasé | Einphasig | `monofasico-serie-avs` | 103 |  | 897 |
| &emsp;&emsp;↳ C03.01.02 | Trifásico | Three-phase | Triphasé | Dreiphasig | `trifasico-serie-avs` | 104 |  | 898 |
| &emsp;↳ C03.02 | Serie BAVS: Electrónicos | BAVS Series: Electronics | Série BAVS : Électronique | BAVS Serie: Elektronik | `serie-bavs` | 62 |  |  |
| &emsp;&emsp;↳ C03.02.01 | Monofásico | single-phase-bavs | Monophasé | Monofase | `monofasico-serie-bavs` | 105 |  | 900 |
| &emsp;&emsp;↳ C03.02.02 | Trifásico | Three-phase | triphasé | Driefasen | `trifasico-serie-bavs` | 106 |  | 901 |
| **C04** | Reostatos y potenciómetros bobinados | Rheostats and coiled potentiometers | Rhéostats et potentiomètres à boudin | Rheostate und Spulenpotentiometer | `reostatos-y-potenciometros-bobinados` | 122 | 26 | 904 |
| &emsp;↳ C04.01 | Potenciometros | Potentiometers | Potentiomètres | Potentiometer | `potenciometros` | 107 |  | 905 |
| &emsp;&emsp;↳ C04.01.01 | Simples | Simple | Simple | Einfach | `simples` | 108 |  | 906, 907 |
| &emsp;&emsp;↳ C04.01.02 | Dobles | Doubles | Doubles | Doppelte | `dobles-potenciometros` | 111 |  | 908 |
| &emsp;↳ C04.02 | Reóstatos cerámicos | Ceramic rheostats | Rhéostats en céramique | Keramische Rheostate | `ceramicos` | 112 |  | 909, 910, 911, 912, 913, 1042 |
| **C05** | Bobinas encapsuladas | Encapsulated coils | Bobines encapsulées | Gekapselte Spulen | `bobinas-encapsuladas` | 22 |  |  |
| &emsp;↳ C05.01 | Redondas | Round | Rond | Rund | `redondas` | 118 |  | 916 |
| &emsp;↳ C05.02 | Cuadradas | Squares | Carrés | Quadrate | `cuadradas` | 119 |  | 918 |
| **C06** | Choques \| Inductancias \| Reactancias toroidales | Chokes \| Inductances \| Toroidal Reactances | Inductances \| Réactances toroïdales | Drosseln \| Induktivitäten \| Ringkerndrosseln | `choques` | 63 |  | 919 |
| **C07** | Nucleos | Nuclei | Noyaux | Kerne | `nucleos` | 64 |  | 921 |
| **C08** | Portaleds | Portaleds | Portaleds | Portaleds | `portaled` | 65 | 24 |  |
| &emsp;↳ C08.01 | led 3mm | led 3mm | led 3mm | led 3mm | `led-3mm` | 66 |  | 923 |
| &emsp;↳ C08.02 | led 5mm | led 5mm | led 5mm | led 5mm | `led-5mm` | 67 |  | 925 |
| &emsp;↳ C08.03 | led 8mm | led 8mm | led 8mm | led 8mm | `led-8mm` | 68 |  | 927 |
| &emsp;↳ C08.04 | led 10mm | led 10mm | led 10mm | led 10mm | `led-10mm` | 69 |  | 929 |
| **C09** | Hembrillas | Sockets | Prises | Socket Jack | `hembrillas` | 83 | 25 |  |
| &emsp;↳ C09.01 | Hembrilla HB4 | HB4 socket | Prise HB4 | HB4-Buchse | `hembrilla-hb4` | 84 |  | 954 |
| &emsp;↳ C09.02 | Hembrilla de seguridad HBS4 | Safety socket HBS4 | Prise de sécurité HBS4 | Sicherheitssteckdose HBS4 | `hembrilla-de-seguridad-hbs4` | 85 |  | 955 |
| &emsp;↳ C09.03 | hembrilla de seguridad HR4 | safety socket HR4 | prise de sécurité HR4 | Sicherheitssteckdose HR4 | `hembrilla-de-seguridad-hr4` | 86 |  | 956 |
| &emsp;↳ C09.04 | Hembrilla de seguridad HSR4 | HSR4 safety socket | Prise de sécurité HSR4 | Sicherheitssteckdose HSR4 | `hembrilla-de-seguridad-hsr4` | 87 |  | 957 |
| **C10** | Botones de mando | Control buttons | Boutons de commande | Steuerungstasten | `botones-de-mando` | 30 | 27 |  |
| &emsp;↳ C10.01 | Botones de mando serie BO (brillante) | BO series control buttons (bright) | Boutons de commande de la série BO (brillants) | Bedientasten der BO-Serie (glänzend) | `botones-de-mando-serie-bo-brillante` | 72 |  | 932 |
| &emsp;↳ C10.02 | Botones de mando Serie BO con linea | BO Series control buttons with line | Boutons de commande BO série avec ligne | Steuertasten BO Serie mit Linie | `botones-de-mando-serie-bo-con-linea` | 73 |  | 934 |
| &emsp;↳ C10.03 | Botones de mando serie BM (Mate) | BM series control buttons (Matte) | Boutons de commande série BM (Matt) | Bedientasten Serie BM (Matt) | `botones-de-mando-serie-bm-mate` | 74 |  | 936 |
| &emsp;↳ C10.04 | Tapas serie BO | BO series covers | La série BO couvre | BO-Serie umfasst | `tapas-serie-bo` | 75 |  | 938 |
| &emsp;↳ C10.05 | Tapas Serie BM | BM Series Covers | Couvercles de la série BM | BM Serie Abdeckungen | `tapas-serie-bm` | 76 |  | 155, 940 |
| &emsp;↳ C10.06 | Aros con flecha | Arrow hoops | Cerceaux à flèches | Pfeil-Reifen | `aros-con-flecha` | 77 |  | 942 |
| &emsp;↳ C10.07 | Discos Flecha | Arrow Discs | Disques Arrow | Pfeil-Scheiben | `discos-flecha` | 81 |  | 949 |
| &emsp;↳ C10.08 | Discos graduados | Graduated discs | Disques gradués | Abgestufte Scheiben | `discos-graduados` | 78 |  | 943 |
| &emsp;↳ C10.09 | Estators | Estators | Estateurs | Statoren | `estators` | 442 |  | 945 |
| &emsp;↳ C10.10 | Caratulas graduadas | Graded covers | Couvertures classées | Abgestufte Bezüge | `caratulas-graduadas` | 82 |  | 951 |
| &emsp;↳ C10.11 | Cubretercas | Casing covers | Couvercles de boîtier | Gehäuseabdeckungen | `cubretercas` | 80 |  | 947 |
| **C11** | Resistencias \| Bancos de carga | Resistors : Load banks | Résistances : bancs de charge | Widerstände : Lastbänke | `resistencias` | 88 |  |  |
| &emsp;↳ C11.01 | Bancos de carga | Load banks | Bancs de charge | Ladebänke | `bancos-de-carga` | 93 |  | 964 |
| &emsp;↳ C11.02 | Cementadas | Cemented | Cimenté | Zementiert | `cementadas` | 92 |  | 8346 |
| &emsp;↳ C11.03 | Helicoidales | Helical | Hélicoïdale | Wendel | `helicoidales` | 90 |  | 8340 |
| &emsp;↳ C11.04 | En caja | Boxed | En boîte | Boxen | `en-caja-resistencias` | 120 |  | 15355 |
| &emsp;↳ C11.05 | Resistencias de arranque | Starting resistors | Résistances de démarrage | Startwiderstände | `resistencias-de-arranque` | 94 |  | 965 |
| &emsp;↳ C11.06 | Resistencias de frenado | Braking resistors | Résistances de freinage | Bremswiderstände | `resistencias-de-frenado` | 444 |  | 8339 |
| &emsp;↳ C11.07 | Resistencias de puesta a tierra | Grounding resistors | Résistances de mise à la terre | Erdungswiderstände | `resistencias-de-puesta-a-tierra` | 95 |  | 966 |
| **C12** | Equipos electrónicos | Electronic equipment | Équipements électroniques | Elektronische Ausrüstung | `electronica` | 96 |  | 967 |
| &emsp;↳ C12.01 | Control industrial | Industrial control | Contrôle industriel | Industrielle Steuerung | `control-industrial` | 101 |  | 977, 978 |
| &emsp;↳ C12.02 | Convertidores | Converters | Convertisseurs | Konverter | `convertidores` | 97 |  | 968 |
| &emsp;↳ C12.03 | Energias renovables | Renewable energies | Énergies renouvelables | Erneuerbare Energien | `energias-renovables` | 100 |  | 973, 974, 975, 976 |
| &emsp;↳ C12.04 | Fuente de alimentación CA | `null` | `null` | `null` | `fuente-de-alimentacion-ca` | 99 |  | 972 |
| &emsp;↳ C12.05 | Fuentes de alimentación CC | DC power supplies | Alimentations en courant continu | DC-Stromversorgungen | `fuentes-de-alimentacion-cc` | 98 |  | 969, 970 |
| **C13** | Fabricaciones a medida | `null` | `null` | `null` | `fabricaciones-a-medida` | 49 | 102 | 878 |

Los nombres dudosos se reproducen **tal cual**, sin corregir (por ejemplo EN «single-phase-bavs» en C03.02.01, DE «Handbuch» en C02.01.01 y C02.02.01, FR «La série BO couvre» en C10.04, DE «Socket Jack» en C09, EN «Resistors : Load banks» en C11): son los que hay hoy y están marcados en `current_quality_flags_to_resolve` de cada nodo. La traducción definitiva es la decisión D7.

Por cada categoría, `proposal.tree[]` incluye además los ids de término en EN/FR/DE (`legacy_term_ids_other_languages`), la URL en los 4 idiomas, la categoría de la que se toma el nombre (`name_source_es_term_id`) y la de la descripción (`description_source_es_term_id`).

### 4.2 Fusiones

| Se conserva (slug/URL) | Se fusionan (301) | Nombre visible propuesto | Motivo |
|---|---|---|---|
| 45 «Equipos de sobremesa» (`en-caja`) | 39 «Equipos de sobremesa», 46 «Equipos de Sobremesa» | Equipos de sobremesa | raíces vacías 'Equipos de sobremesa', restos de la estructura anterior |
| 699 «Variador de tensión industriales» (`variador-de-tension-industriales`) | 36 «Equipos industriales», 47 «Equipos industriales» | Variador de tensión industriales | raíces vacías 'Equipos industriales'; el contenido industrial real está en 699 |
| 29 «Accesorios de regulación» (`accesorios-de-regulacion`) | 31 «Controlador 0-10VDC», 50 «Comunicación MODBUS» | Accesorios de regulación | raíces vacías con nombre de producto; sus productos (304, 882) ya están en 29 |
| 83 «Hembrillas» (`hembrillas`) | 25 «Hembrillas de seguridad» | Hembrillas | raíz vacía 'Hembrillas de seguridad' |
| 65 «Portaled» (`portaled`) | 24 «Portaleds» | Portaleds | raíz vacía 'Portaleds'; el nombre 'Portaleds' (plural, idéntico en 4 idiomas, usado en la home y por el cliente) se ofrece como nombre; la URL es la de 65 |
| 122 «Reostatos y potenciómetros bobinados» (`reostatos-y-potenciometros-bobinados`) | 26 «Potenciómetros y reóstatos» | Reostatos y potenciómetros bobinados | raíz vacía 'Potenciómetros y reóstatos' |
| 30 «Botones de mando» (`botones-de-mando`) | 27 «Botones de mando y accesorios» | Botones de mando | 'Botones de mando y accesorios' con 1 solo producto repetido (155) |
| 49 «Fabricaciones a Medida» (`fabricaciones-a-medida`) | 102 «Fabricaciones a medida» | Fabricaciones a medida | dos raíces vacías 'Fabricaciones a medida'; se conserva el slug limpio de 49 y el nombre (minúsculas) de 102 |

Los nombres alternativos de las categorías fusionadas (incluidas sus traducciones) no se pierden: están en `proposal.tree[].name_alternatives`.

Nombres EN/FR/DE de «Fabricaciones a medida» (C13): `null`, porque las raíces 49/102 no tienen traducción. Como referencia (no se aplican sin validación) existe la traducción de la hija 28 «Fabricación a medida»: EN «Custom manufacturing», FR «Production sur mesure», DE «Maßgeschneiderte Fertigung». Lo mismo ocurre con «En caja», «Variador de tensión industriales», «Cuba de aceite» y «Fuente de alimentación CA» (ids 700, 699, 32, 99), que no tienen traducción.

### 4.3 Productos que cambian de categoría (5)

| Producto | Nombre | De | A | Motivo |
|---:|---|---|---|---|
| 155 | Tapas para botones – BM mate | 18 «Sin categorizar», 27 «Botones de mando y accesorios» | 76 «Tapas Serie BM» | sin categoría + 27 -> 'Tapas Serie BM' (76): confirmar si es duplicado de 940 en D5 |
| 306 | Cuba de aceite | 45 «Equipos de sobremesa» | 32 «Cuba de aceite» | estaba directamente en 'Equipos de sobremesa' (45) aunque existe la hija vacía 'Cuba de aceite' (32) con su misma descripción -> 32 |
| 878 | Fabricaciones a medida | 18 «Sin categorizar» | 49 «Fabricaciones a Medida» | sin categoría -> raíz 'Fabricaciones a medida' (extracto igual al de 294/28): confirmar en D1/D5 |
| 905 | Reostatos y potenciometros bobinados | 18 «Sin categorizar» | 107 «Potenciometros» | sin categoría -> 'Potenciometros' (texto idéntico a la descripción de 107) |
| 909 | Reostatos y potenciometros bobinados | 18 «Sin categorizar» | 112 «Reóstatos cerámicos» | sin categoría -> 'Reóstatos cerámicos' (texto idéntico a la descripción de 112) |

La asignación solo a la categoría hoja (los ancestros heredan) unifica el patrón mixto actual. Ningún producto se queda en una categoría fusionada o descartada (`proposal.checks`).

### 4.4 Redirecciones 301

`proposal.redirects_301` lista 36 redirecciones (12 ES, 8 EN, 8 FR, 8 DE). Las de español:

| Categoría | Desde | Hacia |
|---:|---|---|
| 24 | `/categoria-producto/portaleds/` | `/categoria-producto/portaled/` |
| 25 | `/categoria-producto/hembrillas-de-seguridad/` | `/categoria-producto/hembrillas/` |
| 26 | `/categoria-producto/potenciometros-y-reostatos/` | `/categoria-producto/reostatos-y-potenciometros-bobinados/` |
| 27 | `/categoria-producto/botones-de-mando-y-accesorios/` | `/categoria-producto/botones-de-mando/` |
| 31 | `/categoria-producto/controlador-0-10vdc/` | `/categoria-producto/variadores-de-tension/accesorios-de-regulacion/` |
| 36 | `/categoria-producto/equipos-industriales/` | `/categoria-producto/variadores-de-tension/en-caja/variador-de-tension-industriales/` |
| 39 | `/categoria-producto/equipos-de-sobremesa/` | `/categoria-producto/variadores-de-tension/en-caja/` |
| 46 | `/categoria-producto/equipos-de-sobremesa-en-caja/` | `/categoria-producto/variadores-de-tension/en-caja/` |
| 47 | `/categoria-producto/equipos-industriales-en-caja/` | `/categoria-producto/variadores-de-tension/en-caja/variador-de-tension-industriales/` |
| 50 | `/categoria-producto/comunicacion-modbus/` | `/categoria-producto/variadores-de-tension/accesorios-de-regulacion/` |
| 102 | `/categoria-producto/fabricaciones-a-medida-transformadores-toroidales/` | `/categoria-producto/fabricaciones-a-medida/` |
| 18 | `/categoria-producto/sin-categorizar/` | *(índice de productos del idioma)* |

En EN/FR/DE: 8 redirecciones por idioma, que son las 6 categorías fusionadas que tienen traducción (24, 26, 27, 39, 46, 50), «Sin categorizar» (se redirige al índice de productos) y «2x3W» (se descarta: sin tráfico previsible, 0 productos, fuera del sitemap). Las categorías de 1 producto cuya URL hoy sirve la ficha no están en esta lista: depende de la decisión D8.

### 4.5 Qué NO cambia

- El padre de cada categoría conservada (`proposal.checks.structure_unchanged_for_kept_categories = true`).
- Los slugs y URLs de las categorías conservadas, incluidos los slugs con errata (`fabricacion-a-media`), los slugs franceses en español y los alemanes en neerlandés: cambiarlos supone perder SEO y requiere 301 (decisión D6).
- Los textos: nada se reescribe ni se corrige (las descripciones con errores de origen están anotadas en `quality_flags`).

## 5. Cómo se ha construido (resumen de método)

- **Árbol y recuentos:** `data/raw/rest/product_cat.<lang>.json` y `data/raw/store/categories.<lang>.json`, contrastados con `data/raw/tree/product-tree.json` (el árbol propio del sitio coincide en las 91 categorías) y `data/analysis/category-map.json`. Los productos por categoría salen de `product.<lang>.json` (campo `product_cat`) y de `data/analysis/product-map.json`; los recuentos se recalculan incluyendo descendientes.
- **Traducciones:** `category-map.json` no trae el enlace entre idiomas, así que se reconstruye: 96 enlaces por `hreflang` de las páginas de archivo de categoría (`data/raw/html/`), y 147 localizando en el idioma destino el producto traducido (`product-map.json`) y tomando la categoría con el mismo padre que la traducción del padre ES. Verificado de forma independiente: sin conflictos, 243 enlaces biunívocos, padres coherentes en los 4 idiomas y los 147 enlaces por producto apoyados en al menos un producto traducido.
- **Qué sirve cada URL:** clase del `<body>` y `canonical` de los HTML capturados en `data/raw/html/` y esquema de encabezados de `data/analysis/pages/<lang>/categoria-producto__*.json`.

## 6. Decisiones que debe tomar el usuario

Cada decisión trae la opción por defecto con la que se ha construido la propuesta (cambiarla solo afecta a las filas indicadas).

| # | Decisión | Por defecto |
|---|---|---|
| D1 | 'Fabricaciones a medida': ¿una única raíz para todo el servicio (propuesta: 49+102 en una raíz, 28 sigue como hija de Variadores) o solo la hija 28 descartando las raíces? ¿Los productos 878 y 294 (mismo texto) son uno o dos? | raíz única + 28 como hija; 878 a la raíz |
| D2 | 'Equipos industriales' (36/47, vacías) y 699 'Variador de tensión industriales' anidada en 'Equipos de sobremesa': ¿se mantiene anidada (propuesta) o se promueve a hermana de 45 con el nombre 'Equipos industriales'? | mantener anidada; fusionar 36/47 en 699 |
| D3 | Nombres visibles: 'Portaled' o 'Portaleds'; 'Reostatos y potenciómetros bobinados' o 'Potenciómetros y reóstatos'; 'Botones de mando' o 'Botones de mando y bornes' (home). La propuesta usa 'Portaleds' (idéntico en 4 idiomas) y conserva el nombre de la categoría canónica en el resto. | Portaleds; resto como la canónica |
| D4 | 'Controlador 0-10VDC' (31) y 'Comunicación MODBUS' (50): ¿fusionar en 'Accesorios de regulación' (propuesta) o dejarlas como subcategorías de 29 (patrón de 1 producto por hoja)? | fusionar en 29 |
| D5 | Productos sin categoría (905, 909, 878, 155): ¿aceptas la reasignación propuesta (107, 112, raíz 'Fabricaciones a medida', 76)? ¿Son productos reales o textos de portada (su texto duplica la descripción de una categoría)? ¿155 es un duplicado de 940? | reasignar como se propone; la revisión producto real/portada va en la tarea de productos |
| D6 | Slugs: ¿se conservan todos los actuales (incluidos 'fabricacion-a-media', slugs FR en español y slugs DE en neerlandés) por SEO (propuesta) o se normalizan ahora con 301? | conservar todos |
| D7 | Traducciones: 10 categorías ES no tienen equivalente en EN/FR/DE y hay nombres dudosos (Porté, Wechselrichter/onduleur, Handbuch, neerlandés en DE). ¿Quién valida y con qué glosario (variador, choque, hembrilla, portaled)? | dejar null y marcar como propuesta en el panel de admin |
| D8 | Categorías de 1 producto (53): hoy sirven la ficha del producto. En la web nueva, ¿se mantienen como filtros/etiquetas (propuesta) o se elimina el nivel hoja y se enlaza directo a la ficha? | mantener como filtro, sin página propia |

Orden de las raíces propuesto (a confirmar junto con las decisiones): C01 Transformadores → C02 Variadores de tensión - Autotransformadores regulables → C03 Estabilizadores de tensión → C04 Reostatos y potenciómetros bobinados → C05 Bobinas encapsuladas → C06 Choques | Inductancias | Reactancias toroidales → C07 Nucleos → C08 Portaleds → C09 Hembrillas → C10 Botones de mando → C11 Resistencias | Bancos de carga → C12 Equipos electrónicos → C13 Fabricaciones a medida.

## 7. Huecos y límites del análisis

- No hay peticiones de red: que una URL de categoría 'sirva la ficha de producto' se deduce del HTML capturado (clase single-product + canonical al producto); no se ha verificado si el servidor responde 200 o 301.
- Las clasificaciones de idioma de nombres, slugs y descripciones (neerlandés en DE, español en slugs FR) son heurísticas por vocabulario; requieren revisión de un nativo.
- Yoast no define meta description en EN/FR/DE (meta_description = null en las 82 categorías de cada idioma); solo 30 de las 91 categorías ES la tienen. Se informa og_description cuando existe.
- La Store API solo trae imagen de categoría para las categorías no vacías; las 12 vacías no tienen imagen consultable.
- No existe fuente de orden editorial de categorías: menu_order en ES va de 0 a 99 y las raíces salen en orden prácticamente alfabético (con 'Sin categorizar' la primera); en EN/FR/DE vale 0 en todas. El orden propuesto sale de las tarjetas de /productos/ y de criterio lógico.
- Los textos de las descripciones se limpian de HTML pero se conservan tal cual (errores incluidos); no se corrigen.

## 8. Dónde está cada cosa en el JSON

| Clave de `data/analysis/categories-analysis.json` | Contenido |
|---|---|
| `meta`, `summary` | fuentes, método y cifras |
| `tree` | árbol actual completo (91 nodos anidados + `non_es_only`); cada nodo: ids por idioma, nombre, slug, URL, padre, recuentos, productos, descripción, imagen, SEO, qué sirve la URL (`serves`), encabezados (`archive_page`), traducción y su método, `quality_flags`, `source` |
| `duplicates` | grupos D01–D09, descripciones copiadas, nombres normalizados iguales y duplicados en otros idiomas |
| `empty_categories` | 12 vacías y 7 con contador desfasado |
| `orphans_translation` | categorías sin traducción, solo en otros idiomas, productos traducidos sin categoría y productos ES sin traducción |
| `products_uncategorized` | 4 productos de «Sin categorizar», categoría sugerida y confianza; equivalentes en EN/FR/DE |
| `products_in_multiple_categories` | patrones de asignación y detalle por producto |
| `site_findings` | hallazgos S01–S15 de la web actual |
| `proposal` | `tree` (árbol propuesto), `merges`, `dropped`, `redirects_301`, `product_reassignments`, `products_by_new_category`, `checks` |
| `decisions_for_user`, `gaps` | decisiones D1–D8 y huecos |

