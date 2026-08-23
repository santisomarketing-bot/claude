# Plantilla de proyecto GEO (Jira)

GEO = *Generative Engine Optimization*: aparecer y ser citado en ChatGPT, Perplexity,
Gemini y Google AI Overviews. Lógica versionada en [`geo-templates.mjs`](./geo-templates.mjs).

## Estructura (3 niveles, proyecto **SEO**)

```
Marca (Epic):  <cliente>
  └─ Tarea:  GEO <cliente> <fecha>
       └─ Sub tareas (fases):  "<Fase> <cliente> <fecha>"
```

Tipos Jira en SEO: Marca/Epic `10023` · Tarea `10021` · Sub tarea `10022`.

## Fases (subtareas)

1. Auditoría de visibilidad IA (baseline en ChatGPT/Perplexity/Gemini/AI Overviews)
2. Investigación de prompts objetivo
3. Análisis de fuentes citadas
4. **Crear contenido** — usando el Excel **SEO 2025**
5. **Publicar contenido** — siguiendo **WORDPRESS 2025**
6. Datos estructurados / Schema.org
7. Entidad de marca (Knowledge Panel / Wikidata)
8. Presencia en fuentes de terceros (Reddit, reseñas, prensa)
9. Seguimiento de menciones/citaciones
10. Informe mensual de visibilidad IA

Las fases 4 y 5 llevan en su descripción el enlace directo al recurso interno:

- **SEO 2025** (Google Sheets): para crear el contenido citable.
- **WORDPRESS 2025** (Google Sheets): para publicarlo.

Los enlaces están en `RECURSOS` dentro de `geo-templates.mjs` (actualízalos ahí si cambian).

## Ajustar

- **Fases / textos / recursos:** `FASES_GEO` y `RECURSOS` en `geo-templates.mjs`.
- **Proyecto / tipos:** objeto `GEO` al inicio del módulo.
- **Nomenclatura:** `<Fase> <marca> <fecha>` (igual que WEBS).
