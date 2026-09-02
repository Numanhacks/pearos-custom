# pear-bootloader (Ploader)

pearOS's boot manager, based on [rEFInd](https://www.rodsbooks.com/refind/) (upstream install/usage docs are in `README.txt`). This fork hardcodes pearOS-specific branding and behavior; end-user theme configuration via `ploader.conf` is intentionally disabled. The compiled binary is `ploader_x64.efi`; on-screen it identifies itself as "Ploader".

## Boot behavior

By default, the boot picker is never shown. On every boot, pearOS boots straight into the first detected OS with no screen shown at all. To reach the picker or a special boot mode, hold the corresponding key combination while the machine powers on.

| Combo | Boots into |
|---|---|
| *(nothing held)* | First detected OS, silently, no boot screen shown |
| `Alt` + `M` | The pearOS boot picker (menu) |
| `Alt` + `Meta` (Cmd/Win) + `R` | Partition labeled `PEAROS_IREC` |
| `Shift` + `Alt` + `Meta` + `R` | Partition labeled `PEAROS_FREC` |
| `Meta` + `R` | Partition labeled `PEAROS_LREC` |
| `Alt` + `D` | Partition labeled `PEAROS_HWT` |

This mirrors macOS's Option-key / Recovery-key boot conventions. Key state is read via `EFI_SIMPLE_TEXT_INPUT_EX_PROTOCOL`; on firmware that doesn't expose it, boot always proceeds silently into the first detected OS.

Every combo is anchored on a real character key (`M`/`D`/`R`) rather than a bare modifier: `ReadKeyStrokeEx` is event-driven, and on real firmware a modifier held with no other key often never produces a keystroke event at all (confirmed in practice: `Alt`+`D` was reliably detected, `Alt` held alone was not).

Partition labels are capped at 11 characters (FAT volume label limit), hence the abbreviated `IREC`/`FREC`/`LREC`/`HWT` suffixes rather than the full words.

If a key combo is held but no partition with the matching label is found, boot falls through to the normal interactive picker instead of failing silently.

Set `silent_menu false` in `ploader.conf` to disable all of the above and always show the interactive menu (stock rEFInd behavior); boot-mode key combos aren't checked in that mode. Defaults to `true`.

## Other pearOS customizations

- **Hardcoded theme** — icons, background, selection art, and font are baked into the `theme/` directory and loaded unconditionally; `ploader.conf` directives that would normally control these (`icons_dir`, `banner`, `selection_big`/`selection_small`, `hideui`, `showtools`, `font`) are ignored.
- **Proportional bitmap font** — `libeg/text.c` auto-detects each glyph's ink width from the font atlas's alpha channel, so a proportional display font baked into the fixed-width atlas grid doesn't render with monospace-style gaps.
- **Boot chime** — `PlayBootSound()` in `ploader/main.c` plays `bootsound.wav` via `EFI_AUDIO_IO_PROTOCOL`, provided by the bundled `ploader/drivers_x64/AudioDxe.efi` driver (from OpenCorePkg, BSD-3-Clause). AudioDxe only drives classic Intel HDA codecs; on boards without one (many modern laptops use Intel SST/DSP audio instead, which it can't drive) it falls back to a short two-note chime through the legacy PC speaker (direct port 0x61/PIT I/O, no driver or codec needed) — silent only if the board has no physical speaker wired to that port at all.
- **Short on-screen labels** — the selected entry's label under the icon row shows a short name (e.g. "Microsoft EFI boot") instead of rEFInd's verbose default title.
- **Renamed from stock rEFInd** — repo/source dir is `ploader/` (was `refind/`), binary is `ploader_x64.efi` (was `refind_x64.efi`), config is `ploader.conf` (was `refind.conf`), log is `ploader.log` (was `refind.log`), and on-screen/log text says "Ploader" instead of "rEFInd" (main menu header, About screen, `AboutPloader()`, `PloaderGuid`, `PLOADER_VERSION`). Generic function/variable names inherited from upstream rEFInd that aren't part of the product's identity (e.g. `StartLoader`, `REFIT_MENU_ENTRY`) were left as-is, as were the original copyright notices in file headers (required by rEFInd's license).
