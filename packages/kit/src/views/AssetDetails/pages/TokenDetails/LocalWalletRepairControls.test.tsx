/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import {
  SetupRepairControl,
  createEnableBirthdayForm,
  readEnableBirthday,
} from './LocalWalletRepairControls';

const mockRetrySetup = jest.fn(async (_params: unknown) => undefined);
const mockToastSuccess = jest.fn((_params: unknown) => undefined);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    testID,
    onPress,
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
  }) => (
    <button type="button" data-testid={testID} onClick={onPress}>
      {children}
    </button>
  ),
  Toast: { success: (params: unknown) => mockToastSuccess(params) },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrivacyChain: {
      retryLocalWalletAccountSetup: (params: unknown) => mockRetrySetup(params),
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({}));

describe('setup repair', () => {
  beforeEach(() => {
    mockRetrySetup.mockReset();
    mockToastSuccess.mockReset();
  });

  it('reports a failed repair instead of claiming success', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockRetrySetup.mockRejectedValueOnce(new Error('identity mismatch'));
    const onDone = jest.fn();
    const onError = jest.fn();
    try {
      const { getByTestId } = render(
        <SetupRepairControl
          networkId="zec--0"
          accountId="hd-1--zec"
          onDone={onDone}
          onError={onError}
        />,
      );
      await act(async () => {
        fireEvent.click(getByTestId('local-wallet-repair-setup-btn'));
      });
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onDone).not.toHaveBeenCalled();
      expect(mockToastSuccess).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('confirms a completed repair', async () => {
    const onDone = jest.fn();
    const onError = jest.fn();
    const { getByTestId } = render(
      <SetupRepairControl
        networkId="zec--0"
        accountId="hd-1--zec"
        onDone={onDone}
        onError={onError}
      />,
    );
    await act(async () => {
      fireEvent.click(getByTestId('local-wallet-repair-setup-btn'));
    });
    expect(mockRetrySetup).toHaveBeenCalledWith({
      networkId: 'zec--0',
      accountId: 'hd-1--zec',
    });
    expect(mockToastSuccess).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('birthday date precision', () => {
  it.each([new Date(2024, 1, 29, 18, 30), new Date(2025, 6, 19, 9, 45)])(
    'preserves the selected local day, including leap day (%s)',
    (date) => {
      expect(
        readEnableBirthday({ mode: 'date', date }, undefined, 'zec--0'),
      ).toEqual({
        birthdayTimestamp: new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        ).getTime(),
      });
    },
  );

  it('uses the explicit height without a stale date', () => {
    expect(
      readEnableBirthday(
        { mode: 'height', date: new Date(2025, 6, 19), height: ' 2500000 ' },
        undefined,
        'zec--0',
      ),
    ).toEqual({ birthdayHeight: 2_500_000 });
  });

  it.each(['date', 'height'] as const)(
    'lets the earliest-start choice override %s input',
    (mode) => {
      const earliest = { height: 1_687_104, timestamp: 1_653_955_200_000 };
      expect(
        readEnableBirthday(
          { mode, date: new Date(2025, 6, 19), fromEarliest: true },
          earliest,
          'zec--0',
        ),
      ).toEqual({ birthdayHeight: earliest.height });
    },
  );

  it.each(['', 'abc', '-1', '0', '1.5', '1e6', '9007199254740992'])(
    'rejects an empty, non-integer or unsafe height (%s)',
    (height) => {
      expect(
        readEnableBirthday(
          { mode: 'height', date: null, height },
          undefined,
          'zec--0',
        ),
      ).toBeUndefined();
    },
  );

  it('requires manual heights at or above the supported chain floor', () => {
    const earliest = { height: 1_687_104, timestamp: 1_653_955_200_000 };
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '1687103' },
        earliest,
        'zec--0',
      ),
    ).toBeUndefined();
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '1687104' },
        earliest,
        'zec--0',
      ),
    ).toEqual({ birthdayHeight: earliest.height });
  });

  it('rejects values that would overflow the Zcash runtime height', () => {
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '4294967296' },
        undefined,
        'zec--0',
      ),
    ).toBeUndefined();
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '4294967295' },
        undefined,
        'zec--0',
      ),
    ).toEqual({ birthdayHeight: 4_294_967_295 });
  });

  it.each([null, new Date(Number.NaN)])(
    'rejects an empty or invalid date',
    (date) => {
      expect(
        readEnableBirthday({ mode: 'date', date }, undefined, 'zec--0'),
      ).toBeUndefined();
    },
  );

  it('defaults to the recommended date without truncating its day', () => {
    const hint = new Date(2025, 6, 19).getTime();
    const form = createEnableBirthdayForm(hint);
    expect(form.current.mode).toBe('date');
    expect(readEnableBirthday(form.current, undefined, 'zec--0')).toEqual({
      birthdayTimestamp: hint,
    });
  });
});
