## pearOS KDE Theme Switcher

`kde-theme-switch.sh` is a CLI “theme API” for pearOS on KDE Plasma.  
It switches between light/dark, applies component themes, accent colors, GTK/Kvantum/libadwaita, and keeps a simple state file so other tools (like a Settings app) can integrate with it.

### Features

- Light / Dark switching for:
  - KDE color scheme (`plasma-apply-colorscheme`)
  - Plasma desktop theme
  - Icon & cursor theme
  - Window decorations (Aurorae, pearOS/pearOS-dark)
  - Kvantum theme
  - GTK 2/3/4 theme + assets
  - libadwaita preference (via `./libadwaita`)
  - SDDM theme (if privileges available)
- Accent color presets from `colors/*.ini` (pearOS variants).
- Wallpaper sync:
  - If current wallpaper is one of:
    - `/usr/share/wallpapers/pearOS/default.jpg`
    - `/usr/share/wallpapers/pearOS-dark/default.jpg`
  - then switching light/dark also toggles the wallpaper using `plasma-apply-wallpaperimage`.
- Simple state tracking:
  - `./state` contains `light` or `dark`, used for toggling and accent re‑apply.
- External config:
  - Local: `./config.json`
  - System: `/usr/share/extras/pearos-themesw/config.json` (used if local missing)
  - Colors (accent presets) from `./colors/*.ini` or `/usr/share/extras/pearos-themesw/colors/*.ini`.

### Requirements

- KDE Plasma 5/6 with:
  - `plasma-apply-colorscheme`
  - `plasma-apply-desktoptheme`
  - `plasma-apply-cursortheme`
  - `plasma-apply-wallpaperimage`
  - `kwriteconfig6`, `kreadconfig6`, `qdbus6` (or `qdbus`)
  - `plasmashell`, `kquitapp6` (or `kquitapp5`)
- For JSON/config handling (any of):
  - `jq`, **or**
  - `python3`, **or**
  - `node`
- For the GUI config editor: Python 3 with Tkinter (`python3-tk` / `tk` package).

### Directory Layout

- `kde-theme-switch.sh` – main CLI script.
- `config.json` – theme mapping for `light` / `dark` (per component).
- `colors/` – color presets as `.ini` diffs (pearOS accent variants).
- `libadwaita` – helper script to set libadwaita dark/light.
- `config.py` – Tkinter GUI to view/edit `config.json`.
- `state` – current mode (`light` or `dark`) written by the script.

### Usage (CLI)

From the `themesw` directory:

```bash
./kde-theme-switch.sh                 # toggle based on ./state (light <-> dark)
./kde-theme-switch.sh --dark          # apply dark settings (all components)
./kde-theme-switch.sh --light         # apply light settings (all components)
./kde-theme-switch.sh --toggle        # toggle based on current ColorScheme (Dark<->Light)
./kde-theme-switch.sh --list          # list installed themes and current configuration
./kde-theme-switch.sh --color-list    # list available accent presets from colors/*.ini
./kde-theme-switch.sh --accent green  # apply accent preset 'green'
```

Notes:
- After `--accent` the script:
  - writes color values from `colors/<preset>.ini` into `kdeglobals`,
  - re-applies the color scheme for the current mode (from `state` + `config.json`),
  - reconfigures KWin and restarts `plasmashell`.
- If current wallpaper is a pearOS default, `--dark` / `--light` also toggles wallpaper dark/light.

### Config Schema (`config.json`)

Minimal shape:

```json
{
  "light": {
    "colorScheme": "pearOS",
    "plasmaTheme": "pearOS",
    "iconTheme": "pearOS",
    "cursorTheme": "pearOS-light",
    "auroraeTheme": "__aurorae__svg__pearOS",
    "kvantumTheme": "pearOS",
    "gtkTheme": "pearOS-Light",
    "sddmTheme": "pearOS",
    "appStyle": "kvantum"
  },
  "dark": {
    "colorScheme": "pearOS-dark",
    "plasmaTheme": "pearOS-dark",
    "iconTheme": "pearOS",
    "cursorTheme": "pearOS-dark",
    "auroraeTheme": "__aurorae__svg__pearOS-dark",
    "kvantumTheme": "pearOS-dark",
    "gtkTheme": "pearOS-Dark",
    "sddmTheme": "pearOS-dark",
    "appStyle": "kvantum-dark"
  }
}
```

The script **requires** all keys for both `light` and `dark`. Missing keys cause exit code `99` with a clear error.

### Accent Presets (`colors/*.ini`)

Each `.ini` in `colors/` is a full `kdeglobals`-style file.  
`--accent preset` will:

1. Read `colors/<preset>.ini`.
2. For sections `Colors:*` and `General`, write each key/value into `~/.config/kdeglobals` via `kwriteconfig6`.
3. Re-apply the global ColorScheme for the current mode (from `config.json` + `state`).
4. Reconfigure KWin and restart `plasmashell`.

### GUI Config Editor (`config.py`)

Run:

```bash
python3 config.py
```

Features:
- Loads config from `./config.json` or `/usr/share/extras/pearos-themesw/config.json` (or creates local from template).
- Lists available themes for each component (Color Scheme, Plasma Theme, Icons, Cursor, Aurorae, Kvantum, GTK, SDDM, appStyle).
- Buttons:
  - **Set as Light** / **Set as Dark**: assign the selected value to light/dark in `config.json`.
  - **Load**: refresh JSON in the embedded editor.
  - **Apply From Editor**: parse JSON from the editor back into the internal model.
  - **Save (local)**: write `./config.json`.
  - **Discard**: revert to last saved/loaded config.
  - **Set as default (system)**: save to `/usr/share/extras/pearos-themesw/config.json` (pkexec/sudo).

### Integration as “Theme API”

Your own settings application can treat `kde-theme-switch.sh` as a backend:

- Read current mode from `./state`.
- Inspect current configuration via `--list`.
- Switch modes via `--dark` / `--light` / no-arg toggle.
- Apply accent presets via `--accent <preset>`.
- Manage configuration by editing `config.json` (manually or via `config.py`).

Exit codes:
- `0`: success
- `1`: usage error (wrong arguments)
- `99`: configuration or environment error (missing config, missing JSON tool, missing colors directory, etc.)


