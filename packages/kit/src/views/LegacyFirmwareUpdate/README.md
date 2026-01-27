# Legacy Firmware Update

This module provides firmware update functionality for legacy OneKey hardware devices that require a specialized upgrade flow.

## Overview

The Legacy Firmware Update feature is designed for devices with firmware versions below the minimum supported version. These devices require a different update process compared to the standard firmware update flow.

## Supported Devices

- OneKey Touch
- OneKey Mini
- OneKey Classic / Classic 1S / Classic Pure

> Note: OneKey Pro devices do not use the legacy update flow.

## Architecture

### Components

- **LegacyUpdateStepIndicator** - Visual step indicator showing upgrade progress (idle -> preparing -> downloading -> installing -> done)
- **LegacyUpdateCheckList** - Pre-update checklist with device info and confirmation items
- **LegacyUpdateProgress** - Progress display with smooth animations during firmware installation
- **LegacyUpdateResult** - Success/failure result display with appropriate actions
- **MiniBootloaderModeGuide** - Guide for manually entering bootloader mode on Mini devices
- **WebUsbDeviceReselectPrompt** - WebUSB device reselection prompt for web/extension platforms
- **LegacyFirmwareUpdateExitPrevent** - Prevents accidental navigation during update process

### Services

The backend service (`ServiceLegacyFirmwareUpdate`) provides:
- Device type detection and handler selection
- Firmware download and installation
- Progress tracking and state management
- Transport type locking during updates

### State Management

Uses Jotai atoms for reactive state:
- `legacyFirmwareUpdateStepAtom` - Current update step
- `legacyFirmwareUpdateProgressAtom` - Download/install progress
- `legacyFirmwareUpdateRunningAtom` - Whether update is in progress

## Update Flow

1. **Preparation** - Validate device and backup confirmation
2. **Download** - Fetch firmware/bootloader binaries
3. **Installation** - Flash firmware to device (may require bootloader mode)
4. **Completion** - Verify update and display result

## Platform Support

- Web (WebUSB)
- Browser Extension (WebUSB)
- Mobile Native (Bluetooth)

## Related Files

- Service: `packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/`
- Handlers: `packages/kit-bg/src/services/ServiceLegacyFirmwareUpdate/handlers/`
- State: `packages/kit-bg/src/states/jotai/atoms/legacyFirmwareUpdate.ts`
- Routes: `packages/shared/src/routes/legacyFirmwareUpdate.ts`
