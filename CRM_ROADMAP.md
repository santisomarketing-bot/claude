# Roadmap del CRM propio — por sesiones

Plan para seguir construyendo el CRM (`crm/`, ver `CRM_LEADS.md`) en sesiones
sueltas de Claude Code, cada una con un objetivo cerrado y entregable. Los
tics se van marcando aquí para que una sesión nueva sepa por dónde va esto
sin tener que releer todo el historial.

**Principio que guía todo el roadmap: cero proveedores externos de
CRM/gestión** (nada de Jira, HubSpot, Salesforce, etc.). El pipeline
comercial vive entero dentro de este CRM propio — ver "Sin proveedores
externos, a propósito" en `CRM_LEADS.md`. Infraestructura básica (hosting
del servidor, el propio Gmail de la agencia para notificar) no cuenta como
"proveedor externo" en este sentido; ante la duda en una sesión futura,
preguntar antes de meter una dependencia nueva.

## Hecho

- [x] **Sesión 0 — Base del CRM.** Ingesta unificada (Meta Ads, Google Ads,
      formularios web), modelo de lead único, almacén JSON, dashboard
      (filtros, ficha, notas, estados, export CSV), Basic Auth, test
      end-to-end (`npm run crm:test`). Ver `CRM_LEADS.md`.

- [x] **Sesión 0.1 — Secuencia de bienvenida (estructura).** 3 correos
      automáticos al lead (confirmación al momento, invitación a la web
      +1 día, newsletter +4 días), con su propio envío SMTP (`nodemailer`,
      única dependencia añadida), botón de cancelar por lead, y test
      end-to-end con transporte simulado. **Falta lo real para activarla**
      (ver Sesión 1): credenciales `SMTP_*`, `AGENCY_WEBSITE_URL` y
      `AGENCY_NEWSLETTER_URL`, y revisar el texto de los 3 correos. Ver
      "Secuencia de bienvenida" en `CRM_LEADS.md`.

- [x] **Sesión 0.2 — Aviso al equipo, con red de seguridad.** Correo
      inmediato de lead nuevo (a todo lead, tenga o no email — a diferencia
      de la secuencia de arriba) + recordatorio periódico (4h por defecto)
      con **todos** los leads sin cerrar, que se repite mientras quede
      alguno abierto — así ningún lead se escapa sin pasar por `ganado` o
      `perdido`. Mismo SMTP que la secuencia de bienvenida (sin dependencia
      nueva). Enlace directo al lead si `CRM_PUBLIC_URL` está configurada
      (`/?lead=<id>` en el dashboard). Test end-to-end cubre: aviso
      inmediato, no duplicado, aviso a leads sin email, el digest excluye
      leads cerrados y no manda nada si no queda ninguno abierto. **Falta
      lo real** (Sesión 1): `SMTP_*` y, si se quiere el enlace directo,
      `CRM_PUBLIC_URL`. Ver "Aviso al equipo" en `CRM_LEADS.md`.

## Por hacer

- [ ] **Sesión 1 — Puesta en producción real.**
      No es una sesión de código, es la que desbloquea todo lo demás: sin
      URL pública no hay webhooks reales que probar.
      - Elegir hosting (VPS propio / Render / Railway / Fly.io) y desplegar
        `npm run crm` ahí, con disco persistente para `crm/data/leads.json`.
      - Crear la app en Meta for Developers, conseguir el Page Access Token,
        dar de alta el webhook `leadgen` y suscribir la página.
      - Configurar el webhook de Google Ads (Herramientas → Integraciones de
        clientes potenciales) con la clave compartida.
      - Rellenar `crm/.env` en el hosting con las claves reales
        (`crm/.env.example` trae la lista completa): `SMTP_*` y
        `AGENCY_WEBSITE_URL`/`AGENCY_NEWSLETTER_URL` para la secuencia de
        bienvenida (revisar/ajustar sus textos en `crm/lib/sequence.mjs`
        antes de que salgan de verdad), y `TEAM_NOTIFY_EMAIL`/
        `CRM_PUBLIC_URL` para el aviso al equipo.
      - Validar con un lead de prueba de cada canal: el "lead de prueba" de
        Meta, el botón "enviar solicitud de prueba" de Google Ads, y un
        envío real desde un formulario — y confirmar que llegan tanto el
        correo de confirmación al lead como el aviso al equipo.

- [ ] **Sesión 2 — Multiusuario y copias de seguridad.**
      Hoy el panel es una única contraseña compartida (`CRM_USER`/`CRM_PASS`)
      y el almacén es un solo JSON sin backup. Si el equipo va a vivir en
      esto: login por persona + backup automático (copia periódica de
      `leads.json` fuera del propio servidor).

- [ ] **Sesión 3 — Métricas.**
      Leads por semana/mes y por fuente, tasa de conversión por estado, y
      —si interesa— coste por lead cruzando con el gasto real de Meta/Google
      Ads (ya hay herramientas MCP de Meta Business disponibles para esto).

- [ ] **Sesión 4 (opcional) — Más canales.**
      Enchufar el scanner de LinkedIn (`scan.mjs`) como una fuente más del
      mismo CRM, sustituyendo su flujo actual por email + Jira
      (`DAILY_LEADS.md`, `JIRA_TEMPLATES.md`) para que ese pipeline también
      quede dentro de casa.

## Cómo retomar

Al empezar una sesión nueva sobre el CRM: leer este fichero, marcar lo que
ya esté hecho, y decir explícitamente en qué sesión se trabaja (para que el
commit y el resumen final queden ligados a ese punto del roadmap).
