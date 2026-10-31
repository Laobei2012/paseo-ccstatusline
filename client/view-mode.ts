export type ViewMode = "text" | "colored";

export function createViewModeStore() {
  let mode: ViewMode = "text";
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => mode,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    setMode(next: ViewMode) {
      if (mode === next) return;
      mode = next;
      for (const listener of listeners) listener();
    },
  };
}
