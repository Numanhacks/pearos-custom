/*
 * refind/main.c
 * Main code for the boot menu
 *
 * Copyright (c) 2006-2010 Christoph Pfisterer
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 *  * Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the
 *    distribution.
 *
 *  * Neither the name of Christoph Pfisterer nor the names of the
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
/*
 * Modifications copyright (c) 2012-2024 Roderick W. Smith
 *
 * Modifications distributed under the terms of the GNU General Public
 * License (GPL) version 3 (GPLv3), or (at your option) any later version.
 *
 */
/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#include "global.h"
#include "config.h"
#include "../include/AudioIo.h"
#include "screen.h"
#include "launch_legacy.h"
#include "lib.h"
#include "icns.h"
#include "install.h"
#include "menu.h"
#include "mok.h"
#include "apple.h"
#include "mystrings.h"
#include "security_policy.h"
#include "driver_support.h"
#include "launch_efi.h"
#include "scan.h"
#include "log.h"
#include "../include/refit_call_wrapper.h"
#include "../include/version.h"
#include "../libeg/efiConsoleControl.h"
#include "../libeg/efiUgaDraw.h"

#ifndef __MAKEWITH_GNUEFI
#define LibLocateProtocol EfiLibLocateProtocol
#endif

//
// Some built-in menu definitions....

REFIT_MENU_ENTRY MenuEntryReturn   = { L"Return to Main Menu", TAG_RETURN, 1, 0, 0, NULL, NULL, NULL };

REFIT_MENU_SCREEN MainMenu       = { L"Main Menu", NULL, 0, NULL, 0, NULL, 0, L"Automatic boot",
                                     L"Use arrow keys to move cursor; Enter to boot;",
                                     L"Insert, Tab, or F2 for more options; Esc or Backspace to refresh" };
static REFIT_MENU_SCREEN AboutMenu      = { L"About", NULL, 0, NULL, 0, NULL, 0, NULL, L"Press Enter to return to main menu", L"" };

REFIT_CONFIG GlobalConfig = { /* TextOnly = */ FALSE,
                              /* ScanAllLinux = */ TRUE,
                              /* DeepLegacyScan = */ FALSE,
                              /* EnableAndLockVMX = */ FALSE,
                              /* FoldLinuxKernels = */ TRUE,
                              /* EnableMouse = */ FALSE,
                              /* EnableTouch = */ FALSE,
                              /* HiddenTags = */ TRUE,
                              /* UseNvram = */ TRUE,
                              /* ShutdownAfterTimeout = */ FALSE,
                              /* Install = */ FALSE,
                              /* WriteSystemdVars = */ FALSE,
                              /* FollowSymlinks = */ FALSE,
                              /* SilentMenu = */ TRUE,
#ifdef EFIAARCH64
                              /* GzippedLoaders = */ TRUE,
#else
                              /* GzippedLoaders = */ FALSE,
#endif
                              /* RequestedScreenWidth = */ 0,
                              /* RequestedScreenHeight = */ 0,
                              /* BannerBottomEdge = */ 0,
                              /* RequestedTextMode = */ DONT_CHANGE_TEXT_MODE,
                              /* Timeout = */ 20,
                              /* HideUIFlags = */ (HIDEUI_FLAG_HINTS | HIDEUI_FLAG_BADGES),
                              /* MaxTags = */ 0,
                              /* GraphicsFor = */ GRAPHICS_FOR_OSX,
                              /* LegacyType = */ LEGACY_TYPE_MAC,
                              /* ScanDelay = */ 0,
                              /* ScreensaverTime = */ 0,
                              /* MouseSpeed = */ 4,
                              /* IconSizes = */ { DEFAULT_BIG_ICON_SIZE / 4,
                                                  DEFAULT_SMALL_ICON_SIZE,
                                                  DEFAULT_BIG_ICON_SIZE,
                                                  DEFAULT_MOUSE_SIZE },
                              /* BannerScale = */ BANNER_NOSCALE,
                              /* LogLevel = */ 0,
                              /* *DiscoveredRoot = */ NULL,
                              /* *SelfDevicePath = */ NULL,
                              /* *BannerFileName = */ L"theme\\bg\\background.png",
                              /* *PearOSLabel = */ NULL,
                              /* *ScreenBackground = */ NULL,
                              /* *ConfigFilename = */ CONFIG_FILE_NAME,
                              /* *SelectionSmallFileName = */ L"theme\\icons\\selection_small.png",
                              /* *SelectionBigFileName = */ L"theme\\icons\\selection_big.png",
                              /* *DefaultSelection = */ NULL,
                              /* *AlsoScan = */ NULL,
                              /* ToolLocations = */ NULL,
                              /* *ExtraToolLocations = */ NULL,
                              /* *DontScanVolumes = */ NULL,
                              /* *DontScanDirs = */ NULL,
                              /* *DontScanFiles = */ NULL,
                              /* *DontScanTools = */ NULL,
                              /* *DontScanFirmware = */ NULL,
                              /* *WindowsRecoveryFiles = */ NULL,
                              /* *MacOSRecoveryFiles = */ NULL,
                              /* *DriverDirs = */ NULL,
                              /* *IconsDir = */ L"theme\\icons",
                              /* *LinuxPrefixes = */ NULL,
                              /* *LinuxMatchPatterns = */ NULL,
                              /* *ExtraKernelVersionStrings = */ NULL,
                              /* *SpoofOSXVersion = */ NULL,
                              /* CsrValues = */ NULL,
                              /* ShowTools = */ { TAG_REBOOT, TAG_SHUTDOWN, TAG_FIRMWARE,
                                                  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 }
                            };

CHAR16 *gHiddenTools = NULL;

EFI_GUID PloaderGuid = REFIND_GUID_VALUE;
static EFI_GUID AudioIoProtocolGuid = EFI_AUDIO_IO_PROTOCOL_GUID;

