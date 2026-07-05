import type { CenterOfMass, SignalComponent, SignalSample, SpectrumPoint, WrappedPoint } from "./lib/fourier";
import { findPeaks, maxAbsValue } from "./lib/fourier";

type DrawTheme = {
  axis: string;
  grid: string;
  muted: string;
  text: string;
  wave: string;
  accent: string;
  secondary: string;
  peak: string;
};

export const theme: DrawTheme = {
  axis: "#e8ece6",
  grid: "rgba(126, 211, 252, 0.22)",
  muted: "rgba(232, 236, 230, 0.45)",
  text: "#f7f2e8",
  wave: "#9cc58a",
  accent: "#ff7f73",
  secondary: "#5fd1c7",
  peak: "#f8d95d"
};

export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(rect.width * density));
  const height = Math.max(1, Math.floor(rect.height * density));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(density, 0, 0, density, 0, 0);
  context.clearRect(0, 0, rect.width, rect.height);
  return context;
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number, columns: number, rows: number) {
  context.save();
  context.strokeStyle = theme.grid;
  context.lineWidth = 1;
  context.beginPath();
  for (let index = 0; index <= columns; index += 1) {
    const x = (width * index) / columns;
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let index = 0; index <= rows; index += 1) {
    const y = (height * index) / rows;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
  context.restore();
}

function drawPolyline(
  context: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  width = 2,
  alpha = 1
) {
  if (points.length < 2) {
    return;
  }

  context.save();
  context.globalAlpha = alpha;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  context.restore();
}

export function drawWaveform(
  canvas: HTMLCanvasElement,
  samples: SignalSample[],
  components: SignalComponent[],
  selectedFrequency: number
) {
  const context = setupCanvas(canvas);
  if (!context || samples.length === 0) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  const padding = { left: 48, right: 22, top: 26, bottom: 36 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const max = maxAbsValue(samples.map((sample) => sample.value));
  const duration = samples.at(-1)?.time ?? 1;
  const xFor = (time: number) => padding.left + (time / duration) * graphWidth;
  const yFor = (value: number) => padding.top + graphHeight / 2 - (value / max) * (graphHeight / 2) * 0.86;

  drawGrid(context, width, height, 8, 4);
  context.strokeStyle = theme.axis;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, padding.top + graphHeight);
  context.moveTo(padding.left, padding.top + graphHeight / 2);
  context.lineTo(width - padding.right, padding.top + graphHeight / 2);
  context.stroke();

  components.forEach((component, componentIndex) => {
    const points = samples.map((sample) => ({
      x: xFor(sample.time),
      y: yFor(sample.componentValues[componentIndex] ?? 0)
    }));
    drawPolyline(context, points, component.color, 1.3, 0.45);
  });

  drawPolyline(
    context,
    samples.map((sample) => ({ x: xFor(sample.time), y: yFor(sample.value) })),
    theme.wave,
    3
  );

  context.save();
  context.setLineDash([5, 7]);
  context.strokeStyle = theme.muted;
  context.lineWidth = 1.5;
  for (let time = 0; time <= duration + 0.001; time += 1 / Math.max(selectedFrequency, 0.25)) {
    const x = xFor(time);
    context.beginPath();
    context.moveTo(x, padding.top);
    context.lineTo(x, padding.top + graphHeight);
    context.stroke();
  }
  context.restore();

  context.fillStyle = theme.text;
  context.font = "600 13px Inter, system-ui, sans-serif";
  context.fillText("Intensity", padding.left + 6, padding.top + 16);
  context.fillText("Time", width - padding.right - 48, padding.top + graphHeight + 26);
}

export function drawWinding(
  canvas: HTMLCanvasElement,
  points: WrappedPoint[],
  center: CenterOfMass,
  selectedFrequency: number
) {
  const context = setupCanvas(canvas);
  if (!context || points.length === 0) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  const size = Math.min(width, height) * 0.76;
  const origin = { x: width / 2, y: height / 2 + 10 };
  const max = maxAbsValue(points.flatMap((point) => [point.x, point.y]));
  const scale = size / 2 / max;
  const toScreen = (point: { x: number; y: number }) => ({
    x: origin.x + point.x * scale,
    y: origin.y - point.y * scale
  });

  drawGrid(context, width, height, 8, 8);
  context.strokeStyle = theme.axis;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(origin.x, 20);
  context.lineTo(origin.x, height - 20);
  context.moveTo(20, origin.y);
  context.lineTo(width - 20, origin.y);
  context.stroke();

  context.save();
  context.setLineDash([4, 6]);
  context.strokeStyle = theme.muted;
  context.beginPath();
  context.arc(origin.x, origin.y, scale, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  drawPolyline(
    context,
    points.map((point) => toScreen(point)),
    theme.wave,
    2.5
  );

  const centerScreen = toScreen(center);
  context.strokeStyle = theme.axis;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(origin.x, origin.y);
  context.lineTo(centerScreen.x, centerScreen.y);
  context.stroke();

  context.fillStyle = theme.accent;
  context.shadowColor = theme.accent;
  context.shadowBlur = 14;
  context.beginPath();
  context.arc(centerScreen.x, centerScreen.y, 7, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;

  context.fillStyle = theme.text;
  context.font = "600 13px Inter, system-ui, sans-serif";
  context.fillText(`${selectedFrequency.toFixed(2)} cycles / second`, 18, 28);
}

export function drawSpectrum(canvas: HTMLCanvasElement, spectrum: SpectrumPoint[], selectedFrequency: number) {
  const context = setupCanvas(canvas);
  if (!context || spectrum.length === 0) {
    return;
  }

  const { width, height } = canvas.getBoundingClientRect();
  const padding = { left: 48, right: 22, top: 28, bottom: 36 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const minFrequency = spectrum[0]?.frequency ?? 0;
  const maxFrequency = spectrum.at(-1)?.frequency ?? 1;
  const maxMagnitude = maxAbsValue(spectrum.map((point) => point.magnitude));
  const xFor = (frequency: number) =>
    padding.left + ((frequency - minFrequency) / (maxFrequency - minFrequency || 1)) * graphWidth;
  const yFor = (value: number) => padding.top + graphHeight - (value / maxMagnitude) * graphHeight * 0.9;

  drawGrid(context, width, height, 10, 4);
  context.strokeStyle = theme.axis;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(padding.left, padding.top);
  context.lineTo(padding.left, padding.top + graphHeight);
  context.lineTo(width - padding.right, padding.top + graphHeight);
  context.stroke();

  drawPolyline(
    context,
    spectrum.map((point) => ({ x: xFor(point.frequency), y: yFor(point.real) })),
    theme.accent,
    1.5,
    0.62
  );
  drawPolyline(
    context,
    spectrum.map((point) => ({ x: xFor(point.frequency), y: yFor(point.magnitude) })),
    theme.secondary,
    3
  );

  context.save();
  context.setLineDash([6, 6]);
  context.strokeStyle = theme.peak;
  context.lineWidth = 1.5;
  const selectedX = xFor(selectedFrequency);
  context.beginPath();
  context.moveTo(selectedX, padding.top);
  context.lineTo(selectedX, padding.top + graphHeight);
  context.stroke();
  context.restore();

  findPeaks(spectrum, 3).forEach((peak) => {
    const x = xFor(peak.frequency);
    const y = yFor(peak.magnitude);
    context.fillStyle = theme.peak;
    context.beginPath();
    context.arc(x, y, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = theme.text;
    context.font = "600 12px Inter, system-ui, sans-serif";
    context.fillText(`${peak.frequency.toFixed(2)}Hz`, x + 8, y - 8);
  });

  context.fillStyle = theme.text;
  context.font = "600 13px Inter, system-ui, sans-serif";
  context.fillText("Frequency", width - padding.right - 72, padding.top + graphHeight + 26);
}
