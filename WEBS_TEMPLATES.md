# Plantilla de proyecto WEB (proyecto WEBS de Jira)

Replica tu estructura de 3 niveles para montar un proyecto web completo de una vez.
Lógica versionada en [`webs-templates.mjs`](./webs-templates.mjs).

## Estructura (idéntica a la que ya usas)

```
Marca (Epic)      → el cliente / la web
  └─ Tarea        → "DISEÑO WEB[ KIT DIGITAL] <marca> <fecha>"
       └─ Sub tarea (una por página):  "<Sección> <marca> <fecha>"
```

Tipos reales de WEBS: **Marca/Epic `10010` · Tarea `10003` · Sub tarea `10004`**
(proyecto WEBS id `10001`). Estado inicial: `Por hacer`.

## Páginas

**Corporativa:** HOME · header · footer · Sobre nosotros · Servicios · Blog ·
Plantilla entradas · Contacto · Páginas legales

**Ecommerce:** HOME · header · footer · Sobre nosotros · Servicios ·
**Tienda/Shop · Ficha de producto · Carrito/Checkout** · Blog · Plantilla entradas ·
Contacto · Páginas legales

**Kit Digital:** añade la subtarea `JUSTIFICACIÓN KIT DIGITAL`.

Nomenclatura de cada subtarea: `<Sección> <marca> <fecha>`
(ej. `HOME KICK BARCELONA MAYO 26`).

## Uso

```js
import { construyeProyectoWeb, renderPlan } from "./webs-templates.mjs";

const plan = construyeProyectoWeb({
  marca: "KICK BARCELONA",
  fecha: "MAYO 26",
  tipo: "corporativa",   // o "ecommerce"
  kitDigital: true,       // añade la subtarea de justificación
});

console.log(renderPlan(plan)); // revisar el árbol antes de crear nada
```

`plan` trae los payloads listos para `createJiraIssue` en orden de creación:
1. `plan.epic` → crear el Epic (Marca) y quedarse con su key.
2. `plan.tarea` → añadir `fields.parent = { key: <epicKey> }` y crear la Tarea.
3. `plan.subtareas[]` → a cada una `fields.parent = { key: <tareaKey> }` y crear.

## Ajustar

- **Páginas por tipo:** `PAGINAS_CORP` / `PAGINAS_ECOMMERCE` en `webs-templates.mjs`.
- **Subtarea Kit Digital:** `PAGINA_KIT_DIGITAL`.
- **Proyecto / tipos:** objeto `WEBS` al inicio del módulo.
