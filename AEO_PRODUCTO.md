# Empaquetado y decisión de producto

Sesión 7 de [`AEO_PLAN.md`](./AEO_PLAN.md). Con 6 de las 8 piezas ya implementadas (faltan la 6 —
integración WordPress— y validar en vivo lo que no se pudo probar en esta sesión), toca decidir
qué se hace con esto.

## Estado real a la fecha (no vender esto como más maduro de lo que es)

| Pieza | Implementada | Probada de verdad |
|---|---|---|
| 1 — Auditor IA | ✅ | ✅ contra un sitio de prueba local |
| 2 — Generador de contenido | ✅ | ✅ contra un sitio de prueba local |
| 3 — Worker de Cloudflare | ✅ | ✅ end-to-end (bot vs. humano, pass-through real) — con placeholder, no con contenido real de la Sesión 2, y sobre `workers.dev`/Pages de prueba, no un dominio de cliente |
| 4 — Menciones en IA | ✅ | 🟡 lógica probada con datos sintéticos; **nunca corrida con una API key real** |
| 5 — Informe mensual | ✅ | 🟡 probado con datos sintéticos; nunca con datos reales de un cliente |
| 6 — Integración WordPress | ❌ | — |
| 7 — Este documento | ✅ | — |
| 8 — Google Maps en masa | ✅ | 🟡 solo la parte de URL (CID/Place ID) probada; la lectura de NAP+ y el local pack **nunca corridas contra Google real** |

**Conclusión honesta: esto no está listo para cobrarle a un cliente todavía.** Lo que falta no es
más código — es una corrida real, de punta a punta, contra un cliente real (o la propia agencia),
para confirmar que lo que se construyó funciona fuera de los tests sintéticos.

## Decisión recomendada: piloto interno antes que producto

No conviene saltar directo a "vender esto como servicio" sin haberlo corrido nunca contra un
cliente real. Orden recomendado:

1. **Piloto interno** (1-2 clientes, o la propia agencia): correr las 8 piezas de punta a punta
   — auditar, generar contenido, aplicarlo (cuando esté la Sesión 6), desplegar el Worker en el
   dominio real del piloto, trackear menciones con al menos una API key real, generar el informe
   mensual. Esto valida lo que hoy son solo pruebas sintéticas.
2. **Recién ahí**, decidir si se ofrece como servicio a más clientes de la agencia, y con qué
   empaquetado — no antes.
3. Un servicio externo a terceros (fuera de la cartera de clientes ya existente) es una decisión
   posterior todavía, y necesitaría revisar aparte los términos de servicio de cada plataforma que
   se toca (Google Maps/Search, Cloudflare, cada motor de IA) para uso a nombre de un tercero.

## Si se ofrece como servicio a clientes de la agencia (propuesta de tiers)

Una vez validado el piloto, esta es una forma razonable de empaquetarlo — pensada para encajar
con el flujo ya existente de tareas "GEO `<cliente>` `<fecha>`" en Jira:

| Tier | Incluye | Encaja con |
|---|---|---|
| **Auditoría IA** (una vez) | Sesión 1 + informe corto | Fase 1 de `GEO_TEMPLATES.md` — buen "lead magnet", barato de entregar |
| **Optimización IA** (proyecto único) | Auditoría + Sesión 2 (JSON-LD/`llms.txt`) aplicado vía Sesión 6 | Fases 4-6 de `GEO_TEMPLATES.md` |
| **AEO gestionado** (mensual, recurrente) | Todo lo anterior + Worker desplegado (Sesión 3) + tracking de menciones (Sesión 4) + informe mensual (Sesión 5) | Fases 9-10 — reemplaza el seguimiento manual actual |

**Precio**: no propongo cifras concretas acá — es una decisión comercial de la agencia, no algo
que deba inventar. Como referencia de mercado (de la investigación de la Sesión 0), agencias que
ofrecen monitoreo de visibilidad en IA cobran entre ~$3.000 y ~$15.000/mes según alcance — un
punto de partida para comparar, no un precio a copiar.

## Próximos pasos concretos

1. Elegir el cliente piloto (interno o real) y correr las 8 piezas de punta a punta.
2. Validar en vivo lo marcado 🟡 en la tabla de arriba (menciones con API key real, Google Maps
   real, informe con datos reales).
3. Hacer la Sesión 6 (integración WordPress) si el piloto usa WordPress.
4. Con el piloto corrido y sin sorpresas, decidir tiers/precio reales y a qué clientes ofrecerlo.
