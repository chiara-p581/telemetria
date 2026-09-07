# Dashboard de telemetría Unitree

Frontend del TP05 de Desarrollo de Aplicaciones II (UADE). Consume el backend FastAPI oficial de la cátedra sin modificarlo.

## Ejecutar

1. Iniciar el backend/simulador oficial, que por defecto escucha en `http://localhost:8001`.
2. En esta carpeta ejecutar `python -m http.server 5500`.
3. Abrir `http://localhost:5500/dashboard.html`.

Si el backend se ejecuta en otra computadora, ingresar su dirección en **Servidor de telemetría** y presionar **Conectar**.

## Integración

- Detecta el modelo con `GET /info`.
- Prefiere `WS /ws` para telemetría a aproximadamente 10 Hz.
- Si WebSocket falla, usa `GET /telemetria` cada 500 ms y reintenta la conexión.
- Mantiene un historial IMU circular de 300 muestras.
- Captura muestras manuales y genera el CSV en el navegador mediante Blob.

El backend no forma parte de este repositorio ni debe entregarse.
