# Roadmap del CRM propio — por sesiones

Plan para seguir construyendo el CRM (`crm/`, ver `CRM_LEADS.md`) en sesiones
sueltas de Claude Code, cada una con un objetivo cerrado y entregable. Los
tics se van marcando aquí para que una sesión nueva sepa por dónde va esto
sin tener que releer todo el historial.

## Hecho

- [x] **Sesión 0 — Base del CRM.** Ingesta unificada (Meta Ads, Google Ads,
      formularios web), modelo de lead único, almacén JSON, dashboard
      (filtros, ficha, notas, estados, export CSV), Basic Auth, test
      end-to-end (`npm run crm:test`). Ver `CRM_LEADS.md`.

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
        (`crm/.env.example` trae la lista completa).
      - Validar con un lead de prueba de cada canal: el "lead de prueba" de
        Meta, el botón "enviar solicitud de prueba" de Google Ads, y un
        envío real desde un formulario.

- [ ] **Sesión 2 — Notificación de lead nuevo.**
      Aviso automático (email por Gmail, y si interesa, Slack/WhatsApp) en
      cuanto entra un lead, para no depender de refrescar el panel. Tamaño:
      pequeño — reutiliza el conector de Gmail ya disponible.

- [ ] **Sesión 3 — Puente a Jira.**
      Botón "Enviar a Jira" en la ficha del lead que reutiliza
      `jira-lead-templates.mjs` (`construyeTareaLead`) para crear la tarea
      con un clic en vez de copiar los datos a mano. Requiere decidir cómo
      se autentica el servidor contra Jira (API token de Atlassian) ya que
      el CRM corre fuera de una sesión de Claude.

- [ ] **Sesión 4 — Multiusuario y copias de seguridad.**
      Hoy el panel es una única contraseña compartida (`CRM_USER`/`CRM_PASS`)
      y el almacén es un solo JSON sin backup. Si el equipo va a vivir en
      esto: login por persona + backup automático (cron que copia
      `leads.json` a Drive o similar).

- [ ] **Sesión 5 — Métricas.**
      Leads por semana/mes y por fuente, tasa de conversión por estado, y
      —si interesa— coste por lead cruzando con el gasto real de Meta/Google
      Ads (ya hay herramientas MCP de Meta Business disponibles para esto).

- [ ] **Sesión 6 (opcional) — Más canales.**
      Enchufar el scanner de LinkedIn (`scan.mjs`) como una fuente más del
      mismo CRM en vez de su flujo actual por email aparte (`DAILY_LEADS.md`).

## Cómo retomar

Al empezar una sesión nueva sobre el CRM: leer este fichero, marcar lo que
ya esté hecho, y decir explícitamente en qué sesión se trabaja (para que el
commit y el resumen final queden ligados a ese punto del roadmap).
