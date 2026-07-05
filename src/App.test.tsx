import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the three visualization regions and controls", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Fourier Visualoze" })).toBeInTheDocument();
    expect(screen.getByLabelText("時間波形")).toBeInTheDocument();
    expect(screen.getByLabelText("巻き取り平面")).toBeInTheDocument();
    expect(screen.getByLabelText("周波数スペクトル")).toBeInTheDocument();
    expect(screen.getByLabelText("巻き取り周波数")).toHaveValue("2");
  });

  it("updates the selected winding frequency from the slider", async () => {
    const user = userEvent.setup();
    render(<App />);

    const slider = screen.getByLabelText("巻き取り周波数");
    await user.clear(screen.getByLabelText("巻き取り周波数の数値"));
    await user.type(screen.getByLabelText("巻き取り周波数の数値"), "3");

    expect(slider).toHaveValue("3");

    fireEvent.change(slider, { target: { value: "4.5" } });
    expect(screen.getByLabelText("巻き取り周波数の数値")).toHaveValue(4.5);
  });

  it("switches presets and keeps the canvases synchronized with the selected frequency", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("プリセット"), "square");

    expect(screen.getByText("3 components")).toBeInTheDocument();
    expect(screen.getByLabelText("巻き取り周波数")).toHaveValue("1");
    expect(screen.getAllByText("1.00 Hz").length).toBeGreaterThan(0);
  });

  it("adds, edits, removes, and resets custom components without mutating the preset list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "追加" }));
    expect(screen.getByText("Wave 3")).toBeInTheDocument();
    expect(screen.getByLabelText("プリセット")).toHaveValue("custom");

    fireEvent.change(screen.getByLabelText("Wave 3 周波数"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Wave 3 振幅"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Wave 3 位相"), { target: { value: "0" } });

    const wave3 = screen.getByText("Wave 3").closest("article");
    expect(wave3).not.toBeNull();
    expect(within(wave3 as HTMLElement).getByText("4.00Hz")).toBeInTheDocument();
    expect(within(wave3 as HTMLElement).getByText("1.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Wave 3 を削除" }));
    expect(screen.queryByText("Wave 3")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "リセット" }));
    expect(screen.getByLabelText("プリセット")).toHaveValue("two-three");
    expect(screen.getByText("2 components")).toBeInTheDocument();
  });

  it("resets edited custom controls back to the preset they came from", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("プリセット"), "square");
    fireEvent.change(screen.getByLabelText("Wave 1 周波数"), { target: { value: "1.5" } });
    expect(screen.getByLabelText("プリセット")).toHaveValue("custom");

    await user.click(screen.getByRole("button", { name: "リセット" }));
    expect(screen.getByLabelText("プリセット")).toHaveValue("square");
    expect(screen.getByText("3 components")).toBeInTheDocument();
    expect(screen.getByLabelText("巻き取り周波数")).toHaveValue("1");
  });

  it("updates sample count and toggles playback controls", async () => {
    const user = userEvent.setup();
    render(<App />);

    fireEvent.change(screen.getByLabelText("サンプル"), { target: { value: "1024" } });
    expect(screen.getByText("1024")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "再生" }));
    expect(screen.getByRole("button", { name: "停止" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "停止" }));
    expect(screen.getByRole("button", { name: "再生" })).toBeInTheDocument();
  });

  it("advances and wraps playback sweep at the upper frequency bound", async () => {
    const callbacks: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(performance, "now").mockReturnValue(1000);

    const user = userEvent.setup();
    render(<App />);

    const slider = screen.getByLabelText("巻き取り周波数");
    fireEvent.change(slider, { target: { value: "5" } });
    await user.click(screen.getByRole("button", { name: "再生" }));

    await act(async () => {
      callbacks[0](1200);
    });
    expect(slider).toHaveValue("0");

    await act(async () => {
      callbacks[1](1216);
    });
    expect(Number((slider as HTMLInputElement).value)).toBeGreaterThan(0);
  });
});