#define PEAROS_BOOT_SOUND_FILENAME L"bootsound.wav"

// Reads a little-endian UINT32 out of a byte buffer.
static UINT32 ReadLE32(UINT8 *Data) {
    return (UINT32)Data[0] | ((UINT32)Data[1] << 8) | ((UINT32)Data[2] << 16) | ((UINT32)Data[3] << 24);
}

static UINT16 ReadLE16(UINT8 *Data) {
    return (UINT16)Data[0] | ((UINT16)Data[1] << 8);
}

#ifdef EFIX64
// Direct x86 port I/O -- there is no UEFI-spec protocol for the legacy PC speaker,
// so this bypasses protocols entirely and drives it the same way real-mode/BIOS
// code always has. Universal fallback for boards with no HDA codec AudioDxe can
// drive (or no AudioDxe support at all): a single tone through the PC speaker,
// gated by the classic keyboard-controller port 0x61 "speaker enable" bits.
static VOID OutPort8(UINT16 Port, UINT8 Value) {
    __asm__ volatile ("outb %0, %1" : : "a" (Value), "Nd" (Port));
}

static UINT8 InPort8(UINT16 Port) {
    UINT8 Value;
    __asm__ volatile ("inb %1, %0" : "=a" (Value) : "Nd" (Port));
    return Value;
}

static VOID PcSpeakerBeep(UINTN FreqHz, UINTN DurationMs) {
    UINTN Divisor;
    UINT8 Control;

    if (FreqHz == 0)
        return;
    Divisor = 1193182 / FreqHz;

    OutPort8(0x43, 0xB6); // PIT channel 2, square wave
    OutPort8(0x42, (UINT8) (Divisor & 0xFF));
    OutPort8(0x42, (UINT8) ((Divisor >> 8) & 0xFF));

    Control = InPort8(0x61);
    OutPort8(0x61, Control | 0x03); // gate PIT channel 2 into the speaker, enable it

    refit_call1_wrapper(BS->Stall, DurationMs * 1000);

    OutPort8(0x61, Control); // restore original state (speaker off)
} // VOID PcSpeakerBeep()

// A short two-note chime, played through the legacy PC speaker. Used as a
// last-resort fallback when EFI_AUDIO_IO_PROTOCOL isn't available -- works on
// any x86 board with a speaker/beeper, no driver or codec support required,
// though many modern laptops have no physical speaker wired to it at all.
static VOID PlayPcSpeakerFallbackChime(VOID) {
    PcSpeakerBeep(880, 90);  // A5
    refit_call1_wrapper(BS->Stall, 20000);
    PcSpeakerBeep(1318, 140); // E6
} // VOID PlayPcSpeakerFallbackChime()
#endif

// Plays the pearOS boot sound (bootsound.wav, next to the refind binary) via
// EFI_AUDIO_IO_PROTOCOL (provided by the AudioDxe.efi driver in drivers_x64),
// if such a protocol is present on this firmware. Falls back to a simple PC
// speaker chime (no driver/codec required) if that protocol isn't found.
static VOID PlayBootSound(VOID) {
    EFI_STATUS                   Status;
    EFI_AUDIO_IO_PROTOCOL        *AudioIo;
    EFI_AUDIO_IO_PROTOCOL_PORT   *OutputPorts;
    UINTN                        OutputPortsCount;
    UINT8                        *FileData;
    UINTN                        FileDataLength;
    UINT8                        *Pos, *End;
    UINT32                       ChunkId, ChunkSize;
    UINT16                       NumChannels, BitsPerSample, AudioFormat;
    UINT32                       SampleRate;
    UINT8                        *AudioData;
    UINTN                        AudioDataLength;
    EFI_AUDIO_IO_PROTOCOL_FREQ   Freq;
    EFI_AUDIO_IO_PROTOCOL_BITS   Bits;

    Status = LibLocateProtocol(&AudioIoProtocolGuid, (VOID **) &AudioIo);
    if (EFI_ERROR(Status) || AudioIo == NULL) {
#ifdef EFIX64
        PlayPcSpeakerFallbackChime();
#endif
        return;
    }

    Status = egLoadFile(SelfDir, PEAROS_BOOT_SOUND_FILENAME, &FileData, &FileDataLength);
    if (EFI_ERROR(Status))
        return;

    if (FileDataLength < 44 || CompareMem(FileData, "RIFF", 4) != 0 || CompareMem(FileData + 8, "WAVE", 4) != 0) {
        MyFreePool(FileData);
        return;
    }

    NumChannels = 0;
    BitsPerSample = 0;
    AudioFormat = 0;
    SampleRate = 0;
    AudioData = NULL;
    AudioDataLength = 0;

    Pos = FileData + 12;
    End = FileData + FileDataLength;
    while (Pos + 8 <= End) {
        ChunkId = ReadLE32(Pos);
        ChunkSize = ReadLE32(Pos + 4);
        Pos += 8;
        if (Pos + ChunkSize > End)
            break;

        if (ChunkId == 0x20746d66) { // "fmt "
            if (ChunkSize >= 16) {
                AudioFormat = ReadLE16(Pos);
                NumChannels = ReadLE16(Pos + 2);
                SampleRate = ReadLE32(Pos + 4);
                BitsPerSample = ReadLE16(Pos + 14);
            }
        } else if (ChunkId == 0x61746164) { // "data"
            AudioData = Pos;
            AudioDataLength = ChunkSize;
        }

        Pos += ChunkSize;
        if (ChunkSize & 1) // chunks are word-aligned
            Pos += 1;
    }

    if (AudioFormat != 1 || NumChannels == 0 || AudioData == NULL || AudioDataLength == 0) {
        MyFreePool(FileData);
        return;
    }

    switch (BitsPerSample) {
        case 8:  Bits = EfiAudioIoBits8;  break;
        case 16: Bits = EfiAudioIoBits16; break;
        case 20: Bits = EfiAudioIoBits20; break;
        case 24: Bits = EfiAudioIoBits24; break;
        case 32: Bits = EfiAudioIoBits32; break;
        default:
            MyFreePool(FileData);
            return;
    }

    switch (SampleRate) {
        case 8000:   Freq = EfiAudioIoFreq8kHz;   break;
        case 11025:  Freq = EfiAudioIoFreq11kHz;  break;
        case 16000:  Freq = EfiAudioIoFreq16kHz;  break;
        case 22050:  Freq = EfiAudioIoFreq22kHz;  break;
        case 32000:  Freq = EfiAudioIoFreq32kHz;  break;
        case 44100:  Freq = EfiAudioIoFreq44kHz;  break;
        case 48000:  Freq = EfiAudioIoFreq48kHz;  break;
        case 88200:  Freq = EfiAudioIoFreq88kHz;  break;
        case 96000:  Freq = EfiAudioIoFreq96kHz;  break;
        case 192000: Freq = EfiAudioIoFreq192kHz; break;
        default:
            MyFreePool(FileData);
            return;
    }

    Status = AudioIo->GetOutputs(AudioIo, &OutputPorts, &OutputPortsCount);
    if (EFI_ERROR(Status) || OutputPortsCount == 0) {
        MyFreePool(FileData);
        return;
    }

    Status = AudioIo->SetupPlayback(AudioIo, 1, 0, Freq, Bits, (UINT8) NumChannels, 0);
    if (!EFI_ERROR(Status)) {
        AudioIo->StartPlaybackAsync(AudioIo, AudioData, AudioDataLength, 0, NULL, NULL);
    }

    // Note: intentionally not freeing FileData -- StartPlaybackAsync plays the
    // buffer asynchronously, so it must stay alive past this function's return.
} // VOID PlayBootSound()

