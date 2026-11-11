/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  BirthdayDialogForm,
  createEnableBirthdayForm,
  getBirthdayHeightHint,
  readEnableBirthday,
} from './LocalWalletRepairControls';

import type { IBirthdayFormState } from './LocalWalletRepairControls';

const ironwoodBirthday = {
  height: 3_428_143,
  timestamp: Date.UTC(2026, 6, 28),
};
const mockDismissKeyboard = jest.fn<void, []>();
const mockScrollViewContext = {
  scrollViewRef: { current: null },
  pageOffsetRef: { current: { x: 0, y: 0 } },
};
const originalNative = platformEnv.isNative;

jest.mock('react-native', () => {
  const actual =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ...actual,
    Keyboard: {
      dismiss: () => mockDismissKeyboard(),
      addListener: () => ({ remove: () => {} }),
    },
  };
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { height?: string }) =>
      values?.height ? `${id}: ${values.height}` : id,
    formatNumber: (value: number) =>
      new Intl.NumberFormat('en-US').format(value),
  }),
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    getLocale: () => 'en-US',
    onLocaleChange: (_callback: () => void) => () => {},
  },
}));
jest.mock('@onekeyhq/components', () => ({
  useScrollView: () => mockScrollViewContext,
  HeightTransition: ({
    children,
    hide,
  }: {
    children?: ReactNode;
    hide?: boolean;
  }) => (hide ? null : <>{children}</>),
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
  Checkbox: ({
    testID,
    value,
    onChange,
    label,
    description,
  }: {
    testID?: string;
    value: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
  }) => (
    <label>
      <input
        type="checkbox"
        data-testid={testID}
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
      <span>{description}</span>
    </label>
  ),
  Input: ({
    value,
    testID,
    onChangeText,
    onBlur,
    onFocus,
    error,
    disabled,
    placeholder,
    addOns,
  }: {
    value: string;
    testID: string;
    error?: boolean;
    disabled?: boolean;
    placeholder?: string;
    onChangeText: (value: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    addOns?: {
      testID?: string;
      accessibilityLabel?: string;
      onPress?: () => void;
    }[];
  }) => (
    <>
      <input
        data-testid={testID}
        value={value}
        aria-invalid={error}
        disabled={disabled}
        placeholder={placeholder}
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={(event) => onChangeText(event.target.value)}
      />
      {addOns?.map((addOn) => (
        <button
          key={addOn.testID}
          type="button"
          data-testid={addOn.testID}
          aria-label={addOn.accessibilityLabel}
          onClick={() => addOn.onPress?.()}
        />
      ))}
    </>
  ),
  DatePicker: ({
    value,
    minDate,
    disabled,
    onChange,
  }: {
    value?: Date | null;
    minDate?: Date;
    disabled?: boolean;
    onChange: (value: Date) => void;
  }) => {
    const localDay = (date?: Date | null) =>
      date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : '';
    return (
      <input
        type="date"
        data-testid="birthday-date-picker"
        value={localDay(value)}
        min={localDay(minDate)}
        disabled={disabled}
        onChange={(event) => {
          const [year, month, day] = event.target.value.split('-').map(Number);
          onChange(new Date(year, month - 1, day));
        }}
      />
    );
  },
  SegmentControl: ({
    testID,
    value,
    onChange,
    options,
  }: {
    testID?: string;
    value: string;
    onChange: (value: string) => void;
    options: { label: string; value: string; disabled?: boolean }[];
  }) => (
    <select
      data-testid={testID}
      value={value}
      disabled={options.every((option) => option.disabled)}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option
          key={option.value}
          value={option.value}
          disabled={option.disabled}
        >
          {option.label}
        </option>
      ))}
    </select>
  ),
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SizableText: ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <span data-testid={testID}>{children}</span>,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
// The chain tip is not known yet: heights have no upper bound.
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));

