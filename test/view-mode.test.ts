import { expect, it, vi } from "vitest";
import { createViewModeStore } from "../client/view-mode";

it("remembers the selected mode across subscribers for one plugin lifetime", () => {
  const mode = createViewModeStore();
  const listener = vi.fn();
  const stop = mode.subscribe(listener);
  expect(mode.getSnapshot()).toBe("text");
  mode.setMode("colored");
  expect(listener).toHaveBeenCalledTimes(1);
  stop();
  mode.setMode("text");
  expect(listener).toHaveBeenCalledTimes(1);
  const next = vi.fn();
  const stopNext = mode.subscribe(next);
  expect(mode.getSnapshot()).toBe("text");
  mode.setMode("text");
  expect(next).not.toHaveBeenCalled();
  mode.setMode("colored");
  expect(next).toHaveBeenCalledTimes(1);
  expect(mode.getSnapshot()).toBe("colored");
  expect(createViewModeStore().getSnapshot()).toBe("text");
  stopNext();
});
