"use strict";

const CONFIG = Object.freeze({
  defaultApiBaseUrl: "http://localhost:8001",
  pollingIntervalMs: 500,
  historySize: 300,
  websocketReconnectMs: 2000,
});

const state = {
  robotInfo: null,
  latestTelemetry: null,
  samples: [],
  imuChart: null,
  pollTimer: null,
  requestInProgress: false,
  apiBaseUrl: CONFIG.defaultApiBaseUrl,
  websocket: null,
  reconnectTimer: null,
};

const elements = {
  connectionCard: document.querySelector(".connection-card"),
  connectionStatus: document.querySelector("#connectionStatus"),
  lastUpdate: document.querySelector("#lastUpdate"),
  robotName: document.querySelector("#robotName"),
  robotModel: document.querySelector("#robotModel"),
  motorCount: document.querySelector("#motorCount"),
  motorsBody: document.querySelector("#motorsTable tbody"),
  rollValue: document.querySelector("#rollValue"),
  pitchValue: document.querySelector("#pitchValue"),
  yawValue: document.querySelector("#yawValue"),
  batteryCharge: document.querySelector("#batteryCharge"),
  batteryCurrent: document.querySelector("#batteryCurrent"),
  batteryTemperature: document.querySelector("#batteryTemperature"),
  cellVoltages: document.querySelector("#cellVoltages"),
  legsGrid: document.querySelector(".legs-grid"),
  chartContainer: document.querySelector(".chart-placeholder"),
  chartCanvas: document.querySelector("#imuChart"),
  captureButton: document.querySelector("#captureButton"),
  exportButton: document.querySelector("#exportButton"),
  sampleCount: document.querySelector("#sampleCount"),
  connectionForm: document.querySelector("#connectionForm"),
  apiUrl: document.querySelector("#apiUrl"),
  transportMode: document.querySelector("#transportMode"),
};

function updateConnectionStatus(isConnected, message = "Sin conexión") {
  elements.connectionCard.classList.toggle("is-connected", isConnected);
  elements.connectionStatus.textContent = message;
  elements.captureButton.disabled = !isConnected || !state.latestTelemetry;
}

function formatNumber(value, decimals = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(decimals) : "—";
}

function temperatureClass(temperature) {
  if (temperature < 40) return "temp-normal";
  if (temperature <= 60) return "temp-warning";
  return "temp-danger";
}

function updateMotors(motors) {
  elements.motorCount.textContent = `${motors.length} motores`;
  elements.motorsBody.replaceChildren(
    ...motors.map((motor) => {
      const row = document.createElement("tr");
      const values = [
        motor.nombre || `Motor ${motor.id}`,
        `${formatNumber(motor.temperatura)} °C`,
        `${formatNumber(motor.angulo, 2)} °`,
        `${formatNumber(motor.velocidad, 3)} rad/s`,
        `${formatNumber(motor.torque, 2)} N·m`,
      ];
      values.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if (index === 1) cell.className = `temperature-cell ${temperatureClass(Number(motor.temperatura))}`;
        row.appendChild(cell);
      });
      return row;
    }),
  );
}

function updateImu(imu) {
  elements.rollValue.textContent = formatNumber(imu.roll, 2);
  elements.pitchValue.textContent = formatNumber(imu.pitch, 2);
  elements.yawValue.textContent = formatNumber(imu.yaw, 2);

  if (!state.imuChart) createImuChart();
  if (!state.imuChart) return;

  const chart = state.imuChart;
  chart.data.labels.push(new Date().toLocaleTimeString("es-AR"));
  chart.data.datasets[0].data.push(Number(imu.roll));
  chart.data.datasets[1].data.push(Number(imu.pitch));
  chart.data.datasets[2].data.push(Number(imu.yaw));
  if (chart.data.labels.length > CONFIG.historySize) {
    chart.data.labels.shift();
    chart.data.datasets.forEach((dataset) => dataset.data.shift());
  }
  chart.update("none");
}

