/*
 * File: AudioIo.h
 *
 * Copyright (c) 2018 John Davis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Upstream: https://github.com/acidanthera/OpenCorePkg
 *           Include/Acidanthera/Protocol/AudioIo.h
 * Trimmed for use with gnu-efi (types come from global.h, not <Uefi.h>).
 */

#ifndef EFI_AUDIO_IO_H
#define EFI_AUDIO_IO_H

#ifndef BIT0
#define BIT0  0x0001
#define BIT1  0x0002
#define BIT2  0x0004
#define BIT3  0x0008
#define BIT4  0x0010
#define BIT5  0x0020
#define BIT6  0x0040
#define BIT7  0x0080
#define BIT8  0x0100
#define BIT9  0x0200
#endif

#define EFI_AUDIO_IO_PROTOCOL_GUID \
  { 0x22266891, 0x2032, 0x4BAE,    \
    { 0xB7, 0xB5, 0x43, 0x74, 0xE7, 0x32, 0x09, 0x49 } }

typedef struct EFI_AUDIO_IO_PROTOCOL_ EFI_AUDIO_IO_PROTOCOL;

#define EFI_AUDIO_IO_PROTOCOL_REVISION  4

typedef enum {
  EfiAudioIoTypeOutput,
  EfiAudioIoTypeInput,
  EfiAudioIoTypeMaximum
} EFI_AUDIO_IO_PROTOCOL_TYPE;

typedef enum {
  EfiAudioIoDeviceLine,
  EfiAudioIoDeviceSpeaker,
  EfiAudioIoDeviceHeadphones,
  EfiAudioIoDeviceSpdif,
  EfiAudioIoDeviceMic,
  EfiAudioIoDeviceHdmi,
  EfiAudioIoDeviceOther,
  EfiAudioIoDeviceMaximum
} EFI_AUDIO_IO_PROTOCOL_DEVICE;

typedef enum {
  EfiAudioIoLocationNone,
  EfiAudioIoLocationRear,
  EfiAudioIoLocationFront,
  EfiAudioIoLocationLeft,
  EfiAudioIoLocationRight,
  EfiAudioIoLocationTop,
  EfiAudioIoLocationBottom,
  EfiAudioIoLocationOther,
  EfiAudioIoLocationMaximum
} EFI_AUDIO_IO_PROTOCOL_LOCATION;

typedef enum {
  EfiAudioIoSurfaceExternal,
  EfiAudioIoSurfaceInternal,
  EfiAudioIoSurfaceOther,
  EfiAudioIoSurfaceMaximum
} EFI_AUDIO_IO_PROTOCOL_SURFACE;

typedef enum {
  EfiAudioIoBits8  = BIT0,
  EfiAudioIoBits16 = BIT1,
  EfiAudioIoBits20 = BIT2,
  EfiAudioIoBits24 = BIT3,
  EfiAudioIoBits32 = BIT4
} EFI_AUDIO_IO_PROTOCOL_BITS;

typedef enum {
  EfiAudioIoFreq8kHz   = BIT0,
  EfiAudioIoFreq11kHz  = BIT1,
  EfiAudioIoFreq16kHz  = BIT2,
  EfiAudioIoFreq22kHz  = BIT3,
  EfiAudioIoFreq32kHz  = BIT4,
  EfiAudioIoFreq44kHz  = BIT5,
  EfiAudioIoFreq48kHz  = BIT6,
  EfiAudioIoFreq88kHz  = BIT7,
  EfiAudioIoFreq96kHz  = BIT8,
  EfiAudioIoFreq192kHz = BIT9
} EFI_AUDIO_IO_PROTOCOL_FREQ;

typedef struct {
  EFI_AUDIO_IO_PROTOCOL_TYPE        Type;
  EFI_AUDIO_IO_PROTOCOL_BITS        SupportedBits;
  EFI_AUDIO_IO_PROTOCOL_FREQ        SupportedFreqs;
  EFI_AUDIO_IO_PROTOCOL_DEVICE      Device;
  EFI_AUDIO_IO_PROTOCOL_LOCATION    Location;
  EFI_AUDIO_IO_PROTOCOL_SURFACE     Surface;
} EFI_AUDIO_IO_PROTOCOL_PORT;

#define EFI_AUDIO_IO_PROTOCOL_MAX_CHANNELS  16
#define EFI_AUDIO_IO_PROTOCOL_MAX_VOLUME    100

typedef
VOID
(EFIAPI *EFI_AUDIO_IO_CALLBACK)(
  IN EFI_AUDIO_IO_PROTOCOL        *AudioIo,
  IN VOID                         *Context
  );

typedef
EFI_STATUS
(EFIAPI *EFI_AUDIO_IO_GET_OUTPUTS)(
  IN  EFI_AUDIO_IO_PROTOCOL       *This,
  OUT EFI_AUDIO_IO_PROTOCOL_PORT  **OutputPorts,
  OUT UINTN                       *OutputPortsCount
  );

typedef
EFI_STATUS
(EFIAPI *EFI_AUDIO_IO_RAW_GAIN_TO_DECIBELS)(
  IN  EFI_AUDIO_IO_PROTOCOL       *This,
  IN  UINT64                      OutputIndexMask,
  IN  UINT8                       GainParam,
  OUT INT8                        *Gain
  );

typedef
EFI_STATUS
(EFIAPI *EFI_AUDIO_IO_SETUP_PLAYBACK)(
  IN EFI_AUDIO_IO_PROTOCOL        *This,
  IN UINT64                       OutputIndexMask,
  IN INT8                         Gain,
  IN EFI_AUDIO_IO_PROTOCOL_FREQ   Freq,
  IN EFI_AUDIO_IO_PROTOCOL_BITS   Bits,
  IN UINT8                        Channels,
  IN UINTN                        PlaybackDelay
  );

typedef
EFI_STATUS
(EFIAPI *EFI_AUDIO_IO_START_PLAYBACK)(
  IN EFI_AUDIO_IO_PROTOCOL        *This,
  IN VOID                         *Data,
  IN UINTN                        DataLength,
  IN UINTN                        Position OPTIONAL
  );

typedef
EFI_STATUS
(EFIAPI *EFI_AUDIO_IO_START_PLAYBACK_ASYNC)(
  IN EFI_AUDIO_IO_PROTOCOL        *This,
  IN VOID                         *Data,
  IN UINTN                        DataLength,
  IN UINTN                        Position     OPTIONAL,
  IN EFI_AUDIO_IO_CALLBACK        Callback     OPTIONAL,
  IN VOID                         *Context     OPTIONAL
  );

typedef
EFI_STATUS
(EFIAPI *EFI_AUDIO_IO_STOP_PLAYBACK)(
  IN EFI_AUDIO_IO_PROTOCOL        *This
  );

struct EFI_AUDIO_IO_PROTOCOL_ {
  UINTN                                Revision;
  EFI_AUDIO_IO_GET_OUTPUTS             GetOutputs;
  EFI_AUDIO_IO_RAW_GAIN_TO_DECIBELS    RawGainToDecibels;
  EFI_AUDIO_IO_SETUP_PLAYBACK          SetupPlayback;
  EFI_AUDIO_IO_START_PLAYBACK          StartPlayback;
  EFI_AUDIO_IO_START_PLAYBACK_ASYNC    StartPlaybackAsync;
  EFI_AUDIO_IO_STOP_PLAYBACK           StopPlayback;
};

#endif // EFI_AUDIO_IO_H
