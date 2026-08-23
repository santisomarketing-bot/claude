# Plantilla Google Ads (Jira)

Google Ads como **Tarea** con **subtareas** (2 niveles, sin Epic).
Lógica versionada en [`ads-templates.mjs`](./ads-templates.mjs).

## Estructura

```
Tarea:  GOOGLE ADS <marca> <fecha>
  ├─ Alta de la cuenta
  ├─ Configurar conversiones
  ├─ Campaña
  ├─ Grupo de anuncio
  ├─ Anuncios
  └─ Gestión Mes N   (una subtarea por mes de gestión — "los meses")
```

Proyecto por defecto: **SM** (Tarea `10001` · Sub tarea `10002`). La Tarea puede ir
suelta o colgar de la Marca/Epic de un cliente pasando `parentKey`.

## Uso

```js
import { construyeTareaGoogleAds } from "./ads-templates.mjs";

// 6 meses (por defecto)
construyeTareaGoogleAds({ marca: "TORIVAC", fecha: "AGO 26" });

// meses concretos
construyeTareaGoogleAds({ marca: "TORIVAC", fecha: "2026", meses: ["SEP 26", "OCT 26", "NOV 26"] });

// colgando del Epic de un cliente
construyeTareaGoogleAds({ marca: "TORIVAC", fecha: "AGO 26", meses: 12, parentKey: "SM-123" });
```

- `meses`: número (genera `Mes 1..N`) o array de etiquetas concretas.
- Nomenclatura de subtareas: `<Sección> <marca> <fecha>` (igual que el resto de plantillas).

## Ajustar

- **Subtareas de setup:** array `SETUP_ADS` en `ads-templates.mjs`.
- **Proyecto / tipos:** objeto `ADS` al inicio del módulo.