function updateBms(bms) {
  elements.batteryCharge.textContent = formatNumber(bms.soc, 0);
  elements.batteryCurrent.textContent = formatNumber(bms.corriente, 0);
  elements.batteryTemperature.textContent = formatNumber(bms.temperatura);
  const cells = Array.isArray(bms.celdas) ? bms.celdas : [];
  if (!cells.length) {
    elements.cellVoltages.className = "cells-placeholder";
    elements.cellVoltages.textContent = "El robot no reporta voltajes de celda.";
    return;
  }
  elements.cellVoltages.className = "cells-grid";
  elements.cellVoltages.replaceChildren(...cells.map((voltage, index) => {
    const cell = document.createElement("div");
    cell.className = "cell-voltage";
    const label = document.createElement("span");
    label.textContent = `Celda ${index + 1}`;
    const value = document.createElement("strong");
    value.textContent = `${formatNumber(voltage, 3)} V`;
    cell.append(label, value);
    return cell;
  }));
}

function updateLegForces(forces) {
  const entries = Object.entries(forces || {});
  if (!entries.length) {
    elements.legsGrid.innerHTML = '<p class="cells-placeholder">Este modelo no reporta fuerzas de contacto.</p>';
    return;
  }
  elements.legsGrid.replaceChildren(...entries.map(([leg, force]) => {
    const isContact = Number(force) > 0;
    const item = document.createElement("article");
    item.className = `leg-indicator ${isContact ? "is-contact" : "is-air"}`;
    const name = document.createElement("span");
    name.textContent = leg;
    const status = document.createElement("small");
    status.textContent = isContact ? "Apoyada" : "En el aire";
    item.append(name, status);
    return item;
  }));
}

