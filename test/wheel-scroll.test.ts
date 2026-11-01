import { expect, it, vi } from "vitest";
import { attachWheelScroll, type WheelPanel } from "../client/wheel-scroll";

function setup(width = 1200) {
  const panel = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  const viewport = { scrollLeft: 0, scrollWidth: width, clientWidth: 300 };
  const cleanup = attachWheelScroll(panel, viewport);
  const handler = panel.addEventListener.mock.calls[0][1] as Parameters<WheelPanel["addEventListener"]>[1];
  const wheel = (overrides = {}) => {
    const event = { deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false, defaultPrevented: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(), ...overrides };
    handler(event);
    return event;
  };
  return { panel, viewport, cleanup, handler, wheel };
}

it("moves all rows right/down and left/up and contains scrolling at both edges", () => {
  const { wheel, viewport } = setup();
  expect(wheel().preventDefault).toHaveBeenCalled();
  expect(viewport.scrollLeft).toBe(100);
  wheel({ deltaY: -40 });
  expect(viewport.scrollLeft).toBe(60);
  wheel({ deltaY: 2000 });
  expect(viewport.scrollLeft).toBe(900);
  expect(wheel().stopPropagation).toHaveBeenCalled();
  wheel({ deltaY: -2000 });
  expect(viewport.scrollLeft).toBe(0);
});

it("normalizes mouse wheels that report lines or pages", () => {
  const { wheel, viewport } = setup();
  wheel({ deltaY: 3, deltaMode: 1 });
  expect(viewport.scrollLeft).toBe(54);
  wheel({ deltaY: 1, deltaMode: 2 });
  expect(viewport.scrollLeft).toBe(354);
});

it("preserves horizontal gestures, zoom, handled events, and non-overflowing panels", () => {
  const { wheel, viewport } = setup();
  for (const overrides of [{ deltaX: 200 }, { ctrlKey: true }, { defaultPrevented: true }, { deltaY: 0 }]) {
    expect(wheel(overrides).preventDefault).not.toHaveBeenCalled();
  }
  expect(viewport.scrollLeft).toBe(0);
  expect(setup(200).wheel().preventDefault).not.toHaveBeenCalled();
});

it("uses a cancellable listener and removes it on close", () => {
  const { panel, handler, cleanup } = setup();
  expect(panel.addEventListener).toHaveBeenCalledWith("wheel", handler, { passive: false });
  cleanup();
  expect(panel.removeEventListener).toHaveBeenCalledWith("wheel", handler);
});
