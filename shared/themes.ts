// Copied from ccstatusline 2.2.33. See THIRD_PARTY_NOTICES.md for its MIT license.
import { toHex } from "./colors";
import type { StatusSettings } from "./settings";

type Palette = { fg: string[]; bg: string[] };
type Theme = { name: string; description: string; 1?: Palette; 2?: Palette; 3?: Palette };

export const builtInThemes: Readonly<Record<string, Theme>> = {
  custom: {
    name: "Custom",
    description: "Uses individual widget background colors"
  },
  nord: {
    name: "Nord",
    description: "Arctic, north-bluish color palette",
    1: {
      fg: ["black", "brightWhite", "brightWhite", "black", "black"],
      bg: ["bgBrightCyan", "bgBrightBlack", "bgBlue", "bgBrightYellow", "bgBrightGreen"]
    },
    2: {
      fg: ["ansi256:16", "ansi256:254", "ansi256:231", "ansi256:231", "ansi256:16"],
      bg: ["ansi256:73", "ansi256:239", "ansi256:25", "ansi256:96", "ansi256:152"]
    },
    3: {
      fg: ["hex:2E3440", "hex:D8DEE9", "hex:FDF6E3", "hex:2E3440", "hex:2E3440"],
      bg: ["hex:88C0D0", "hex:4C566A", "hex:5E81AC", "hex:B48EAD", "hex:A3BE8C"]
    }
  },
  "nord-aurora": {
    name: "Nord Aurora",
    description: "Nord theme with aurora colors",
    1: {
      fg: ["brightWhite", "black", "black", "black", "black"],
      bg: ["bgRed", "bgBrightYellow", "bgBrightBlue", "bgGreen", "bgBrightMagenta"]
    },
    2: {
      fg: ["ansi256:231", "ansi256:16", "ansi256:231", "ansi256:16", "ansi256:16"],
      bg: ["ansi256:131", "ansi256:220", "ansi256:68", "ansi256:108", "ansi256:176"]
    },
    3: {
      fg: ["hex:ECEFF4", "hex:2E3440", "hex:FDF6E3", "hex:2E3440", "hex:2E3440"],
      bg: ["hex:BF616A", "hex:EBCB8B", "hex:5E81AC", "hex:A3BE8C", "hex:B48EAD"]
    }
  },
  monokai: {
    name: "Monokai",
    description: "Dark background with vibrant colors",
    1: {
      fg: ["black", "brightWhite", "black", "white", "black"],
      bg: ["bgBrightGreen", "bgBrightBlack", "bgBrightYellow", "bgMagenta", "bgBrightCyan"]
    },
    2: {
      fg: ["ansi256:235", "ansi256:255", "ansi256:235", "ansi256:16", "ansi256:235"],
      bg: ["ansi256:148", "ansi256:238", "ansi256:186", "ansi256:141", "ansi256:81"]
    },
    3: {
      fg: ["hex:272822", "hex:F8F8F2", "hex:272822", "hex:272822", "hex:272822"],
      bg: ["hex:A6E22E", "hex:49483E", "hex:E6DB74", "hex:AE81FF", "hex:66D9EF"]
    }
  },
  solarized: {
    name: "Solarized",
    description: "Precision colors for readability",
    1: {
      fg: ["brightWhite", "black", "brightWhite", "black", "black"],
      bg: ["bgBlue", "bgBrightYellow", "bgBrightBlack", "bgCyan", "bgBrightWhite"]
    },
    2: {
      fg: ["ansi256:231", "ansi256:234", "ansi256:254", "ansi256:16", "ansi256:234"],
      bg: ["ansi256:33", "ansi256:136", "ansi256:240", "ansi256:37", "ansi256:254"]
    },
    3: {
      fg: ["hex:073642", "hex:073642", "hex:FDF6E3", "hex:073642", "hex:073642"],
      bg: ["hex:268BD2", "hex:B58900", "hex:586E75", "hex:2AA198", "hex:EEE8D5"]
    }
  },
  minimal: {
    name: "Minimal",
    description: "Clean monochrome theme",
    1: {
      fg: ["brightWhite", "black", "white", "black", "black"],
      bg: ["bgBrightBlack", "bgBrightWhite", "bgBlack", "bgWhite", "bgBrightWhite"]
    },
    2: {
      fg: ["ansi256:255", "ansi256:232", "ansi256:255", "ansi256:232", "ansi256:252"],
      bg: ["ansi256:240", "ansi256:251", "ansi256:233", "ansi256:248", "ansi256:236"]
    },
    3: {
      fg: ["hex:FFFFFF", "hex:1C1C1C", "hex:FFFFFF", "hex:1C1C1C", "hex:E4E4E4"],
      bg: ["hex:585858", "hex:D0D0D0", "hex:1A1A1A", "hex:A8A8A8", "hex:303030"]
    }
  },
  dracula: {
    name: "Dracula",
    description: "Dark theme with purple accents",
    1: {
      fg: ["brightWhite", "black", "brightWhite", "black", "white"],
      bg: ["bgMagenta", "bgBrightWhite", "bgRed", "bgBrightCyan", "bgBrightBlack"]
    },
    2: {
      fg: ["ansi256:235", "ansi256:235", "ansi256:235", "ansi256:235", "ansi256:231"],
      bg: ["ansi256:141", "ansi256:253", "ansi256:204", "ansi256:117", "ansi256:236"]
    },
    3: {
      fg: ["hex:282A36", "hex:282A36", "hex:282A36", "hex:282A36", "hex:F8F8F2"],
      bg: ["hex:BD93F9", "hex:F8F8F2", "hex:FF5555", "hex:8BE9FD", "hex:44475A"]
    }
  },
  catppuccin: {
    name: "Catppuccin",
    description: "Soothing pastel theme",
    1: {
      fg: ["black", "brightWhite", "black", "brightWhite", "black"],
      bg: ["bgBrightMagenta", "bgBrightBlack", "bgBrightGreen", "bgBlue", "bgBrightYellow"]
    },
    2: {
      fg: ["ansi256:235", "ansi256:255", "ansi256:235", "ansi256:235", "ansi256:235"],
      bg: ["ansi256:176", "ansi256:238", "ansi256:150", "ansi256:210", "ansi256:111"]
    },
    3: {
      fg: ["hex:1E1E2E", "hex:CDD6F4", "hex:1E1E2E", "hex:1E1E2E", "hex:CDD6F4"],
      bg: ["hex:CBA6F7", "hex:45475A", "hex:A6E3A1", "hex:F38BA8", "hex:585B70"]
    }
  },
  gruvbox: {
    name: "Gruvbox",
    description: "Retro groove color scheme",
    1: {
      fg: ["brightWhite", "black", "black", "brightWhite", "black"],
      bg: ["bgRed", "bgBrightYellow", "bgBrightWhite", "bgBlue", "bgBrightGreen"]
    },
    2: {
      fg: ["ansi256:16", "ansi256:235", "ansi256:235", "ansi256:16", "ansi256:235"],
      bg: ["ansi256:167", "ansi256:214", "ansi256:246", "ansi256:109", "ansi256:142"]
    },
    3: {
      fg: ["hex:EBDBB2", "hex:282828", "hex:282828", "hex:FDF6E3", "hex:282828"],
      bg: ["hex:CC241D", "hex:FABD2F", "hex:A89984", "hex:458588", "hex:98971A"]
    }
  },
  onedark: {
    name: "One Dark",
    description: "Atom-inspired dark theme",
    1: {
      fg: ["black", "brightWhite", "black", "brightWhite", "black"],
      bg: ["bgBrightBlue", "bgBrightBlack", "bgBrightGreen", "bgRed", "bgBrightYellow"]
    },
    2: {
      fg: ["ansi256:235", "ansi256:251", "ansi256:235", "ansi256:16", "ansi256:235"],
      bg: ["ansi256:75", "ansi256:237", "ansi256:114", "ansi256:204", "ansi256:180"]
    },
    3: {
      fg: ["hex:282C34", "hex:ABB2BF", "hex:282C34", "hex:282C34", "hex:282C34"],
      bg: ["hex:61AFEF", "hex:3E4452", "hex:98C379", "hex:E06C75", "hex:E5C07B"]
    }
  },
  tokyonight: {
    name: "Tokyo Night",
    description: "Clean, dark theme inspired by Tokyo nightlife",
    1: {
      fg: ["brightWhite", "black", "brightWhite", "black", "black"],
      bg: ["bgBlue", "bgBrightWhite", "bgMagenta", "bgBrightYellow", "bgBrightCyan"]
    },
    2: {
      fg: ["ansi256:16", "ansi256:234", "ansi256:16", "ansi256:234", "ansi256:234"],
      bg: ["ansi256:111", "ansi256:248", "ansi256:176", "ansi256:221", "ansi256:80"]
    },
    3: {
      fg: ["hex:1A1B26", "hex:1A1B26", "hex:1A1B26", "hex:1A1B26", "hex:1A1B26"],
      bg: ["hex:7AA2F7", "hex:D5D6DB", "hex:BB9AF7", "hex:E0AF68", "hex:7DCFFF"]
    }
  }
};

// The caller supplies a visible segment slot. It resets the slot at each line
// unless continueThemeAcrossLines is enabled; hidden widgets consume no slots.
export function themeColors(settings: StatusSettings, slot: number): { fg: string; bg: string } {
  const themeName = settings.powerline.theme;
  const theme = themeName && Object.hasOwn(builtInThemes, themeName) ? builtInThemes[themeName] : undefined;
  const level = Math.max(1, settings.colorLevel) as 1 | 2 | 3;
  const palette = settings.powerline.enabled ? theme?.[level] : undefined;
  // Custom/unknown themes and Powerline-off use widget colors in the formatter.
  // Neutral colors keep this total if it is called without a built-in palette.
  if (!palette) return { fg: "#d3d7cf", bg: "#000000" };
  const index = ((Math.trunc(slot) % palette.bg.length) + palette.bg.length) % palette.bg.length;
  return { fg: toHex(palette.fg[index], settings.colorLevel)!, bg: toHex(palette.bg[index], settings.colorLevel)! };
}