describe('birthday date precision', () => {
  afterEach(() => {
    platformEnv.isNative = originalNative;
    mockDismissKeyboard.mockClear();
  });

  it('can hide the native repair keyboard while keeping an invalid height for correction', () => {
    platformEnv.isNative = true;
    const formRef: { current: IBirthdayFormState } = {
      current: { mode: 'height', date: null, height: '3500000' },
    };
    const page = render(
      <BirthdayDialogForm
        networkId="zec--0"
        formRef={formRef}
        earliestBirthday={ironwoodBirthday}
      />,
    );
    const input = page.getByTestId(
      'local-wallet-birthday-height-input',
    ) as HTMLInputElement;
    expect(
      page.queryByTestId('local-wallet-birthday-height-input-hide-keyboard'),
    ).toBeNull();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);
    expect(page.getByTestId('local-wallet-birthday-height-error')).toBeTruthy();
    fireEvent.focus(input);
    fireEvent.click(
      page.getByTestId('local-wallet-birthday-height-input-hide-keyboard'),
    );
    expect(mockDismissKeyboard).toHaveBeenCalledTimes(1);
    fireEvent.blur(input);
    expect(
      page.queryByTestId('local-wallet-birthday-height-input-hide-keyboard'),
    ).toBeNull();
    expect(input.value).toBe('1');
    expect(
      readEnableBirthday(formRef.current, ironwoodBirthday, 'zec--0'),
    ).toBeUndefined();
    fireEvent.change(input, {
      target: { value: String(ironwoodBirthday.height) },
    });
    expect(page.queryByTestId('local-wallet-birthday-height-error')).toBeNull();
    expect(
      readEnableBirthday(formRef.current, ironwoodBirthday, 'zec--0'),
    ).toEqual({
      birthdayHeight: ironwoodBirthday.height,
    });
  });

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
      const earliest = ironwoodBirthday;
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
    const earliest = ironwoodBirthday;
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '3428142' },
        earliest,
        'zec--0',
      ),
    ).toBeUndefined();
    expect(
      readEnableBirthday(
        { mode: 'height', date: null, height: '3428143' },
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

  it('rejects a height above the known chain tip and keeps the tip itself', () => {
    const form = (height: string) => ({
      mode: 'height' as const,
      date: null,
      height,
      maxHeight: 3_600_000,
    });
    expect(
      readEnableBirthday(form('3600001'), undefined, 'zec--0'),
    ).toBeUndefined();
    expect(readEnableBirthday(form('3600000'), undefined, 'zec--0')).toEqual({
      birthdayHeight: 3_600_000,
    });
  });

  it.each([
    ['', false, undefined, 'Block height ≥ 1,687,104'],
    ['', false, 3_600_000, 'Block height 1,687,104 – 3,600,000'],
    ['1000', true, 3_600_000, 'Block height ≥ 1,687,104'],
    ['999999999', true, 3_600_000, 'Block height ≤ 3,600,000'],
    ['99999999999999999999', true, 3_600_000, 'Block height ≤ 3,600,000'],
    ['99999999999', true, undefined, 'Invalid number'],
    ['1.5', true, 3_600_000, 'Invalid number'],
  ])(
    'tells %p which bound it breaks',
    (height, invalid, maxHeight, expected) => {
      expect(
        getBirthdayHeightHint({
          height,
          invalid,
          minHeight: 1_687_104,
          maxHeight,
          label: 'Block height',
          invalidText: 'Invalid number',
        }),
      ).toBe(expected);
    },
  );

  it('defaults to today without a recommended date', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 29, 15, 30));
    try {
      const form = createEnableBirthdayForm();
      expect(form.current).toEqual({
        mode: 'date',
        date: new Date(2026, 9, 29),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('defaults to the recommended date without truncating its day', () => {
    const hint = new Date(2025, 6, 19).getTime();
    const form = createEnableBirthdayForm(hint);
    expect(form.current.mode).toBe('date');
    expect(readEnableBirthday(form.current, undefined, 'zec--0')).toEqual({
      birthdayTimestamp: hint,
    });
  });
});

describe('supported scan start', () => {
  it.each(['date', 'height', 'saved-birthday'] as const)(
    'uses the Ironwood start instead of custom %s input when checked',
    (mode) => {
      expect(
        readEnableBirthday(
          {
            mode,
            date: new Date(2026, 9, 19),
            height: '3500000',
            fromEarliest: true,
          },
          ironwoodBirthday,
          'zec--0',
        ),
      ).toEqual({ birthdayHeight: 3_428_143 });
    },
  );

  it.each([1_687_104, 3_428_142])(
    'rejects a manual height before Ironwood (%s)',
    (height) => {
      expect(
        readEnableBirthday(
          { mode: 'height', date: null, height: String(height) },
          ironwoodBirthday,
          'zec--0',
        ),
      ).toBeUndefined();
    },
  );

  it.each([
    { date: new Date(2026, 6, 27, 23, 59), valid: false },
    { date: new Date(2026, 6, 28), valid: true },
    { date: new Date(2026, 6, 28, 16, 30), valid: true },
  ])(
    'validates the local calendar day against the Ironwood date ($date)',
    ({ date, valid }) => {
      const result = readEnableBirthday(
        { mode: 'date', date },
        ironwoodBirthday,
        'zec--0',
      );
      expect(result).toEqual(
        valid
          ? { birthdayTimestamp: new Date(2026, 6, 28).getTime() }
          : undefined,
      );
    },
  );

  it('clamps an earlier recommended date to the supported calendar day', () => {
    const form = createEnableBirthdayForm(
      new Date(2026, 6, 1).getTime(),
      ironwoodBirthday,
    );
    expect(form.current.date?.getTime()).toBe(new Date(2026, 6, 28).getTime());
    expect(
      readEnableBirthday(form.current, ironwoodBirthday, 'zec--0'),
    ).toEqual({
      birthdayTimestamp: new Date(2026, 6, 28).getTime(),
    });
  });

  it('preserves a recommended date after the chain minimum', () => {
    const hint = new Date(2026, 9, 19).getTime();
    const form = createEnableBirthdayForm(hint, ironwoodBirthday);
    expect(form.current.date?.getTime()).toBe(hint);
  });

  it('defaults to today in the local timezone when there is no recommended date', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 3, 23, 30));
    try {
      const form = createEnableBirthdayForm(undefined, ironwoodBirthday);
      expect(form.current.date?.getTime()).toBe(
        new Date(2026, 10, 3).getTime(),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses Monero block 1 for its beginning', () => {
    expect(
      readEnableBirthday(
        {
          mode: 'saved-birthday',
          date: null,
          height: '3000000',
          fromEarliest: true,
        },
        { height: 1, timestamp: Date.UTC(2014, 3, 18) },
        'xmr--0',
      ),
    ).toEqual({ birthdayHeight: 1 });
  });

  it('keeps the height controls visible and locked at the supported start, then restores custom input', () => {
    const formRef: { current: IBirthdayFormState } = {
      current: {
        mode: 'height',
        date: new Date(2026, 9, 19),
        height: '3500000',
      },
    };
    const { getByTestId, getByText, queryByText } = render(
      <BirthdayDialogForm
        networkId="zec--0"
        formRef={formRef}
        currentBirthdayHeight={3_500_000}
        earliestBirthday={ironwoodBirthday}
      />,
    );
    expect(getByText(/: 3,500,000$/)).toBeTruthy();
    fireEvent.change(getByTestId('local-wallet-birthday-height-input'), {
      target: { value: '3600000' },
    });
    fireEvent.click(getByTestId('local-wallet-birthday-from-earliest'));

    expect(getByTestId('local-wallet-birthday-mode')).toHaveProperty(
      'disabled',
      true,
    );
    expect(getByTestId('local-wallet-birthday-mode')).toHaveProperty(
      'value',
      'height',
    );
    expect(getByTestId('local-wallet-birthday-height-input')).toHaveProperty(
      'disabled',
      true,
    );
    expect(getByTestId('local-wallet-birthday-height-input')).toHaveProperty(
      'value',
      '3428143',
    );
    expect(getByText(/: 3,428,143$/)).toBeTruthy();
    expect(queryByText(/: 3,500,000$/)).toBeNull();
    fireEvent.change(getByTestId('local-wallet-birthday-mode'), {
      target: { value: 'date' },
    });
    fireEvent.change(getByTestId('local-wallet-birthday-height-input'), {
      target: { value: '3700000' },
    });
    expect(formRef.current.mode).toBe('height');
    expect(formRef.current.height).toBe('3600000');
    expect(
      readEnableBirthday(formRef.current, ironwoodBirthday, 'zec--0'),
    ).toEqual({ birthdayHeight: 3_428_143 });

    fireEvent.click(getByTestId('local-wallet-birthday-from-earliest'));

    expect(getByTestId('local-wallet-birthday-height-input')).toHaveProperty(
      'disabled',
      false,
    );
    expect(getByTestId('local-wallet-birthday-mode')).toHaveProperty(
      'disabled',
      false,
    );
    expect(getByTestId('local-wallet-birthday-height-input')).toHaveProperty(
      'value',
      '3600000',
    );
    expect(getByText(/: 3,500,000$/)).toBeTruthy();
    expect(
      readEnableBirthday(formRef.current, ironwoodBirthday, 'zec--0'),
    ).toEqual({ birthdayHeight: 3_600_000 });
  });

  it.each(['date', 'saved-birthday'] as const)(
    'shows the UTC activation day as a local date while %s is locked and restores it when unchecked',
    (mode) => {
      const customDate = new Date(2026, 9, 19);
      const formRef: { current: IBirthdayFormState } = {
        current: { mode, date: customDate, height: '3500000' },
      };
      const { getByTestId, queryByTestId } = render(
        <BirthdayDialogForm
          networkId="zec--0"
          formRef={formRef}
          earliestBirthday={ironwoodBirthday}
        />,
      );
      if (mode === 'date') {
        expect(getByTestId('birthday-date-picker')).toHaveProperty(
          'min',
          '2026-07-28',
        );
        expect(getByTestId('birthday-date-picker')).toHaveProperty(
          'value',
          '2026-10-19',
        );
      }
      fireEvent.click(getByTestId('local-wallet-birthday-from-earliest'));
      expect(getByTestId('local-wallet-birthday-mode')).toHaveProperty(
        'value',
        'date',
      );
      expect(getByTestId('local-wallet-birthday-mode')).toHaveProperty(
        'disabled',
        true,
      );
      expect(getByTestId('birthday-date-picker')).toHaveProperty(
        'disabled',
        true,
      );
      expect(getByTestId('birthday-date-picker')).toHaveProperty(
        'value',
        '2026-07-28',
      );
      expect(getByTestId('birthday-date-picker')).toHaveProperty(
        'min',
        '2026-07-28',
      );
      fireEvent.change(getByTestId('birthday-date-picker'), {
        target: { value: '2026-10-20' },
      });
      fireEvent.change(getByTestId('local-wallet-birthday-mode'), {
        target: { value: 'height' },
      });
      expect(formRef.current.mode).toBe(mode);
      expect(formRef.current.date).toBe(customDate);
      fireEvent.click(getByTestId('local-wallet-birthday-from-earliest'));
      expect(getByTestId('local-wallet-birthday-mode')).toHaveProperty(
        'value',
        mode,
      );
      expect(getByTestId('local-wallet-birthday-mode')).toHaveProperty(
        'disabled',
        false,
      );
      if (mode === 'date') {
        expect(getByTestId('birthday-date-picker')).toHaveProperty(
          'value',
          '2026-10-19',
        );
        expect(getByTestId('birthday-date-picker')).toHaveProperty(
          'disabled',
          false,
        );
      } else {
        expect(queryByTestId('birthday-date-picker')).toBeNull();
      }
    },
  );
});
