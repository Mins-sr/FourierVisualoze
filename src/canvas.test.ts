import { describe, expect, it, vi } from "vitest";
import { drawSpectrum, drawWaveform, drawWinding, setupCanvas } from "./canvas";
import {
  buildSpectrum,
  computeCenterOfMass,
  generateSamples,
  wrapSignal,
  type SignalComponent
} from "./lib/fourier";

type MockContext = CanvasRenderingContext2D & {
  calls: string[];
  textCalls: string[];
};

function createMockContext(): MockContext {
  const calls: string[] = [];
  const textCalls: string[] = [];
  const record = (name: string) =>
    vi.fn(() => {
      calls.push(name);
    });

  const context = {
    calls,
    textCalls,
    setTransform: record("setTransform"),
    clearRect: record("clearRect"),
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    stroke: record("stroke"),
    fill: record("fill"),
    arc: record("arc"),
    fillText: vi.fn((text: string) => {
      calls.push("fillText");
      textCalls.push(text);
    }),
    setLineDash: record("setLineDash")
  } as unknown as MockContext;

  return context;
}

function createCanvas(width = 480, height = 300, context = createMockContext()) {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getBoundingClientRect", {
    value: () => ({ width, height, top: 0, left: 0, right: width, bottom: height })
  });
  Object.defineProperty(canvas, "getContext", {
    value: vi.fn(() => context)
  });

  return { canvas, context };
}

describe("canvas drawing", () => {
  it("sets backing dimensions and handles a missing drawing context", () => {
    const { canvas, context } = createCanvas(320, 160);

    expect(setupCanvas(canvas)).toBe(context);
    expect(canvas.width).toBeGreaterThanOrEqual(320);
    expect(canvas.height).toBeGreaterThanOrEqual(160);
    expect(context.calls).toContain("clearRect");

    const emptyCanvas = document.createElement("canvas");
    Object.defineProperty(emptyCanvas, "getContext", { value: vi.fn(() => null) });
    expect(setupCanvas(emptyCanvas)).toBeNull();
  });

  it("draws waveform, winding, and spectrum panels from sampled data", () => {
    const components: SignalComponent[] = [
      { id: "a", frequency: 2, amplitude: 1, phase: Math.PI / 2, color: "#ff7f73" },
      { id: "b", frequency: 3, amplitude: 0.7, phase: Math.PI / 2, color: "#f8d95d" }
    ];
    const samples = generateSamples({ components, duration: 4, sampleCount: 96 });
    const wrapped = wrapSignal(samples, 2);
    const center = computeCenterOfMass(wrapped.points);
    const spectrum = buildSpectrum(samples, { min: 0, max: 5, steps: 41 });

    const waveform = createCanvas();
    drawWaveform(waveform.canvas, samples, components, 2);
    expect(waveform.context.calls.filter((call) => call === "stroke").length).toBeGreaterThan(4);
    expect(waveform.context.calls).toContain("fillText");

    const winding = createCanvas(360, 360);
    drawWinding(winding.canvas, wrapped.points, center, 2);
    expect(winding.context.calls).toContain("arc");
    expect(winding.context.calls).toContain("fill");

    const spectrumCanvas = createCanvas(520, 260);
    drawSpectrum(spectrumCanvas.canvas, spectrum, 2);
    expect(spectrumCanvas.context.calls.filter((call) => call === "fillText").length).toBeGreaterThan(1);
    expect(spectrumCanvas.context.textCalls).toContain("重心のずれ");
    expect(spectrumCanvas.context.textCalls).toContain("Magnitude");
    expect(spectrumCanvas.context.textCalls).toContain("0.00");
  });

  it("draws trace progress overlays for fixed-frequency playback", () => {
    const components: SignalComponent[] = [
      { id: "a", frequency: 3, amplitude: 1, phase: Math.PI / 2, color: "#f8d95d" }
    ];
    const samples = generateSamples({ components, duration: 4, sampleCount: 64 });
    const wrapped = wrapSignal(samples, 3);
    const partial = wrapped.points.slice(0, 18);
    const center = computeCenterOfMass(partial);

    const waveform = createCanvas();
    drawWaveform(waveform.canvas, samples, components, 3, 1.2);
    expect(waveform.context.calls.filter((call) => call === "stroke").length).toBeGreaterThan(5);

    const winding = createCanvas(360, 360);
    drawWinding(winding.canvas, partial, center, 3, {
      isTracing: true,
      progress: 0.28,
      referencePoints: wrapped.points
    });
    expect(winding.context.calls.filter((call) => call === "fill").length).toBeGreaterThanOrEqual(2);
    expect(winding.context.calls.filter((call) => call === "fillText").length).toBeGreaterThanOrEqual(2);
  });

  it("returns early for empty drawing data", () => {
    const waveform = createCanvas();
    drawWaveform(waveform.canvas, [], [], 1);
    expect(waveform.context.calls).toContain("clearRect");
    expect(waveform.context.calls).not.toContain("stroke");

    const winding = createCanvas();
    drawWinding(winding.canvas, [], { x: 0, y: 0 }, 1);
    expect(winding.context.calls).toContain("clearRect");
    expect(winding.context.calls).not.toContain("stroke");

    const spectrum = createCanvas();
    drawSpectrum(spectrum.canvas, [], 1);
    expect(spectrum.context.calls).toContain("clearRect");
    expect(spectrum.context.calls).not.toContain("stroke");

    const singlePointSpectrum = createCanvas();
    drawSpectrum(
      singlePointSpectrum.canvas,
      [{ frequency: 1, real: 0.2, imaginary: 0, magnitude: 0.2 }],
      1
    );
    expect(singlePointSpectrum.context.calls).toContain("clearRect");
  });
});