async function fetchTelemetry() {
  if (state.requestInProgress) return;
  state.requestInProgress = true;
  try {
    const response = await fetch(`${state.apiBaseUrl}/telemetria`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    renderTelemetry(await response.json());
  } catch (error) {
    updateConnectionStatus(false, "Servidor no disponible");
    elements.lastUpdate.textContent = `Error de conexión · ${error.message}`;
  } finally {
    state.requestInProgress = false;
  }
}

function renderTelemetry(telemetry) {
  if (!telemetry || !Array.isArray(telemetry.motores) || !telemetry.imu || !telemetry.bms) {
    throw new Error("Respuesta de telemetría inválida");
  }
  state.latestTelemetry = telemetry;
  updateMotors(telemetry.motores);
  updateImu(telemetry.imu);
  updateBms(telemetry.bms);
  updateLegForces(telemetry.fuerzas || {});
  updateConnectionStatus(true, "Conectado");
  elements.lastUpdate.textContent = `Última actualización: ${new Date().toLocaleTimeString("es-AR")}`;
}

async function fetchRobotInfo() {
  try {
    const response = await fetch(`${state.apiBaseUrl}/info`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.robotInfo = await response.json();
    elements.robotName.textContent = state.robotInfo.nombre;
    elements.robotModel.textContent = state.robotInfo.modelo;
    elements.motorCount.textContent = `${state.robotInfo.n_motores} motores`;
  } catch {
    elements.robotName.textContent = "Unitree";
    elements.robotModel.textContent = "—";
  }
}

function websocketUrl() {
  const url = new URL(state.apiBaseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = "";
  return url.toString();
}

function stopConnections() {
  window.clearInterval(state.pollTimer);
  window.clearTimeout(state.reconnectTimer);
  state.pollTimer = null;
  state.reconnectTimer = null;
  if (state.websocket) {
    state.websocket.onclose = null;
    state.websocket.close();
    state.websocket = null;
  }
}

function startPolling() {
  if (state.pollTimer) return;
  elements.transportMode.textContent = "REST";
  fetchTelemetry();
  state.pollTimer = window.setInterval(fetchTelemetry, CONFIG.pollingIntervalMs);
}

function connectWebSocket() {
  window.clearInterval(state.pollTimer);
  state.pollTimer = null;
  elements.transportMode.textContent = "WS";
  updateConnectionStatus(false, "Conectando…");
  try {
    const socket = new WebSocket(websocketUrl());
    state.websocket = socket;
    socket.onopen = () => updateConnectionStatus(true, "Conectado");
    socket.onmessage = (event) => {
      try {
        renderTelemetry(JSON.parse(event.data));
      } catch {
        updateConnectionStatus(false, "Datos inválidos");
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (state.websocket !== socket) return;
      state.websocket = null;
      updateConnectionStatus(false, "Reconectando…");
      startPolling();
      state.reconnectTimer = window.setTimeout(connectWebSocket, CONFIG.websocketReconnectMs);
    };
  } catch {
    startPolling();
    state.reconnectTimer = window.setTimeout(connectWebSocket, CONFIG.websocketReconnectMs);
  }
}

async function connectToBackend(rawUrl) {
  stopConnections();
  state.apiBaseUrl = rawUrl.trim().replace(/\/$/, "");
  localStorage.setItem("telemetryApiUrl", state.apiBaseUrl);
  state.latestTelemetry = null;
  await fetchRobotInfo();
  connectWebSocket();
}

function createImuChart() {
  if (typeof Chart === "undefined") return;
  elements.chartContainer.classList.add("has-chart");
  state.imuChart = new Chart(elements.chartCanvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        { label: "Roll", data: [], borderColor: "#36d7c7", tension: 0.25, pointRadius: 0 },
        { label: "Pitch", data: [], borderColor: "#f5b942", tension: 0.25, pointRadius: 0 },
        { label: "Yaw", data: [], borderColor: "#ff6470", tension: 0.25, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { display: false },
        y: { ticks: { color: "#8fa3bd" }, grid: { color: "rgba(143,163,189,.12)" }, title: { display: true, text: "grados", color: "#8fa3bd" } },
      },
      plugins: { legend: { labels: { color: "#eef5ff", usePointStyle: true } } },
    },
  });
}

function captureSample() {
  if (!state.latestTelemetry) return;
  const { modelo, ts, imu, bms, motores, fuerzas } = state.latestTelemetry;
  const motorTemperatures = (motores || []).map((motor) => Number(motor.temperatura)).filter(Number.isFinite);
  state.samples.push({
    capturedAt: new Date().toISOString(), modelo, ts,
    roll: imu?.roll, pitch: imu?.pitch, yaw: imu?.yaw,
    soc: bms?.soc, corriente: bms?.corriente, temperaturaBms: bms?.temperatura,
    temperaturaMaxMotor: motorTemperatures.length ? Math.max(...motorTemperatures) : "",
    fuerzas: JSON.stringify(fuerzas || {}),
  });
  elements.sampleCount.textContent = state.samples.length;
  elements.exportButton.disabled = false;
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv() {
  if (!state.samples.length) return;
  const columns = Object.keys(state.samples[0]);
  const csv = [columns.join(","), ...state.samples.map((sample) => columns.map((column) => csvValue(sample[column])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `telemetria_${new Date().toISOString().replaceAll(":", "-")}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function initializeDashboard() {
  state.apiBaseUrl = localStorage.getItem("telemetryApiUrl") || CONFIG.defaultApiBaseUrl;
  elements.apiUrl.value = state.apiBaseUrl;
  updateConnectionStatus(false, "Conectando…");
  elements.captureButton.addEventListener("click", captureSample);
  elements.exportButton.addEventListener("click", exportCsv);
  elements.connectionForm.addEventListener("submit", (event) => {
    event.preventDefault();
    connectToBackend(elements.apiUrl.value);
  });
  await connectToBackend(state.apiBaseUrl);
}

initializeDashboard();