#define ALT_KEY_POLL_MS 1500

typedef enum {
    PEAROS_BOOT_NORMAL,             // no key held: silent boot into the first detected OS
    PEAROS_BOOT_MENU,                // Alt+M: show the boot picker
    PEAROS_BOOT_INTERNET_RECOVERY,   // Alt+Meta+R: PEAROS_IREC
    PEAROS_BOOT_FACTORY_RECOVERY,    // Shift+Alt+Meta+R: PEAROS_FREC
    PEAROS_BOOT_LOCAL_RECOVERY,      // Meta+R: PEAROS_LREC
    PEAROS_BOOT_HARDWARE_TEST        // Alt+D: PEAROS_HWT
} PEAROS_BOOT_MODE;

// Polls the keyboard briefly (via EFI_SIMPLE_TEXT_INPUT_EX_PROTOCOL, which reports
// modifier-key state) to see which boot-mode key combo (if any) is being held, macOS
// Recovery-style. If the firmware has no extended text input protocol, always returns
// PEAROS_BOOT_NORMAL (silent boot), since modifier state can't be read.
//
// Every combo below is anchored on an actual character key (M/D/R), never a bare
// modifier: on real firmware, ReadKeyStrokeEx is event-driven, and a modifier held
// with no other key pressed frequently never generates a keystroke event at all --
// confirmed in practice (Alt+D reliably detected; Alt held alone was not).
static PEAROS_BOOT_MODE DetectBootMode(VOID) {
    EFI_STATUS Status;
    EFI_SIMPLE_TEXT_INPUT_EX_PROTOCOL *TextInEx;
    EFI_KEY_DATA KeyData;
    UINTN Elapsed = 0;
    UINT32 Shift;
    BOOLEAN Alt, Meta, Shft;
    CHAR16 Ch;

    Status = LibLocateProtocol(&SimpleTextInputExProtocol, (VOID **) &TextInEx);
    if (EFI_ERROR(Status) || TextInEx == NULL)
        return PEAROS_BOOT_NORMAL;

    while (Elapsed < ALT_KEY_POLL_MS) {
        Status = refit_call2_wrapper(TextInEx->ReadKeyStrokeEx, TextInEx, &KeyData);
        if (!EFI_ERROR(Status) && (KeyData.KeyState.KeyShiftState & EFI_SHIFT_STATE_VALID)) {
            Shift = KeyData.KeyState.KeyShiftState;
            Alt  = (Shift & (EFI_LEFT_ALT_PRESSED   | EFI_RIGHT_ALT_PRESSED))   != 0;
            Meta = (Shift & (EFI_LEFT_LOGO_PRESSED  | EFI_RIGHT_LOGO_PRESSED))  != 0;
            Shft = (Shift & (EFI_LEFT_SHIFT_PRESSED | EFI_RIGHT_SHIFT_PRESSED)) != 0;
            Ch = KeyData.Key.UnicodeChar;
            if (Ch >= L'a' && Ch <= L'z')
                Ch -= (L'a' - L'A');

            if (Shft && Alt && Meta && Ch == L'R')
                return PEAROS_BOOT_FACTORY_RECOVERY;
            if (Alt && Meta && Ch == L'R')
                return PEAROS_BOOT_INTERNET_RECOVERY;
            if (Meta && !Alt && Ch == L'R')
                return PEAROS_BOOT_LOCAL_RECOVERY;
            if (Alt && !Meta && Ch == L'D')
                return PEAROS_BOOT_HARDWARE_TEST;
            if (Alt && !Meta && Ch == L'M')
                return PEAROS_BOOT_MENU;
        }
        refit_call1_wrapper(BS->Stall, 20000); // 20ms
        Elapsed += 20;
    }
    return PEAROS_BOOT_NORMAL;
} // PEAROS_BOOT_MODE DetectBootMode()

