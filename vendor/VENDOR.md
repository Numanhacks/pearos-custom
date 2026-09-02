# Vendored upstream sources (`vendor/`)

These are shallow snapshots of the pearOS-related upstream repositories,
brought in-repo so the code can be fixed locally instead of depending on
upstream. `.git` metadata was stripped; upstream URL is the folder name.

| Folder | Upstream | Notes |
|---|---|---|
| pear-calamares-config | pearOS-archlinux | installer config |
| pearos-icons | pearOS-archlinux | 1.1GB, 386k files — full multi-color icon theme set |
| pearos-livecd-desktop | pearOS-archlinux | live installer desktop |
| pearos-settings | pearOS-archlinux | system settings |
| slimc0re-settings | pearOS-archlinux | settings app (older) |
| calamares | pearOS-archlinux fork | installer framework fork |
| pearOS-Default-GRUB | pearOS-archlinux | GRUB theme |
| liquid-gel | pearOS-archlinux | KWin glassmorphism effect (source of the build-time compile) |
| iso | pearOS-archlinux | pear-temp-fix + pearos-builder sources |
| pkgbuilds | pearOS-archlinux | kscreenlocker etc. |
| neofetch | pearOS-archlinux fork | fetch tool config |
| pearos-boot-sound | Pear-Project | boot sound |
| pearos-apps-bundle | pearOS-archlinux | pearos-desktop + pearos-settings-app |
| pearos-muternvf | pearOS-archlinux | mute/night-vision effect |
| pearos-bootloader | pearOS-archlinux | bootloader bits |
| pearos-sounds | pearOS-archlinux | sound theme |
| macos-keyboard-shortcuts-kde | pearOS-archlinux | macOS keybindings |
| pearos-font | pearOS-archlinux | pearOS font |
| theme-switcher / pearos-themesw | pearOS-archlinux | theme switching |
| pafari | pearOS-archlinux | Safari-like browser |
| pearOS-installer | pearOS-archlinux | installer UI |
| pext-installer | pearOS-archlinux | pext |
| plymouth | pearOS-archlinux | boot splash fork |
| artwork | pearOS-archlinux | branding assets |
| fastfetch | pearOS-archlinux | fetch config |
| filesystem | pearOS-archlinux | os-release etc. |
| package-repository | pearOS-archlinux | repo tooling (no sources) |

## NOT vendored (upstream-deleted, recover from mirror binaries)

The Notes / Calendar / Contacts / Todo / Mail apps came from the
`arch-linux-gui` org, which **deleted the repos**. The installed packages
ship as binaries from `mirror.pearos.xyz` (they are Electron apps, so the
JS/QML sources are recoverable by unpacking the package's asar archives).
Do that recovery here before attempting to restyle those apps.

## Also intentionally not vendored

Stock third-party code pulled by PKGBUILDs: GNU grub, KDE
plasma-workspace, CachyOS chwd/keyring, xyne reflector — those are
upstream projects, not pearOS code to fix.
