// Structural types keep this web-only adapter independent of DOM globals.
interface WheelInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  defaultPrevented: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface WheelPanel {
  addEventListener(type: "wheel", handler: (event: WheelInput) => void, options: { passive: boolean }): void;
  removeEventListener(type: "wheel", handler: (event: WheelInput) => void): void;
}

export interface HorizontalViewport {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
}

export function attachWheelScroll(panel: WheelPanel, viewport: HorizontalViewport) {
  const onWheel = (event: WheelInput) => {
    if (event.defaultPrevented || event.ctrlKey || !event.deltaY ||
        Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const max = viewport.scrollWidth - viewport.clientWidth;
    if (max <= 0) return;
    const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? viewport.clientWidth : 1;
    viewport.scrollLeft = Math.max(0, Math.min(max, viewport.scrollLeft + event.deltaY * unit));
    // Contain the wheel at either edge so the conversation behind the panel stays put.
    event.preventDefault();
    event.stopPropagation();
  };
  panel.addEventListener("wheel", onWheel, { passive: false });
  return () => panel.removeEventListener("wheel", onWheel);
}