// Returns the first TAG_LOADER entry in the main menu (i.e. the first bootable OS
// found), or NULL if none was found. Used for the silent/seamless default boot path.
static LOADER_ENTRY * FirstLoaderEntry(VOID) {
    UINTN i;

    for (i = 0; i < MainMenu.EntryCount; i++) {
        if (MainMenu.Entries[i]->Tag == TAG_LOADER)
            return (LOADER_ENTRY *) MainMenu.Entries[i];
    }
    return NULL;
} // LOADER_ENTRY *FirstLoaderEntry()

// Builds a LOADER_ENTRY that boots the default fallback loader (\EFI\BOOT\BOOTX64.EFI)
// on the given volume, or NULL if that volume has no such file (or it isn't a valid
// EFI loader). Built directly from the volume, independent of ScanForBootloaders()'s
// generic discovery heuristics (which, among other things, deliberately excludes
// \EFI\BOOT on whatever volume rEFInd itself is running from -- not what we want for
// a dedicated, label-addressed recovery/hardware-test partition).
static LOADER_ENTRY * BuildFallbackLoaderForVolume(IN REFIT_VOLUME *Volume) {
    LOADER_ENTRY *Entry;
    CHAR16 *LoaderPath = L"\\EFI\\BOOT\\BOOTX64.EFI";

    if (Volume == NULL || Volume->RootDir == NULL)
        return NULL;
    if (!FileExists(Volume->RootDir, LoaderPath) || !IsValidLoader(Volume->RootDir, LoaderPath))
        return NULL;

    Entry = InitializeLoaderEntry(NULL);
    if (Entry == NULL)
        return NULL;
    Entry->DiscoveryType = DISCOVERY_TYPE_AUTO;
    Entry->Title = StrDuplicate((Volume->VolName != NULL) ? Volume->VolName : LoaderPath);
    Entry->me.Title = StrDuplicate(Entry->Title);
    Entry->me.Row = 0;
    Entry->me.BadgeImage = Volume->VolBadgeImage;
    Entry->LoaderPath = StrDuplicate(LoaderPath);
    Entry->Volume = Volume;
    SetLoaderDefaults(Entry, LoaderPath, Volume);
    GenerateSubScreen(Entry, Volume, TRUE);
    return Entry;
} // LOADER_ENTRY *BuildFallbackLoaderForVolume()

// Finds the already-scanned volume with the given partition label (case-insensitive)
// and returns a loader entry for its default fallback loader, or NULL if no such
// volume was found (or it has no bootable \EFI\BOOT\BOOTX64.EFI). Used for the
// recovery/hardware-test boot-key combos.
static LOADER_ENTRY * FindLoaderByVolumeLabel(IN CHAR16 *Label) {
    UINTN i;

    for (i = 0; i < VolumesCount; i++) {
        if (Volumes[i]->VolName != NULL && MyStriCmp(Volumes[i]->VolName, Label))
            return BuildFallbackLoaderForVolume(Volumes[i]);
    }
    return NULL;
} // LOADER_ENTRY *FindLoaderByVolumeLabel()

//
// misc functions
//

VOID AboutPloader(VOID)
{
    CHAR16     *FirmwareVendor;
    CHAR16     *TempStr;
    UINT32     CsrStatus;

    LOG(1, LOG_LINE_SEPARATOR, L"Displaying About/Info screen");
    if (AboutMenu.EntryCount == 0) {
        AboutMenu.TitleImage = BuiltinIcon(BUILTIN_ICON_FUNC_ABOUT);
        AddMenuInfoLine(&AboutMenu, PoolPrint(L"Ploader Version %s", PLOADER_VERSION));
        AddMenuInfoLine(&AboutMenu, L"");
        AddMenuInfoLine(&AboutMenu, L"Copyright (c) 2006-2010 Christoph Pfisterer");
        AddMenuInfoLine(&AboutMenu, L"Copyright (c) 2012-2024 Roderick W. Smith");
        AddMenuInfoLine(&AboutMenu, L"Portions Copyright (c) Intel Corporation and others");
        AddMenuInfoLine(&AboutMenu, L"Distributed under the terms of the GNU GPLv3 license");
        AddMenuInfoLine(&AboutMenu, L"");
        AddMenuInfoLine(&AboutMenu, L"Running on:");
        FirmwareVendor = StrDuplicate(ST->FirmwareVendor);
        LimitStringLength(FirmwareVendor, MAX_LINE_LENGTH); // More than ~65 causes empty info page on 800x600 display
        AddMenuInfoLine(&AboutMenu, PoolPrint(L" Firmware: %s %d.%02d", FirmwareVendor,
                                              ST->FirmwareRevision >> 16,
                                              ST->FirmwareRevision & ((1 << 16) - 1)));
        AddMenuInfoLine(&AboutMenu, PoolPrint(L" EFI Revision %d.%02d", ST->Hdr.Revision >> 16, ST->Hdr.Revision & ((1 << 16) - 1)));
#if defined(EFI32)
        AddMenuInfoLine(&AboutMenu, PoolPrint(L" Platform: x86 (32 bit); Secure Boot %s %s",
                                              secure_mode() ? L"active" : L"inactive",
                                              ShimLoaded() ? L"(via Shim)" : L"(direct)"));
#elif defined(EFIX64)
        AddMenuInfoLine(&AboutMenu, PoolPrint(L" Platform: x86_64 (64 bit); Secure Boot %s %s",
                                              secure_mode() ? L"active" : L"inactive",
                                              ShimLoaded() ? L"(via Shim)" : L"(direct)"));
#elif defined(EFIAARCH64)
        AddMenuInfoLine(&AboutMenu, PoolPrint(L" Platform: ARM (64 bit); Secure Boot %s %s",
                                              secure_mode() ? L"active" : L"inactive",
                                              ShimLoaded() ? L"(via Shim)" : L"(direct)"));
#else
        AddMenuInfoLine(&AboutMenu, L" Platform: unknown");
#endif
        if (GetCsrStatus(&CsrStatus) == EFI_SUCCESS) {
            RecordgCsrStatus(CsrStatus, FALSE);
            AddMenuInfoLine(&AboutMenu, gCsrStatus);
        }
        TempStr = egScreenDescription();
        AddMenuInfoLine(&AboutMenu, PoolPrint(L" Screen Output: %s", TempStr));
        MyFreePool(TempStr);
        AddMenuInfoLine(&AboutMenu, L"");
#if defined(__MAKEWITH_GNUEFI)
        AddMenuInfoLine(&AboutMenu, L"Built with GNU-EFI");
#else
        AddMenuInfoLine(&AboutMenu, L"Built with TianoCore EDK2");
#endif
        AddMenuInfoLine(&AboutMenu, L"");
        AddMenuInfoLine(&AboutMenu, L"For more information, see the rEFInd Web site:");
        AddMenuInfoLine(&AboutMenu, L"http://www.rodsbooks.com/refind/");
        AddMenuEntry(&AboutMenu, &MenuEntryReturn);
        MyFreePool(FirmwareVendor);
    }

    RunMenu(&AboutMenu, NULL);
} /* VOID AboutPloader() */

