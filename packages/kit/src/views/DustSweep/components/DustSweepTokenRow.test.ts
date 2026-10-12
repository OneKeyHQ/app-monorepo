import { createIntl } from 'react-intl';

import { LOCALE_LOADERS } from '@onekeyhq/shared/src/locale/localeLoaders';
import type { IDustSweepReason } from '@onekeyhq/shared/types/swap/dustSweep';

import {
  dustSweepReasonMessageIds,
  getDustSweepReasonMessage,
} from './DustSweepTokenRow';

jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/views/Swap/components/PreSwapStep', () => ({
  SwapStepStatusIcon: () => null,
}));

describe('Dust Sweep reason messages', () => {
  it.each(Object.entries(LOCALE_LOADERS))(
    'formats reasons without interpolation values in %s',
    async (locale, loadMessages) => {
      const messages = await loadMessages();
      const onError = jest.fn();
      const intl = createIntl({ locale, messages, onError });
      const reasons = Object.keys(
        dustSweepReasonMessageIds,
      ) as IDustSweepReason[];

      for (const reason of reasons) {
        const id = dustSweepReasonMessageIds[reason];
        expect(messages[id]).toBeTruthy();
        expect(getDustSweepReasonMessage(intl, reason)).not.toBe(id);
      }

      expect(onError).not.toHaveBeenCalled();
    },
  );
});
