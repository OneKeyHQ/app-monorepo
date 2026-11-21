/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useFalconEventEndedDialog } from './useFalconEventEndedDialog';

const mockShow = jest.fn<void, [unknown]>();
const mockSetDoNotShow = jest.fn<Promise<void>, []>();
const mockRun = jest.fn<void, []>();
let mockDismissed: boolean | undefined;

jest.mock('@onekeyhq/components', () => ({
  Checkbox: 'Checkbox',
  Dialog: {
    show: (options: unknown) => mockShow(options),
    Form: 'Form',
    FormField: 'FormField',
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/views/Staking/components/utils', () => ({
  formatApy: (value: string | number) => value,
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockDismissed, run: mockRun }),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getFalconDepositDoNotShowAgain: jest.fn(),
      setFalconDepositDoNotShowAgain: () => mockSetDoNotShow(),
    },
  },
}));

describe('Falcon ended event dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDismissed = false;
    mockSetDoNotShow.mockResolvedValue(undefined);
  });

  it.each([
    { providerName: 'Ethena', eventEndTime: 1, dismissed: false },
    {
      providerName: 'Falcon',
      eventEndTime: Date.now() + 100_000,
      dismissed: false,
    },
    { providerName: 'FALCON', eventEndTime: 1, dismissed: true },
  ])(
    'does not show a notice when its criteria are not met: $providerName',
    async ({ providerName, eventEndTime, dismissed }) => {
      mockDismissed = dismissed;
      const { result } = renderHook(() =>
        useFalconEventEndedDialog({ providerName, eventEndTime }),
      );
      await expect(
        result.current.showFalconEventEndedDialog(),
      ).resolves.toBeUndefined();
      expect(mockShow).not.toHaveBeenCalled();
      expect(mockSetDoNotShow).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'waits for confirmation and preserves the checkbox setting (%s)',
    async (showAgain) => {
      jest.useFakeTimers();
      try {
        const { result } = renderHook(() =>
          useFalconEventEndedDialog({
            providerName: 'fAlCoN',
            eventEndTime: 1,
          }),
        );
        let resolved = false;
        const shown = result.current.showFalconEventEndedDialog().then(() => {
          resolved = true;
        });
        expect(mockShow).toHaveBeenCalledTimes(1);
        expect(resolved).toBe(false);
        const options = mockShow.mock.calls[0][0] as {
          onConfirm: (instance: {
            getForm: () => { getValues: () => { showAgain: boolean } };
            close: () => Promise<void>;
          }) => Promise<void>;
        };
        const close = jest.fn().mockResolvedValue(undefined);
        await act(async () => {
          await options.onConfirm({
            getForm: () => ({ getValues: () => ({ showAgain }) }),
            close,
          });
          await shown;
        });
        expect(close).toHaveBeenCalledTimes(1);
        expect(mockSetDoNotShow).toHaveBeenCalledTimes(showAgain ? 1 : 0);
        expect(mockRun).not.toHaveBeenCalled();
        act(() => jest.runOnlyPendingTimers());
        expect(mockRun).toHaveBeenCalledTimes(showAgain ? 1 : 0);
      } finally {
        jest.useRealTimers();
      }
    },
  );
});
