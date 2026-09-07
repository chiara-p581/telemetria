# Dashboard de telemetría Unitree

Frontend del TP05 de Desarrollo de Aplicaciones II (UADE). Consume el backend FastAPI oficial de la cátedra sin modificarlo.

## Preparación local

El paquete oficial TP05 se guarda en `_catedra/TP05_Desarrollo_de_Aplicaciones_II` y está excluido de Git porque no forma parte de la entrega.

Crear el entorno e instalar las dependencias una sola vez:

```powershell
.\.venv\Scripts\python.exe -m pip install fastapi uvicorn mujoco
```

## Ejecutar todo

Desde esta carpeta, hacer doble clic en `INICIAR_PROYECTO.bat` o ejecutarlo en PowerShell:

```powershell
.\INICIAR_PROYECTO.bat
```

El lanzador abre el frontend en `http://localhost:5500`, ejecuta el lanzador oficial de la cátedra y deja el backend en `http://localhost:8001`. El lanzador oficial solicita elegir G1 o Go2.

Si el backend se ejecuta en otra computadora, ingresar su dirección en **Servidor de telemetría** y presionar **Conectar**.

## Integración

- Detecta el modelo con `GET /info`.
- Prefiere `WS /ws` para telemetría a aproximadamente 10 Hz.
- Si WebSocket falla, usa `GET /telemetria` cada 500 ms y reintenta la conexión.
- Mantiene un historial IMU circular de 300 muestras.
- Captura muestras manuales y genera el CSV en el navegador mediante Blob.

El backend no forma parte de este repositorio ni debe entregarse.