// Record the value of the loader's name/description in rEFInd's "PreviousBoot" EFI variable,
// if it's different from what's already stored there.
VOID StoreLoaderName(IN CHAR16 *Name) {

    if (Name) {
        EfivarSetRaw(&PloaderGuid, L"PreviousBoot", (CHAR8*) Name, StrLen(Name) * 2 + 2, TRUE);
    } // if
} // VOID StoreLoaderName()

// Rescan for boot loaders
VOID RescanAll(BOOLEAN DisplayMessage, BOOLEAN Reconnect) {
    LOG(1, LOG_LINE_NORMAL, L"Re-scanning all boot loaders");
    FreeList((VOID ***) &(MainMenu.Entries), &MainMenu.EntryCount);
    MainMenu.Entries = NULL;
    MainMenu.EntryCount = 0;
    // ConnectAllDriversToAllControllers() can cause system hangs with some
    // buggy filesystem drivers, so do it only if necessary....
    if (Reconnect) {
        ConnectAllDriversToAllControllers();
        ScanVolumes();
    }
    ReadConfig(GlobalConfig.ConfigFilename);
    SetVolumeIcons();
    ScanForBootloaders(DisplayMessage);
    ScanForTools();
} // VOID RescanAll()

#ifdef __MAKEWITH_TIANO

// Minimal initialization function
static VOID InitializeLib(IN EFI_HANDLE ImageHandle, IN EFI_SYSTEM_TABLE *SystemTable) {
    EFI_STATUS Status;

    gST            = SystemTable;
    //    gImageHandle   = ImageHandle;
    gBS            = SystemTable->BootServices;
    //    gRS            = SystemTable->RuntimeServices;
    gRT = SystemTable->RuntimeServices; // Some BDS functions need gRT to be set
    Status = EfiGetSystemConfigurationTable (&gEfiDxeServicesTableGuid, (VOID **) &gDS);
    if (EFI_ERROR(Status)) {
        // Be sure that gDS isn't pointing to some random place; check it
        // before each use....
        gDS = 0;
    }
}

#endif

// Set up our own Secure Boot extensions....
// Returns TRUE on success, FALSE otherwise
static BOOLEAN SecureBootSetup(VOID) {
    EFI_STATUS Status;
    BOOLEAN    Success = FALSE;

    LOG(1, LOG_LINE_NORMAL, L"Setting up Secure Boot (if applicable)");
    if (secure_mode() && ShimLoaded()) {
        LOG(2, LOG_LINE_NORMAL, L"Secure boot mode detected with loaded Shim; adding MOK extensions");
        Status = security_policy_install();
        if (Status == EFI_SUCCESS) {
            Success = TRUE;
        } else {
            Print(L"Failed to install MOK Secure Boot extensions");
            PauseForKey();
        }
    } else {
        LOG(2, LOG_LINE_NORMAL, L"Secure boot disabled; doing nothing");
    }
    return Success;
} // VOID SecureBootSetup()

// Remove our own Secure Boot extensions....
// Returns TRUE on success, FALSE otherwise
static BOOLEAN SecureBootUninstall(VOID) {
    EFI_STATUS Status;
    BOOLEAN    Success = TRUE;

    if (secure_mode()) {
        Status = security_policy_uninstall();
        if (Status != EFI_SUCCESS) {
            Success = FALSE;
            BeginTextScreen(L"Secure Boot Policy Failure");
            Print(L"Failed to uninstall MOK Secure Boot extensions; forcing a reboot.");
            PauseForKey();
            refit_call4_wrapper(RT->ResetSystem, EfiResetCold, EFI_SUCCESS, 0, NULL);
        }
    }
    return Success;
} // VOID SecureBootUninstall

// Sets the global configuration filename; will be CONFIG_FILE_NAME unless the
// "-c" command-line option is set, in which case that takes precedence.
// If an error is encountered, leaves the value alone (it should be set to
// CONFIG_FILE_NAME when GlobalConfig is initialized).
static VOID SetConfigFilename(EFI_HANDLE ImageHandle) {
    EFI_LOADED_IMAGE *Info;
    CHAR16 *Options, *FileName, *SubString;
    EFI_STATUS Status;

    Status = refit_call3_wrapper(BS->HandleProtocol, ImageHandle, &LoadedImageProtocol, (VOID **) &Info);
    if ((Status == EFI_SUCCESS) && (Info->LoadOptionsSize > 0)) {
        Options = (CHAR16 *) Info->LoadOptions;
        SubString = MyStrStr(Options, L" -c ");
        if (SubString) {
            FileName = StrDuplicate(&SubString[4]);
            if (FileName) {
                LimitStringLength(FileName, 256);
            }

            if (FileExists(SelfDir, FileName)) {
                GlobalConfig.ConfigFilename = FileName;
            } else {
                Print(L"Specified configuration file (%s) doesn't exist; using\n'refind.conf' default\n", FileName);
                MyFreePool(FileName);
            } // if/else
        } // if
    } // if
} // VOID SetConfigFilename()

