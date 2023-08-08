import { createSelector } from '@reduxjs/toolkit';

import type { IAppState } from '..';

export const selectHardware = (state: IAppState) => state.hardware;

export const selectHardwareConnected = createSelector(
  selectHardware,
  (s) => s.connected,
);

export const selectUpdateFirmwareStep = createSelector(
  selectHardware,
  (s) => s.updateFirmwareStep,
);

export const selectHardwarePreviousAddress = createSelector(
  selectHardware,
  (s) => s.previousAddress,
);

export const selectHardwarePassphraseOpened = createSelector(
  selectHardware,
  (s) => s.passphraseOpened,
);
