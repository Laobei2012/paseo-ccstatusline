// Named colors use ccstatusline 2.2.33's truecolor palette. Terminal ANSI16
// colors are configurable; a fixed palette makes the app rendering deterministic.
const namedColors: Record<string, string> = {
  black: "#000000", red: "#cc0000", green: "#4e9a06", yellow: "#c4a000",
  blue: "#3465a4", magenta: "#75507b", cyan: "#06989a", white: "#d3d7cf",
  brightBlack: "#555753", brightRed: "#ef2929", brightGreen: "#8ae234", brightYellow: "#fce94f",
  brightBlue: "#729fcf", brightMagenta: "#ad7fa8", brightCyan: "#34e2e2", brightWhite: "#eeeeec",
};

// ccstatusline's fixed mappings for its ANSI256 color mode.
const namedAnsi256: Record<string, number> = {
  black: 16, red: 160, green: 70, yellow: 178, blue: 26, magenta: 96, cyan: 30, white: 188,
  brightBlack: 59, brightRed: 203, brightGreen: 155, brightYellow: 227,
  brightBlue: 111, brightMagenta: 140, brightCyan: 80, brightWhite: 231,
};

const ansi16 = [
  "#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080", "#c0c0c0",
  "#808080", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
];

function rgb(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function toHex(color: string, colorLevel = 3): string | null {
  if (/^hex:[\da-f]{6}$/i.test(color)) return `#${color.slice(4).toLowerCase()}`;
  if (/^ansi256:\d{1,3}$/.test(color)) {
    const index = Number(color.slice(8));
    if (index > 255) return null;
    if (index < 16) return ansi16[index];
    if (index >= 232) {
      const value = 8 + (index - 232) * 10;
      return rgb(value, value, value);
    }
    const value = index - 16;
    const levels = [0, 95, 135, 175, 215, 255];
    return rgb(levels[Math.floor(value / 36)], levels[Math.floor(value / 6) % 6], levels[value % 6]);
  }
  const name = color.startsWith("bg") ? color.charAt(2).toLowerCase() + color.slice(3) : color;
  if (colorLevel === 2 && Object.hasOwn(namedAnsi256, name)) return toHex(`ansi256:${namedAnsi256[name]}`);
  return Object.hasOwn(namedColors, name) ? namedColors[name] : null;
}
