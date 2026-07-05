export const TAU = Math.PI * 2;
export const DEFAULT_DURATION = 4;
export const DEFAULT_SAMPLE_COUNT = 512;
export const DEFAULT_COLOR = "#7dd3fc";
export const MAX_COMPONENT_FREQUENCY = 5;

export type SignalComponent = {
  id: string;
  frequency: number;
  amplitude: number;
  phase: number;
  color: string;
};

export type SignalSample = {
  time: number;
  value: number;
  componentValues: number[];
};

export type WrappedPoint = {
  time: number;
  value: number;
  x: number;
  y: number;
};

export type CenterOfMass = {
  x: number;
  y: number;
};

export type SpectrumPoint = {
  frequency: number;
  real: number;
  imaginary: number;
  magnitude: number;
};

export type Preset = {
  id: string;
  label: string;
  components: SignalComponent[];
  windingFrequency: number;
};

export type SpectrumRange = {
  min: number;
  max: number;
  steps: number;
};

export type SampleOptions = {
  components: SignalComponent[];
  duration?: number;
  sampleCount?: number;
};

const palette = ["#9cc58a", "#ff7f73", "#f8d95d", "#5fd1c7", "#c084fc"];

const presets: Record<string, Preset> = {
  pure: {
    id: "pure",
    label: "2Hz 単音",
    windingFrequency: 2,
    components: [
      { id: "pure-a", frequency: 2, amplitude: 1, phase: Math.PI / 2, color: palette[0] }
    ]
  },
  "two-three": {
    id: "two-three",
    label: "2Hz + 3Hz",
    windingFrequency: 2,
    components: [
      { id: "mix-a", frequency: 2, amplitude: 1, phase: Math.PI / 2, color: palette[1] },
      { id: "mix-b", frequency: 3, amplitude: 0.7, phase: Math.PI / 2, color: palette[2] }
    ]
  },
  beat: {
    id: "beat",
    label: "うなり",
    windingFrequency: 2.2,
    components: [
      { id: "beat-a", frequency: 2, amplitude: 0.9, phase: Math.PI / 2, color: palette[3] },
      { id: "beat-b", frequency: 2.35, amplitude: 0.9, phase: Math.PI / 2, color: palette[4] }
    ]
  },
  square: {
    id: "square",
    label: "方形波風",
    windingFrequency: 1,
    components: [
      { id: "sq-a", frequency: 1, amplitude: 1, phase: Math.PI / 2, color: palette[0] },
      { id: "sq-b", frequency: 3, amplitude: 0.33, phase: Math.PI / 2, color: palette[1] },
      { id: "sq-c", frequency: 5, amplitude: 0.2, phase: Math.PI / 2, color: palette[2] }
    ]
  }
};

export const presetList = Object.values(presets).map((preset) => ({
  id: preset.id,
  label: preset.label
}));

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function normalizeComponent(component: Partial<SignalComponent>, fallbackIndex = 0): SignalComponent {
  const id = typeof component.id === "string" && component.id.trim() ? component.id : `component-${fallbackIndex}`;
  const frequency = clamp(finiteOr(component.frequency, 1), 0.05, MAX_COMPONENT_FREQUENCY);
  const amplitude = clamp(finiteOr(component.amplitude, 1), 0, 2);
  const phase = clamp(finiteOr(component.phase, 0), -Math.PI, Math.PI);
  const color =
    typeof component.color === "string" && /^#[0-9a-f]{3,8}$/i.test(component.color)
      ? component.color
      : DEFAULT_COLOR;

  return { id, frequency, amplitude, phase, color };
}

export function createPreset(id: string): Preset {
  const source = presets[id] ?? presets.pure;
  return {
    ...source,
    components: source.components.map((component, index) => normalizeComponent(component, index))
  };
}

export function createComponent(index: number): SignalComponent {
  return normalizeComponent(
    {
      id: `component-${Date.now()}-${index}`,
      frequency: clamp(index + 1, 0.05, MAX_COMPONENT_FREQUENCY),
      amplitude: 0.6,
      phase: Math.PI / 2,
      color: palette[index % palette.length]
    },
    index
  );
}

export function generateSamples(options: SampleOptions): SignalSample[] {
  const duration = clamp(options.duration ?? DEFAULT_DURATION, 0.5, 10);
  const sampleCount = Math.round(clamp(options.sampleCount ?? DEFAULT_SAMPLE_COUNT, 2, 2048));
  const components = options.components.map((component, index) => normalizeComponent(component, index));

  return Array.from({ length: sampleCount }, (_, index) => {
    const time = (index / (sampleCount - 1)) * duration;
    const componentValues = components.map((component) => {
      return component.amplitude * Math.sin(TAU * component.frequency * time + component.phase);
    });
    const value = componentValues.reduce((sum, current) => sum + current, 0);

    return { time, value, componentValues };
  });
}

export function wrapSignal(samples: SignalSample[], windingFrequency: number): { frequency: number; points: WrappedPoint[] } {
  const frequency = clamp(windingFrequency, 0, 10);
  const points = samples.map((sample) => {
    const angle = -TAU * frequency * sample.time;
    return {
      time: sample.time,
      value: sample.value,
      x: sample.value * Math.cos(angle),
      y: sample.value * Math.sin(angle)
    };
  });

  return { frequency, points };
}

export function computeCenterOfMass(points: WrappedPoint[]): CenterOfMass {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  const total = points.reduce(
    (sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length
  };
}

export function buildSpectrum(samples: SignalSample[], range: SpectrumRange): SpectrumPoint[] {
  const min = clamp(range.min, 0, 10);
  const max = Math.max(min + 0.1, clamp(range.max, 0.1, 12));
  const steps = Math.round(clamp(range.steps, 8, 512));

  return Array.from({ length: steps }, (_, index) => {
    const frequency = min + ((max - min) * index) / (steps - 1);
    const center = computeCenterOfMass(wrapSignal(samples, frequency).points);

    return {
      frequency,
      real: center.x,
      imaginary: center.y,
      magnitude: Math.hypot(center.x, center.y)
    };
  });
}

export function findPeaks(spectrum: SpectrumPoint[], limit = 3): SpectrumPoint[] {
  return spectrum
    .filter((point, index, all) => {
      if (index === 0 || index === all.length - 1) {
        return false;
      }
      const previous = all[index - 1].magnitude;
      const next = all[index + 1].magnitude;
      return point.magnitude > previous && point.magnitude > next;
    })
    .sort((a, b) => b.magnitude - a.magnitude)
    .slice(0, Math.round(clamp(limit, 1, 8)));
}

export function maxAbsValue(values: number[]): number {
  return Math.max(1, ...values.map((value) => Math.abs(value)));
}
