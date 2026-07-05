import { Pause, Play, Plus, RotateCcw, Trash2, Waves } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { drawSpectrum, drawWaveform, drawWinding } from "./canvas";
import {
  DEFAULT_DURATION,
  DEFAULT_SAMPLE_COUNT,
  SignalComponent,
  buildSpectrum,
  clamp,
  computeCenterOfMass,
  createComponent,
  createPreset,
  generateSamples,
  normalizeComponent,
  presetList,
  wrapSignal
} from "./lib/fourier";
import "./styles.css";

const spectrumRange = { min: 0, max: 5, steps: 181 };
const initialPreset = createPreset("two-three");
const traceDurationSeconds = DEFAULT_DURATION;

type PlaybackMode = "sweep" | "trace";

function formatNumber(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function App() {
  const waveformCanvas = useRef<HTMLCanvasElement | null>(null);
  const windingCanvas = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvas = useRef<HTMLCanvasElement | null>(null);
  const [presetId, setPresetId] = useState(initialPreset.id);
  const [resetPresetId, setResetPresetId] = useState(initialPreset.id);
  const [components, setComponents] = useState<SignalComponent[]>(initialPreset.components);
  const [windingFrequency, setWindingFrequency] = useState(initialPreset.windingFrequency);
  const [sampleCount, setSampleCount] = useState(DEFAULT_SAMPLE_COUNT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("sweep");
  const [traceProgress, setTraceProgress] = useState(1);

  const samples = useMemo(
    () => generateSamples({ components, duration: DEFAULT_DURATION, sampleCount }),
    [components, sampleCount]
  );
  const wrapped = useMemo(() => wrapSignal(samples, windingFrequency), [samples, windingFrequency]);
  const tracePointCount = Math.max(1, Math.ceil(wrapped.points.length * traceProgress));
  const visibleWrappedPoints = useMemo(
    () => (playbackMode === "trace" ? wrapped.points.slice(0, tracePointCount) : wrapped.points),
    [playbackMode, tracePointCount, wrapped.points]
  );
  const center = useMemo(() => computeCenterOfMass(visibleWrappedPoints), [visibleWrappedPoints]);
  const spectrum = useMemo(() => buildSpectrum(samples, spectrumRange), [samples]);
  const activeTraceTime = playbackMode === "trace" ? traceProgress * DEFAULT_DURATION : undefined;

  useEffect(() => {
    const render = () => {
      if (waveformCanvas.current) {
        drawWaveform(waveformCanvas.current, samples, components, windingFrequency, activeTraceTime);
      }
      if (windingCanvas.current) {
        drawWinding(windingCanvas.current, visibleWrappedPoints, center, windingFrequency, {
          isTracing: playbackMode === "trace",
          progress: traceProgress,
          referencePoints: wrapped.points
        });
      }
      if (spectrumCanvas.current) {
        drawSpectrum(spectrumCanvas.current, spectrum, windingFrequency);
      }
    };

    render();
    window.addEventListener("resize", render);
    return () => window.removeEventListener("resize", render);
  }, [
    activeTraceTime,
    center,
    components,
    playbackMode,
    samples,
    spectrum,
    traceProgress,
    visibleWrappedPoints,
    windingFrequency,
    wrapped.points
  ]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.08, (now - previous) / 1000);
      previous = now;
      if (playbackMode === "sweep") {
        setWindingFrequency((current) => {
          const next = current + delta * 0.55;
          return next > spectrumRange.max ? spectrumRange.min : next;
        });
      } else {
        setTraceProgress((current) => {
          const next = current + delta / traceDurationSeconds;
          if (next >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return next;
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [isPlaying, playbackMode]);

  const applyPreset = (id: string) => {
    const preset = createPreset(id);
    setPresetId(preset.id);
    setResetPresetId(preset.id);
    setComponents(preset.components);
    setWindingFrequency(preset.windingFrequency);
    setTraceProgress(1);
  };

  const updateFrequency = (value: number) => {
    setWindingFrequency(clamp(value, spectrumRange.min, spectrumRange.max));
  };

  const updatePlaybackMode = (mode: PlaybackMode) => {
    setPlaybackMode(mode);
    setTraceProgress(1);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    if (playbackMode === "trace" && traceProgress >= 1) {
      setTraceProgress(0);
    }
    setIsPlaying(true);
  };

  const updateComponent = (id: string, patch: Partial<SignalComponent>) => {
    setComponents((current) =>
      current.map((component, index) =>
        component.id === id ? normalizeComponent({ ...component, ...patch }, index) : component
      )
    );
    setPresetId("custom");
  };

  const addComponent = () => {
    setComponents((current) => [...current, createComponent(current.length)]);
    setPresetId("custom");
    setTraceProgress(1);
  };

  const removeComponent = (id: string) => {
    setComponents((current) => {
      const next = current.filter((component) => component.id !== id);
      return next.length > 0 ? next : current;
    });
    setPresetId("custom");
  };

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="フーリエ可視化">
        <header className="topbar">
          <div className="brand">
            <Waves aria-hidden="true" size={28} />
            <div>
              <h1>Fourier Visualoze</h1>
              <p>Time Domain / Winding / Frequency Domain</p>
            </div>
          </div>
          <div className="metrics" aria-label="現在の重心">
            <span>x: {center.x.toFixed(3)}</span>
            <span>y: {center.y.toFixed(3)}</span>
          </div>
        </header>

        <div className="visual-grid">
          <section className="visual-panel waveform-panel">
            <div className="panel-header">
              <h2>時間波形</h2>
              <span>{components.length} components</span>
            </div>
            <canvas ref={waveformCanvas} aria-label="時間波形" />
          </section>

          <section className="visual-panel winding-panel">
            <div className="panel-header">
              <h2>巻き取り平面</h2>
              <span>{windingFrequency.toFixed(2)} Hz</span>
            </div>
            <canvas ref={windingCanvas} aria-label="巻き取り平面" />
          </section>

          <section className="visual-panel spectrum-panel">
            <div className="panel-header">
              <h2>周波数スペクトル</h2>
              <span>0-5 Hz</span>
            </div>
            <canvas ref={spectrumCanvas} aria-label="周波数スペクトル" />
          </section>
        </div>
      </section>

      <aside className="control-surface" aria-label="操作パネル">
        <div className="control-block">
          <label htmlFor="preset">プリセット</label>
          <select id="preset" value={presetId} onChange={(event) => applyPreset(event.target.value)}>
            {presetId === "custom" ? <option value="custom">カスタム</option> : null}
            {presetList.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="control-block frequency-block">
          <div className="label-row">
            <label htmlFor="winding-frequency">巻き取り周波数</label>
            <output>{windingFrequency.toFixed(2)} Hz</output>
          </div>
          <div className="mode-switch" aria-label="再生モード">
            <button
              type="button"
              aria-pressed={playbackMode === "sweep"}
              onClick={() => updatePlaybackMode("sweep")}
            >
              周波数を掃引
            </button>
            <button
              type="button"
              aria-pressed={playbackMode === "trace"}
              onClick={() => updatePlaybackMode("trace")}
            >
              軌跡を描く
            </button>
          </div>
          {playbackMode === "trace" ? (
            <div className="label-row trace-status">
              <span>軌跡進捗</span>
              <output aria-label="軌跡進捗">{Math.round(traceProgress * 100)}%</output>
            </div>
          ) : null}
          <input
            id="winding-frequency"
            aria-label="巻き取り周波数"
            type="range"
            min={spectrumRange.min}
            max={spectrumRange.max}
            step="0.01"
            value={formatNumber(windingFrequency)}
            onChange={(event) => updateFrequency(event.currentTarget.valueAsNumber)}
          />
          <input
            aria-label="巻き取り周波数の数値"
            className="number-field"
            type="number"
            min={spectrumRange.min}
            max={spectrumRange.max}
            step="0.01"
            value={formatNumber(windingFrequency)}
            onChange={(event) => updateFrequency(event.currentTarget.valueAsNumber)}
          />
          <div className="button-row">
            <button type="button" onClick={togglePlayback}>
              {isPlaying ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
              {isPlaying ? "停止" : "再生"}
            </button>
            <button type="button" onClick={() => applyPreset(presetId === "custom" ? resetPresetId : presetId)}>
              <RotateCcw aria-hidden="true" size={18} />
              リセット
            </button>
          </div>
        </div>

        <div className="control-block">
          <div className="label-row">
            <label htmlFor="sample-count">サンプル</label>
            <output>{sampleCount}</output>
          </div>
          <input
            id="sample-count"
            type="range"
            min="128"
            max="1024"
            step="128"
            value={sampleCount}
            onChange={(event) => setSampleCount(Math.round(clamp(event.currentTarget.valueAsNumber, 128, 1024)))}
          />
        </div>

        <section className="component-list" aria-label="成分リスト">
          <div className="component-title">
            <h2>成分</h2>
            <button type="button" onClick={addComponent}>
              <Plus aria-hidden="true" size={18} />
              追加
            </button>
          </div>

          {components.map((component, index) => (
            <article className="component-row" key={component.id}>
              <div className="component-row-header">
                <span className="swatch" style={{ backgroundColor: component.color }} aria-hidden="true" />
                <strong>Wave {index + 1}</strong>
                <button
                  className="icon-button"
                  type="button"
                  title="成分を削除"
                  aria-label={`Wave ${index + 1} を削除`}
                  onClick={() => removeComponent(component.id)}
                  disabled={components.length === 1}
                >
                  <Trash2 aria-hidden="true" size={17} />
                </button>
              </div>

              <label>
                周波数
                <input
                  aria-label={`Wave ${index + 1} 周波数`}
                  type="range"
                  min="0.05"
                  max="5"
                  step="0.01"
                  value={formatNumber(component.frequency)}
                  onChange={(event) => updateComponent(component.id, { frequency: event.currentTarget.valueAsNumber })}
                />
                <span>{component.frequency.toFixed(2)}Hz</span>
              </label>

              <label>
                振幅
                <input
                  aria-label={`Wave ${index + 1} 振幅`}
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={formatNumber(component.amplitude)}
                  onChange={(event) => updateComponent(component.id, { amplitude: event.currentTarget.valueAsNumber })}
                />
                <span>{component.amplitude.toFixed(2)}</span>
              </label>

              <label>
                位相
                <input
                  aria-label={`Wave ${index + 1} 位相`}
                  type="range"
                  min={-Math.PI}
                  max={Math.PI}
                  step="0.01"
                  value={formatNumber(component.phase)}
                  onChange={(event) => updateComponent(component.id, { phase: event.currentTarget.valueAsNumber })}
                />
                <span>{component.phase.toFixed(2)}</span>
              </label>
            </article>
          ))}
        </section>
      </aside>
    </main>
  );
}

export default App;
