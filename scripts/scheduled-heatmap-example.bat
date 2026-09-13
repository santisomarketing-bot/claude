@echo off
REM Plantilla para programar una corrida de maps-scan.mjs (Programador de tareas
REM de Windows). Copiala, cambiale el nombre por cliente, y ajusta los valores
REM de abajo. Ver SCHEDULED_SCANS.md para el paso a paso completo.

cd /d "%~dp0.."

call npm run maps-scan -- --mode=heatmap ^
  --center=41.3874,2.1686 ^
  --term="peluqueria en el centro" ^
  --target="Cliente S.L." ^
  --radius-km=5 ^
  --size=5 ^
  --out=radar-cliente ^
  --append ^
  --headless
