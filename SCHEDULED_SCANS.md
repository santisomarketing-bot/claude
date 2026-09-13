# Rastreos programados (heatmap / prospect / serp-scan)

Cómo automatizar corridas periódicas de `maps-scan.mjs` / `serp-scan.mjs` sin tener que lanzarlas
a mano cada vez — para tener, por ejemplo, un `--mode=heatmap --append` semanal que alimente el
gráfico de evolución de [Radar Local](https://claude.ai/code/artifact/3e5bf41d-4fe6-4fd1-a9f1-3873b6de2649).

## Por qué esto NO es un workflow de GitHub Actions

El audit (`ai-audit.mjs` en `AEO-core`) sí se programa con GitHub Actions porque solo hace
`fetch()` a URLs públicas — no necesita sesión de nadie.

`maps-scan.mjs` y `serp-scan.mjs` en cambio dependen de **tu sesión de Google**, guardada en
`.chrome-profile-maps/` en tu máquina. Esa carpeta:

- No se sube a git (está en `.gitignore`, y no debería subirse nunca — son cookies de sesión).
- No existe en un runner de GitHub Actions (arranca limpio en cada corrida).
- Aunque se pudiera subir, correr esto desde IPs de datacenter de GitHub aumenta mucho el riesgo
  de que Google lo marque como bot.

Por eso el rastreo programado tiene que correr **en tu propia máquina**, con tu perfil ya
logueado. En Windows, la herramienta nativa para esto es el **Programador de tareas**.

## 1) Preparar el script para tu cliente

Copiá [`scripts/scheduled-heatmap-example.bat`](./scripts/scheduled-heatmap-example.bat), ponele
un nombre por cliente (ej. `scripts/scheduled-heatmap-cliente-x.bat`) y editá los valores de
`--center`, `--term`, `--target` y `--out`.

```bat
call npm run maps-scan -- --mode=heatmap ^
  --center=41.3874,2.1686 ^
  --term="peluqueria en el centro" ^
  --target="Cliente S.L." ^
  --radius-km=5 ^
  --size=5 ^
  --out=radar-cliente ^
  --append ^
  --headless
```

`--append` es lo que construye el histórico (necesario para el gráfico de evolución).
`--headless` corre sin ventana — más cómodo para algo desatendido, pero **más fácil de detectar
como bot** (ver el aviso en `MAPS_SCAN.md`). Si preferís minimizar ese riesgo y no te molesta que
se abra una ventana de Chrome mientras corre, sacá `--headless` del `.bat` y programá la tarea
con la opción "solo si el usuario inició sesión" (ver paso 3).

## 2) Probarlo a mano primero

Antes de programarlo, corré el `.bat` haciendo doble clic (o desde `cmd`) y confirmá que termina
bien y que `radar-cliente.csv` se actualiza. Si algo falla acá, va a fallar igual programado —
más difícil de diagnosticar sin verlo en vivo.

## 3) Programar la tarea (Programador de tareas de Windows)

1. Buscá **"Programador de tareas"** en el menú de inicio y abrilo.
2. **Acción** → **Crear tarea básica...**
3. Nombre: algo identificable (ej. `Radar Local - Cliente X - semanal`).
4. Desencadenador: **Semanalmente**, elegí día y hora (por ejemplo, lunes a las 8:00, antes de
   armar el informe mensual).
5. Acción: **Iniciar un programa** → **Examinar...** → seleccioná tu `.bat`.
6. Al terminar el asistente, abrí las **Propiedades** de la tarea recién creada:
   - Pestaña **General**: marcá **"Ejecutar tanto si el usuario inició sesión como si no"** solo
     si usás `--headless` en el `.bat` — sin `--headless`, la tarea necesita una sesión de
     escritorio activa para poder abrir la ventana de Chrome, así que dejá **"Ejecutar solo si el
     usuario inició sesión"**.
   - Pestaña **Condiciones**: si querés que corra aunque la notebook esté con batería o
     "dormida", ajustá **"Activar el equipo para ejecutar esta tarea"**.
7. **Aceptar**. Podés forzar una corrida de prueba con clic derecho → **Ejecutar**.

## 4) Qué hacer con el resultado

Cada corrida deja `radar-cliente.csv` actualizado (con todo el histórico acumulado gracias a
`--append`) en la carpeta del repo. Para verlo en Radar Local: abrí el panel → **Cargar CSV
real** → seleccioná ese fichero. Si querés automatizar también esa parte (que el CSV se suba
solo a algún lado), esa pieza no está construida — hoy es un paso manual de subir el fichero al
panel.

## Lo mismo aplica a `serp-scan.mjs` y a `--mode=prospect`

Mismo patrón: copiá un `.bat` con el comando que corresponda, probalo a mano, programalo. La
única diferencia es que esos modos no tienen `--append` implementado (no acumulan histórico
todavía) — cada corrida programada pisa la salida anterior.