// Adjust the GlobalConfig.DefaultSelection variable: Replace all "+" elements with the
// rEFInd PreviousBoot variable, if it's available. If it's not available, delete that
// element.
static VOID AdjustDefaultSelection() {
    UINTN i = 0, j;
    CHAR16 *Element = NULL, *NewCommaDelimited = NULL, *PreviousBoot = NULL;
    EFI_STATUS Status;

    LOG(1, LOG_LINE_NORMAL, L"Adjusting default_selection with PreviousBoot values");
    while ((Element = FindCommaDelimited(GlobalConfig.DefaultSelection, i++)) != NULL) {
        if (MyStriCmp(Element, L"+")) {
            Status = EfivarGetRaw(&PloaderGuid, L"PreviousBoot", (CHAR8 **) &PreviousBoot, &j);
            if (Status == EFI_SUCCESS) {
                MyFreePool(Element);
                Element = PreviousBoot;
            } else {
                Element = NULL;
            }
        } // if
        if (Element && StrLen(Element)) {
            MergeStrings(&NewCommaDelimited, Element, L',');
        } // if
        MyFreePool(Element);
    } // while
    MyFreePool(GlobalConfig.DefaultSelection);
    GlobalConfig.DefaultSelection = NewCommaDelimited;
} // AdjustDefaultSelection()

// Log basic information (rEFInd version, EFI version, etc.) to the log file.
VOID LogBasicInfo(VOID) {
    EFI_STATUS Status;
    UINT64     MaximumVariableStorageSize;
    UINT64     RemainingVariableStorageSize;
    UINT64     MaximumVariableSize;
    UINTN      EfiMajorVersion = ST->Hdr.Revision >> 16;
    CHAR16     *TempStr;
    EFI_GUID   ConsoleControlProtocolGuid = EFI_CONSOLE_CONTROL_PROTOCOL_GUID;
    EFI_GUID   UgaDrawProtocolGuid = EFI_UGA_DRAW_PROTOCOL_GUID;
    EFI_GUID   GraphicsOutputProtocolGuid = EFI_GRAPHICS_OUTPUT_PROTOCOL_GUID;

    LOG(1, LOG_LINE_SEPARATOR, L"System information");
#if defined(__MAKEWITH_GNUEFI)
    LOG(1, LOG_LINE_NORMAL, L"Ploader %s built with GNU-EFI", PLOADER_VERSION);
#else
    LOG(1, LOG_LINE_NORMAL, L"Ploader %s built with TianoCore EDK2", PLOADER_VERSION);
#endif
    TempStr = GuidAsString(&(SelfVolume->PartGuid));
    LOG(1, LOG_LINE_NORMAL, L"Ploader boot partition GUID: %s", TempStr);
    MyFreePool(TempStr);
#if defined(EFI32)
    LOG(1, LOG_LINE_NORMAL, L"Platform: x86/IA32/i386 (32-bit)");
#elif defined(EFIX64)
    LOG(1, LOG_LINE_NORMAL, L"Platform: x86-64/X64/AMD64 (64-bit)");
#elif defined(EFIAARCH64)
    LOG(1, LOG_LINE_NORMAL, L"Platform: ARM64/AARCH64 (64-bit)");
#else
    LOG(1, LOG_LINE_NORMAL, L"Platform: unknown");
#endif
    LOG(1, LOG_LINE_NORMAL, L"Log level is %d", GlobalConfig.LogLevel);
    LOG(1, LOG_LINE_NORMAL, L"Menu timeout is %d", GlobalConfig.Timeout);
    LOG(1, LOG_LINE_NORMAL, L"Firmware: %s %d.%02d", ST->FirmwareVendor,
        ST->FirmwareRevision >> 16, ST->FirmwareRevision & ((1 << 16) - 1));
    LOG(1, LOG_LINE_NORMAL, L"EFI Revision %d.%02d", EfiMajorVersion,
        ST->Hdr.Revision & ((1 << 16) - 1));
    LOG(1, LOG_LINE_NORMAL, L"Secure Boot %s", secure_mode() ? L"active" : L"inactive");
    LOG(1, LOG_LINE_NORMAL, L"Shim is%s available", ShimLoaded() ? L"" : L" not");
    switch (GlobalConfig.LegacyType) {
        case LEGACY_TYPE_MAC:
            TempStr = L"CSM type: Mac";
            break;
        case LEGACY_TYPE_UEFI:
            TempStr = L"CSM type: UEFI";
            break;
        case LEGACY_TYPE_NONE:
            TempStr = L"CSM is not available";
            break;
        default: // should never happen; just in case....
            TempStr = L"CSM type: unknown";
            break;
    }
    LOG(1, LOG_LINE_NORMAL, TempStr);
    if (EfiMajorVersion > 1) { // QueryVariableInfo() is not supported in EFI 1.x
        LOG(3, LOG_LINE_NORMAL, L"Trying to get variable info....");
        Status = refit_call4_wrapper(RT->QueryVariableInfo, EFI_VARIABLE_NON_VOLATILE,
                                     &MaximumVariableStorageSize, &RemainingVariableStorageSize,
                                     &MaximumVariableSize);
        if (EFI_ERROR(Status)) {
            LOG(1, LOG_LINE_NORMAL, L"Error %d; Unable to retrieve EFI variable capacity", Status);
        } else {
            LOG(1, LOG_LINE_NORMAL, L"EFI non-volatile storage:");
            LOG(1, LOG_LINE_NORMAL, L"   Total storage: %ld", MaximumVariableStorageSize);
            LOG(1, LOG_LINE_NORMAL, L"   Remaining available: %ld", RemainingVariableStorageSize);
            LOG(1, LOG_LINE_NORMAL, L"   Maximum variable size: %ld", MaximumVariableSize);
        }
    } else {
        LOG(1, LOG_LINE_NORMAL, L"EFI 1.x; EFI non-volatile storage information is unavailable");
    }

    // Report which video output devices are available. We don't actually
    // use them, so just use TempStr as a throwaway pointer to the protocol.
    Status = LibLocateProtocol(&ConsoleControlProtocolGuid, (VOID **) &TempStr);
    LOG(1, LOG_LINE_NORMAL, L"System does%s support text mode",
        EFI_ERROR(Status) ? L" not" : L"");

    Status = LibLocateProtocol(&UgaDrawProtocolGuid, (VOID **) &TempStr);
    LOG(1, LOG_LINE_NORMAL, L"System does%s support UGA Draw graphics mode",
        EFI_ERROR(Status) ? L" not" : L"");

    Status = LibLocateProtocol(&GraphicsOutputProtocolGuid, (VOID **) &TempStr);
    LOG(1, LOG_LINE_NORMAL, L"System does%s support GOP graphics mode",
        EFI_ERROR(Status) ? L" not" : L"");

#ifdef __MAKEWITH_TIANO
    if (gDS == 0) {
        LOG(1, LOG_LINE_NORMAL, L"WARNING: EfiGetSystemConfigurationTable() returned error status %lu!", Status);
        LOG(1, LOG_LINE_NORMAL, L"         Some functionality will be impaired!");
    }
#endif
} // VOID LogBasicInfo()

