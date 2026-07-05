import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAMPLE_COUNT,
  MAX_COMPONENT_FREQUENCY,
  buildSpectrum,
  clamp,
  computeCenterOfMass,
  createComponent,
  createPreset,
  findPeaks,
  generateSamples,
  maxAbsValue,
  normalizeComponent,
  wrapSignal
} from "./fourier";

describe("fourier utilities", () => {
  it("normalizes invalid component input into a bounded immutable component", () => {
    const raw = { id: "x", frequency: Number.NaN, amplitude: 99, phase: -99, color: "" };
    const normalized = normalizeComponent(raw);

    expect(normalized).toEqual({
      id: "x",
      frequency: 1,
      amplitude: 2,
      phase: -Math.PI,
      color: "#7dd3fc"
    });
    expect(normalized).not.toBe(raw);
  });

  it("generates a zero-centered signal with predictable samples", () => {
    const samples = generateSamples({
      components: [{ id: "a", frequency: 1, amplitude: 1, phase: 0, color: "#fff" }],
      duration: 1,
      sampleCount: 5
    });

    expect(samples).toHaveLength(5);
    expect(samples[0]).toMatchObject({ time: 0, value: 0 });
    expect(samples[1].value).toBeCloseTo(1, 6);
    expect(samples[2].value).toBeCloseTo(0, 6);
    expect(samples[3].value).toBeCloseTo(-1, 6);
  });

  it("wraps a pure tone around the selected frequency and exposes a right-shifted center of mass", () => {
    const samples = generateSamples({
      components: [{ id: "a", frequency: 2, amplitude: 1, phase: Math.PI / 2, color: "#fff" }],
      duration: 4,
      sampleCount: DEFAULT_SAMPLE_COUNT
    });
    const wrapped = wrapSignal(samples, 2);
    const center = computeCenterOfMass(wrapped.points);

    expect(wrapped.points).toHaveLength(DEFAULT_SAMPLE_COUNT);
    expect(center.x).toBeGreaterThan(0.45);
    expect(Math.abs(center.y)).toBeLessThan(0.02);
  });

  it("builds spectrum peaks near the frequencies contained in a composite signal", () => {
    const samples = generateSamples({
      components: [
        { id: "a", frequency: 2, amplitude: 1, phase: Math.PI / 2, color: "#fff" },
        { id: "b", frequency: 3, amplitude: 0.7, phase: Math.PI / 2, color: "#fff" }
      ],
      duration: 4,
      sampleCount: DEFAULT_SAMPLE_COUNT
    });
    const spectrum = buildSpectrum(samples, { min: 0, max: 5, steps: 101 });
    const localMaxima = spectrum
      .filter((point, index, all) => {
        const previous = all[index - 1]?.magnitude ?? -Infinity;
        const next = all[index + 1]?.magnitude ?? -Infinity;
        return point.magnitude > previous && point.magnitude > next;
      })
      .sort((a, b) => b.magnitude - a.magnitude)
      .slice(0, 2)
      .map((point) => point.frequency)
      .sort((a, b) => a - b);

    expect(localMaxima[0]).toBeCloseTo(2, 1);
    expect(localMaxima[1]).toBeCloseTo(3, 1);
  });

  it("creates immutable presets and clamps scalar inputs", () => {
    const preset = createPreset("two-three");

    expect(preset.components).toHaveLength(2);
    expect(preset.components[0].color).toBe("#ff7f73");
    expect(createPreset("missing").components).toHaveLength(1);
    expect(clamp(20, 0, 10)).toBe(10);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(Number.NaN, 0, 10)).toBe(0);
  });

  it("handles empty centers, new components, invalid spectrum ranges, and peak limits", () => {
    expect(computeCenterOfMass([])).toEqual({ x: 0, y: 0 });

    const component = normalizeComponent({ id: "", frequency: 100, amplitude: -1, phase: 10 }, 4);
    expect(component).toMatchObject({
      id: "component-4",
      frequency: MAX_COMPONENT_FREQUENCY,
      amplitude: 0,
      phase: Math.PI
    });

    expect(createComponent(99).frequency).toBe(MAX_COMPONENT_FREQUENCY);

    const tinySamples = generateSamples({
      components: [component],
      duration: Number.NaN,
      sampleCount: Number.NaN
    });
    expect(tinySamples).toHaveLength(2);

    const invalidWrapped = wrapSignal(tinySamples, Number.NaN);
    expect(invalidWrapped.frequency).toBe(0);

    const spectrum = buildSpectrum(tinySamples, { min: Number.NaN, max: -1, steps: 2 });
    expect(spectrum).toHaveLength(8);
    expect(spectrum.at(-1)?.frequency).toBeCloseTo(0.1, 6);

    const peaks = findPeaks(
      [
        { frequency: 0, real: 0, imaginary: 0, magnitude: 0 },
        { frequency: 1, real: 1, imaginary: 0, magnitude: 1 },
        { frequency: 2, real: 0, imaginary: 0, magnitude: 0 },
        { frequency: 3, real: 2, imaginary: 0, magnitude: 2 },
        { frequency: 4, real: 0, imaginary: 0, magnitude: 0 }
      ],
      99
    );
    expect(peaks.map((peak) => peak.frequency)).toEqual([3, 1]);
    expect(findPeaks([{ frequency: 5, real: 4, imaginary: 0, magnitude: 4 }])).toEqual([]);
    expect(maxAbsValue([-3, 2, 0])).toBe(3);
    expect(maxAbsValue([])).toBe(1);
  });
});
