# Propuesta: versión nueva de los dibujos técnicos

Estado: **pendiente de validación del cliente**. Nada de esto está publicado: la web sigue usando
`site/assets/drawings/*.webp`. El documento que se envía al cliente es
`Torivac-Dibujos-tecnicos-validacion-cliente.pdf` (44 páginas A4 apaisadas: versión actual a la
izquierda, versión nueva a la derecha, a la misma escala, con casillas de aprobar / mantener / corregir).

## Qué es la «versión nueva»

Los 44 dibujos se publican hoy como recortes raster (WebP) de los PDF del fabricante. La versión nueva es el
**mismo dibujo con otra piel**:

| | Actual | Nueva |
|---|---|---|
| Formato | WebP (raster, fondo blanco) | SVG vectorial, fondo transparente (2 excepciones, abajo) |
| Contorno | negro del PDF | tinta `#100404` |
| Cotas, flechas, letras | gris del PDF | cobre `#a45c18` |
| Grosores | los del PDF | 3 niveles (0,4 · 0,75 · 1,25 pt) |
| Rellenos grises | gris | tinte cobre `#e8d5bb` |
| Marcas de esquina | no | sí (opcionales: `marks=False` en `redraw.convert`) |
| Separación entre vistas | se colapsan las filas en blanco | se conserva la del PDF |

No se inventa ni se mide nada: en los 42 dibujos vectoriales cada trazo, curva, flecha y letra sale del
contenido del PDF (`data/raw/pdf`, ignorado por git) con el mismo recorte (`bbox`) que
`data/catalog/drawings.curated.json`.

Excepciones (el PDF trae una imagen, no vectores):

- `reostato-pc-anclaje`: se vuelve a renderizar a 500 ppp, se recolorea (tinta/cobre, alfa por luminosidad)
  y se amplía el recorte 11 pt por abajo para no cortar la leyenda «Anclaje Mod. PC-1000». Sale PNG con alfa.
- `cuba-de-aceite`: la imagen original es de 277 × 279 px; está **redibujada a mano** (`src/cuba.py`) con las
  mismas cotas A, B y C. Es el único dibujo con trazado nuevo.

## Regenerar

Requisitos: los PDF en `data/raw/pdf`, `pdfplumber`, `pdfminer.six`, `Pillow`, `numpy`, poppler (`pdftoppm`)
y Playwright (ya en el proyecto). Desde esta carpeta:

```bash
cd docs/propuesta-dibujos-nuevos
mkdir -p out
python3 src/batch.py       # 42 SVG vectoriales → svg/
python3 src/cuba.py        # cuba de aceite redibujada → svg/cuba-de-aceite.svg
python3 src/raster.py      # reostato-pc-anclaje → png/
python3 src/manifest.py    # medidas y archivos de cada pareja → out/manifest.json
node src/build-doc.mjs out # PDF de validación → out/Torivac-Dibujos-tecnicos-validacion-cliente.pdf
```

`src/redraw.py` es el conversor: registra los trazados **completos** (con sus huecos: las O, R, 8… de los
rótulos) y las letras en orden de pintado con un `PDFLayoutAnalyzer` propio. pdfplumber parte cada glifo en
subtrazados y los huecos salen rellenos, por eso no se usa su lista de objetos. Se ignora el texto en modo
invisible y se clasifican los colores por luminosidad: < 0,25 tinta, hasta 0,88 cobre, más claro papel.

## Si el cliente aprueba: aplicarlo en la web

Aún no está hecho. Puntos a decidir y hacer:

1. Publicar los SVG/PNG aprobados en `site/assets/drawings/` y que `scripts/extract_drawings.py` (o un paso
   nuevo) escriba en `data/catalog/drawings.json` el archivo y las medidas (`w`, `h` = `viewBox`). Los dibujos
   no aprobados siguen con su WebP: hay que poder mezclar formatos por dibujo.
2. Los rótulos que son texto real (`variador-monofasico-manual-1` y las letras A, B, C de `cuba-de-aceite`) usan Chivo Mono en SVG; dentro de un
   `<img>` esa fuente no se carga y cae a una monoespaciada del sistema. Convertirlos a trazados o incrustar
   el SVG en línea.
3. Algunas letras llevan una cajita del color del papel que tapa la línea de cota que pasa por detrás
   (`var(--dwg-bg, #f6f3ec)`). En un `<img>` la variable no existe y vale `#f6f3ec` (el papel de «Ficha técnica»);
   en los aspectos Clásico y Original, con otro fondo, se verían las cajitas. O se incrusta el SVG en línea
   definiendo `--dwg-bg` por aspecto, o se quitan esas cajitas.
4. Peso: 1,7 MB sin comprimir y 0,6 MB con gzip, frente a 0,7 MB de los WebP. Comprobar que el servidor
   comprime `image/svg+xml` (cPanel/Plesk lo hacen por defecto con mod_deflate; revisar `.htaccess`).
5. Pasar `scripts/qa-drawings.mjs` adaptado a SVG/PNG, `qa-all.sh` y regenerar el paquete.

Los textos dentro de los dibujos (Ø, ROSCA, VA…) son los del PDF y no se traducen; está fuera de esta propuesta.