//
// main entry point
//
EFI_STATUS
EFIAPI
efi_main (EFI_HANDLE ImageHandle, EFI_SYSTEM_TABLE *SystemTable)
{
    EFI_STATUS         Status;
    BOOLEAN            MainLoopRunning = TRUE;
    BOOLEAN            MokProtocol;
    REFIT_MENU_ENTRY   *ChosenEntry;
    UINTN              MenuExit = MENU_EXIT_ENTER, i;
    CHAR16             *SelectionName = NULL;
    EG_PIXEL           BGColor = COLOR_LIGHTBLUE;

    // bootstrap
    InitializeLib(ImageHandle, SystemTable);
    Status = InitRefitLib(ImageHandle);
    if (EFI_ERROR(Status))
        return Status;

    // read configuration
    MyCopyMem(GlobalConfig.ScanFor, "ieom       ", NUM_SCAN_OPTIONS);
    FindLegacyBootType();
    if (GlobalConfig.LegacyType == LEGACY_TYPE_MAC)
       MyCopyMem(GlobalConfig.ScanFor, "ihebocm    ", NUM_SCAN_OPTIONS);
    SetConfigFilename(ImageHandle);

    // Scan volumes first to find SelfVolume, which is needed by LoadDrivers()
    // and ReadConfig(); however, if drivers are loaded, a second call to
    // ScanVolumes() is needed to register the new filesystem(s) accessed
    // by the drivers.
    ScanVolumes();
    ReadConfig(GlobalConfig.ConfigFilename);
    if (GlobalConfig.LogLevel > 0) {
        StartLogging(FALSE);
        LogBasicInfo();
    }
    egLoadFont(L"theme\\font.png"); // pearOS: theme is hardcoded (pear-bootloader theme)
    LOG(3, LOG_LINE_NORMAL, L"GlobalConfig.DontScanFiles is '%s'", GlobalConfig.DontScanFiles);
    MokProtocol = SecureBootSetup();
    if (LoadDrivers())
        ScanVolumes();
    PlayBootSound();

    LOG(1, LOG_LINE_SEPARATOR, L"Initializing basic features");
    AdjustDefaultSelection();

    if (GlobalConfig.SpoofOSXVersion && GlobalConfig.SpoofOSXVersion[0] != L'\0')
        SetAppleOSInfo();

    InitScreen();
    WarnIfLegacyProblems();
    MainMenu.TimeoutSeconds = GlobalConfig.Timeout;

    // disable EFI watchdog timer
    LOG(1, LOG_LINE_NORMAL, L"Setting watchdog timer");
    refit_call4_wrapper(BS->SetWatchdogTimer, 0x0000, 0x0000, 0x0000, NULL);

    // further bootstrap (now with config available)
    SetupScreen();
    SetVolumeIcons();
    ScanForBootloaders(FALSE);
    ScanForTools();

    // pearOS: seamless boot -- with no boot-mode key held, skip the menu entirely and
    // boot straight into the first detected OS, with no rEFInd screen shown at all.
    // Hold Alt+M during boot to see the picker instead (macOS-style boot option keys),
    // or one of the recovery/hardware-test combos to jump straight to that partition.
    // Set "silent_menu false" in ploader.conf to disable this and always show the menu.
    if (GlobalConfig.SilentMenu) {
        PEAROS_BOOT_MODE BootMode = DetectBootMode();
        LOADER_ENTRY *SpecialEntry = NULL;

        switch (BootMode) {
            case PEAROS_BOOT_INTERNET_RECOVERY:
                SpecialEntry = FindLoaderByVolumeLabel(L"PEAROS_IREC");
                break;
            case PEAROS_BOOT_FACTORY_RECOVERY:
                SpecialEntry = FindLoaderByVolumeLabel(L"PEAROS_FREC");
                break;
            case PEAROS_BOOT_LOCAL_RECOVERY:
                SpecialEntry = FindLoaderByVolumeLabel(L"PEAROS_LREC");
                break;
            case PEAROS_BOOT_HARDWARE_TEST:
                SpecialEntry = FindLoaderByVolumeLabel(L"PEAROS_HWT");
                break;
            default:
                break;
        }

        if (SpecialEntry != NULL) {
            LOG(1, LOG_LINE_SEPARATOR, L"Boot-mode key combo detected; booting '%s'", SpecialEntry->Title);
            StartLoader(SpecialEntry, SpecialEntry->Title);
            // only returns on failure; fall through to the normal menu below
        } else if (BootMode == PEAROS_BOOT_NORMAL) {
            LOADER_ENTRY *SilentEntry = FirstLoaderEntry();
            if (SilentEntry != NULL) {
                LOG(1, LOG_LINE_SEPARATOR, L"No boot-mode key held; booting first detected OS silently");
                StartLoader(SilentEntry, SilentEntry->Title);
                // only returns on failure; fall through to the normal menu below
            }
        }
        // PEAROS_BOOT_MENU (Alt+M), or any special combo that found no matching
        // partition, falls through to the normal interactive menu below.
    }

    // SetupScreen() clears the screen; but ScanForBootloaders() may display a
    // message that must be deleted, so do so
    BltClearScreen(TRUE);
    pdInitialize();

    if (GlobalConfig.ScanDelay > 0) {
       if (GlobalConfig.ScanDelay > 1) {
          LOG(1, LOG_LINE_NORMAL, L"Pausing before re-scan");
          egDisplayMessage(L"Pausing before disk scan; please wait....", &BGColor, CENTER);
       }
       for (i = 0; i < GlobalConfig.ScanDelay; i++)
          refit_call1_wrapper(BS->Stall, 1000000);
       RescanAll(GlobalConfig.ScanDelay > 1, TRUE);
       BltClearScreen(TRUE);
    } // if

    if (GlobalConfig.DefaultSelection)
       SelectionName = StrDuplicate(GlobalConfig.DefaultSelection);
    if (GlobalConfig.ShutdownAfterTimeout)
        MainMenu.TimeoutText = L"Shutdown";

    LOG(1, LOG_LINE_SEPARATOR, L"Entering main loop");
    while (MainLoopRunning) {
        MenuExit = RunMainMenu(&MainMenu, &SelectionName, &ChosenEntry);

        // The Escape key triggers a re-scan operation....
        if (MenuExit == MENU_EXIT_ESCAPE) {
            MenuExit = 0;
            RescanAll(TRUE, TRUE);
            continue;
        }

        if ((MenuExit == MENU_EXIT_TIMEOUT) && GlobalConfig.ShutdownAfterTimeout) {
            ChosenEntry->Tag = TAG_SHUTDOWN;
        }

        switch (ChosenEntry->Tag) {

            case TAG_REBOOT:    // Reboot
                TerminateScreen();
                LOG(1, LOG_LINE_SEPARATOR, L"Rebooting system");
                refit_call4_wrapper(RT->ResetSystem, EfiResetCold, EFI_SUCCESS, 0, NULL);
                LOG(1, LOG_LINE_NORMAL, L"Reboot FAILED!");
                MainLoopRunning = FALSE;   // just in case we get this far
                break;

            case TAG_SHUTDOWN: // Shut Down
                TerminateScreen();
                LOG(1, LOG_LINE_SEPARATOR, L"Shutting down system");
                refit_call4_wrapper(RT->ResetSystem, EfiResetShutdown, EFI_SUCCESS, 0, NULL);
                LOG(1, LOG_LINE_NORMAL, L"Shutdown FAILED!");
                MainLoopRunning = FALSE;   // just in case we get this far
                break;

            case TAG_ABOUT:    // About rEFInd
                AboutPloader();
                break;

            case TAG_LOADER:   // Boot OS via .EFI loader
                StartLoader((LOADER_ENTRY *)ChosenEntry, SelectionName);
                break;

            case TAG_LEGACY:   // Boot legacy OS
                StartLegacy((LEGACY_ENTRY *)ChosenEntry, SelectionName);
                break;

            case TAG_LEGACY_UEFI: // Boot a legacy OS on a non-Mac
                StartLegacyUEFI((LEGACY_ENTRY *)ChosenEntry, SelectionName);
                break;

            case TAG_FIRMWARE_LOADER: // Reboot to a loader defined in the EFI UseNVRAM
                RebootIntoLoader((LOADER_ENTRY *)ChosenEntry);
                break;

            case TAG_TOOL:     // Start a EFI tool
                StartTool((LOADER_ENTRY *)ChosenEntry);
                break;

            case TAG_HIDDEN:  // Manage hidden tag entries
                ManageHiddenTags();
                break;

            case TAG_EXIT:    // Terminate rEFInd
                if ((MokProtocol) && !SecureBootUninstall()) {
                   MainLoopRunning = FALSE;   // just in case we get this far
                } else {
                   BeginTextScreen(L" ");
                   return EFI_SUCCESS;
                }
                break;

            case TAG_FIRMWARE: // Reboot into firmware's user interface
                RebootIntoFirmware();
                break;

            case TAG_CSR_ROTATE:
                RotateCsrValue();
                break;

            case TAG_INSTALL:
                InstallRefind();
                break;

            case TAG_BOOTORDER:
                ManageBootorder();
                break;

        } // switch()
    } // while()
    MyFreePool(SelectionName);

    // If we end up here, things have gone wrong. Try to reboot, and if that
    // fails, go into an endless loop.
    LOG(1, LOG_LINE_SEPARATOR, L"Main loop has exited, but it should not have!");
    UninitRefitLib();
    refit_call4_wrapper(RT->ResetSystem, EfiResetCold, EFI_SUCCESS, 0, NULL);
    ReinitRefitLib();
    LOG(1, LOG_LINE_SEPARATOR, L"Shutdown after main loop exit has FAILED!");
    StopLogging();
    EndlessIdleLoop();

    return EFI_SUCCESS;
} /* efi_main() */
