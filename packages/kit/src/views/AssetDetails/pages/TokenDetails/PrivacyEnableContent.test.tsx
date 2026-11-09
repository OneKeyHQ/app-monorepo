/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';

import { readEnableBirthday } from './LocalWalletRepairControls';
import {
  PrivacyEnableContent,
  createPrivacyEnableForm,
} from './PrivacyEnableContent';

type ITestDialog = {
  renderContent: ReactNode;
};

const mockDialog = jest.fn((_options: ITestDialog) => undefined);
const mockToast = jest.fn((_options: unknown) => undefined);
const mockPreventClose = jest.fn();
let mockChainTip: number | undefined;
const earliest = {
  height: 3_428_143,
  timestamp: Date.UTC(2026, 6, 28),
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: { height?: string }) =>
      values?.height ? `${id}: ${values.height}` : id,
    formatNumber: (value: number) => String(value),
  }),
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    getLocale: () => 'en-US',
    onLocaleChange: (_callback: () => void) => () => {},
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({
    formatDate: (date: Date) =>
      `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`,
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: mockChainTip }),
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>;
  return {
    YStack: Stack,
    XStack: Stack,
    SizableText: Stack,
    Button: ({
      children,
      testID,
      onPress,
    }: {
      children?: ReactNode;
      testID?: string;
      onPress: () => void;
    }) => (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    Radio: ({
      value,
      testID,
      onChange,
      options,
    }: {
      value: string;
      testID: string;
      onChange: (value: string) => void;
      options: {
        value: string;
        label: string;
        description?: string;
        children?: ReactNode;
      }[];
    }) => (
      <div>
        {options.map((option) => (
          <div key={option.value}>
            <label>
              <input
                type="radio"
                data-testid={`${testID}-${option.value}`}
                checked={option.value === value}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
            <span>{option.description}</span>
            {option.children}
          </div>
        ))}
      </div>
    ),
    DatePicker: ({
      value,
      onChange,
    }: {
      value?: Date | null;
      onChange: (date: Date) => void;
    }) => (
      <input
        data-testid="privacy-start-date"
        value={value?.getTime() ?? ''}
        onChange={(event) => onChange(new Date(Number(event.target.value)))}
      />
    ),
    Input: ({
      value,
      testID,
      onChangeText,
      onBlur,
      error,
      placeholder,
    }: {
      value: string;
      testID: string;
      error?: boolean;
      placeholder?: string;
      onChangeText: (value: string) => void;
      onBlur: () => void;
    }) => (
      <input
        data-testid={testID}
        value={value}
        aria-invalid={error}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => onChangeText(event.target.value)}
      />
    ),
    Dialog: {
      show: (options: ITestDialog) => mockDialog(options),
      Footer: ({
        onConfirm,
      }: {
        onConfirm: (params: { preventClose: () => void }) => void;
      }) => (
        <button
          type="button"
          data-testid="privacy-start-save"
          onClick={() => onConfirm({ preventClose: mockPreventClose })}
        >
          Save
        </button>
      ),
    },
    Toast: { error: (options: unknown) => mockToast(options) },
  };
});

describe('privacy enable start selection', () => {
  const today = new Date(2026, 10, 4).getTime();
  const networks = [
    { networkId: 'zec--0', earliestBirthday: earliest },
    {
      networkId: 'xmr--0',
      earliestBirthday: { height: 1, timestamp: Date.UTC(2014, 3, 18) },
    },
  ];

  beforeEach(() => {
    mockDialog.mockClear();
    mockToast.mockClear();
    mockPreventClose.mockClear();
    mockChainTip = undefined;
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 4, 12));
  });

  afterEach(() => jest.useRealTimers());

  it.each([
    ['hw-1--0', true, true],
    ['hw-1--0', false, false],
    ['hd-1--0', true, false],
  ])(
    'preserves the device view-key disclosure for %s (device asked: %s)',
    (accountId, deviceExportsViewKey, shown) => {
      const page = render(
        <PrivacyEnableContent
          networkId="xmr--0"
          accountId={accountId}
          deviceExportsViewKey={deviceExportsViewKey}
          formRef={createPrivacyEnableForm({})}
        />,
      );
      expect(
        !!page.queryByText(ETranslations.privacy_enable_device_view_key__msg),
      ).toBe(shown);
    },
  );

  it.each(networks)(
    'defaults $networkId to today without a creation hint',
    ({ networkId, earliestBirthday }) => {
      const formRef = createPrivacyEnableForm({ earliestBirthday });
      const page = render(
        <PrivacyEnableContent
          accountId="hd-1--0"
          networkId={networkId}
          formRef={formRef}
          earliestBirthday={earliestBirthday}
        />,
      );
      expect(
        readEnableBirthday(formRef.current, earliestBirthday, networkId),
      ).toEqual({
        birthdayTimestamp: today,
      });
      expect(formRef.current.startChoice).toBe('today');
      expect(formRef.current.fromEarliest).not.toBe(true);
      const summary = page.getByTestId(
        'privacy-enable-start-summary',
      ).textContent;
      expect(summary).toContain(
        ETranslationsMock.privacy_sync_start_new__title,
      );
      expect(summary).not.toMatch(/\d/);
      fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
      const editor = render(mockDialog.mock.calls[0][0].renderContent);
      expect(
        (
          editor.getByTestId(
            'privacy-sync-start-choice-today',
          ) as HTMLInputElement
        ).checked,
      ).toBe(true);
      expect(editor.queryByTestId('privacy-start-date')).toBeNull();
      expect(
        editor.queryByTestId('privacy-sync-start-choice-recommended'),
      ).toBeNull();
    },
  );

  it.each(networks)(
    'keeps $networkId on today when an older creation hint exists',
    ({ networkId, earliestBirthday }) => {
      const hint = new Date(2026, 9, 12).getTime();
      const formRef = createPrivacyEnableForm({ earliestBirthday });
      const page = render(
        <PrivacyEnableContent
          accountId="hd-1--0"
          networkId={networkId}
          formRef={formRef}
          earliestBirthday={earliestBirthday}
          birthdayHintTimestamp={hint}
        />,
      );
      expect(
        readEnableBirthday(formRef.current, earliestBirthday, networkId),
      ).toEqual({
        birthdayTimestamp: today,
      });
      fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
      const editor = render(mockDialog.mock.calls[0][0].renderContent);
      expect(
        (
          editor.getByTestId(
            'privacy-sync-start-choice-today',
          ) as HTMLInputElement
        ).checked,
      ).toBe(true);
      fireEvent.click(editor.getByTestId('privacy-sync-start-choice-date'));
      expect(
        (editor.getByTestId('privacy-start-date') as HTMLInputElement).value,
      ).toBe(String(hint));
      expect(formRef.current.date?.getTime()).toBe(today);
    },
  );

  it('discards a cancelled date draft without changing the enable request', () => {
    const formRef = createPrivacyEnableForm({ earliestBirthday: earliest });
    const page = render(
      <PrivacyEnableContent
        accountId="hd-1--0"
        networkId="zec--0"
        formRef={formRef}
        earliestBirthday={earliest}
      />,
    );
    fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
    const editor = render(mockDialog.mock.calls[0][0].renderContent);
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-date'));
    fireEvent.change(editor.getByTestId('privacy-start-date'), {
      target: { value: String(new Date(2026, 9, 12).getTime()) },
    });
    editor.unmount();
    expect(readEnableBirthday(formRef.current, earliest, 'zec--0')).toEqual({
      birthdayTimestamp: today,
    });
    expect(formRef.current.startChoice).toBe('today');
    fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
    const reopened = render(mockDialog.mock.calls[1][0].renderContent);
    expect(
      (
        reopened.getByTestId(
          'privacy-sync-start-choice-today',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('saves a chosen date and updates the summary', () => {
    const formRef = createPrivacyEnableForm({ earliestBirthday: earliest });
    const page = render(
      <PrivacyEnableContent
        accountId="hd-1--0"
        networkId="zec--0"
        formRef={formRef}
        earliestBirthday={earliest}
      />,
    );
    expect(page.queryByTestId('privacy-start-date')).toBeNull();
    fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
    const options = mockDialog.mock.calls[0][0];
    const editor = render(options.renderContent);
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-date'));
    const next = new Date(2026, 9, 12).getTime();
    fireEvent.change(editor.getByTestId('privacy-start-date'), {
      target: { value: String(next) },
    });
    expect(formRef.current.date?.getTime()).toBe(today);
    fireEvent.click(editor.getByTestId('privacy-start-save'));
    expect(formRef.current.startChoice).toBe('date');
    expect(readEnableBirthday(formRef.current, earliest, 'zec--0')).toEqual({
      birthdayTimestamp: next,
    });
    const summary = page.getByTestId(
      'privacy-enable-start-summary',
    ).textContent;
    expect(summary).toContain(ETranslationsMock.privacy_sync_start_used__title);
    expect(summary).not.toMatch(/\d/);
  });

  it.each(networks)(
    'uses the exact supported floor when $networkId starts from the beginning',
    ({ networkId, earliestBirthday }) => {
      const formRef = createPrivacyEnableForm({ earliestBirthday });
      const page = render(
        <PrivacyEnableContent
          accountId="hd-1--0"
          networkId={networkId}
          formRef={formRef}
          earliestBirthday={earliestBirthday}
        />,
      );
      fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
      const options = mockDialog.mock.calls[0][0];
      const editor = render(options.renderContent);
      fireEvent.click(editor.getByTestId('privacy-sync-start-choice-earliest'));
      fireEvent.click(editor.getByTestId('privacy-start-save'));
      expect(formRef.current.startChoice).toBe('earliest');
      expect(
        readEnableBirthday(formRef.current, earliestBirthday, networkId),
      ).toEqual({
        birthdayHeight: earliestBirthday.height,
      });
      const summary = page.getByTestId(
        'privacy-enable-start-summary',
      ).textContent;
      expect(summary).toContain(
        ETranslationsMock.privacy_sync_start_unknown__title,
      );
      expect(summary).not.toMatch(/\d/);
    },
  );

  it('restores today without losing the custom date while switching choices', () => {
    const formRef = createPrivacyEnableForm({ earliestBirthday: earliest });
    const page = render(
      <PrivacyEnableContent
        accountId="hd-1--0"
        networkId="zec--0"
        formRef={formRef}
        earliestBirthday={earliest}
      />,
    );
    fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
    const options = mockDialog.mock.calls[0][0];
    const editor = render(options.renderContent);
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-date'));
    const customDate = new Date(2026, 9, 12).getTime();
    fireEvent.change(editor.getByTestId('privacy-start-date'), {
      target: { value: String(customDate) },
    });
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-today'));
    expect(editor.queryByTestId('privacy-start-date')).toBeNull();
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-date'));
    expect(
      (editor.getByTestId('privacy-start-date') as HTMLInputElement).value,
    ).toBe(String(customDate));
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-today'));
    fireEvent.click(editor.getByTestId('privacy-start-save'));
    expect(formRef.current.startChoice).toBe('today');
    expect(readEnableBirthday(formRef.current, earliest, 'zec--0')).toEqual({
      birthdayTimestamp: today,
    });
  });

  it.each(networks)(
    'shows the $networkId height minimum and accepts its exact boundary',
    ({ networkId, earliestBirthday }) => {
      const formRef = createPrivacyEnableForm({ earliestBirthday });
      const page = render(
        <PrivacyEnableContent
          accountId="hd-1--0"
          networkId={networkId}
          formRef={formRef}
          earliestBirthday={earliestBirthday}
        />,
      );
      fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
      const editor = render(mockDialog.mock.calls[0][0].renderContent);
      expect(
        editor.queryByTestId('privacy-sync-start-choice-height'),
      ).toBeNull();
      fireEvent.click(editor.getByTestId('privacy-sync-start-advanced'));
      fireEvent.click(editor.getByTestId('privacy-sync-start-choice-height'));
      const input = editor.getByTestId('privacy-sync-start-height');
      expect(input.getAttribute('placeholder')).toContain(
        String(earliestBirthday.height),
      );
      expect(
        editor.queryByTestId('privacy-sync-start-height-error'),
      ).toBeNull();
      fireEvent.change(input, {
        target: { value: String(earliestBirthday.height - 1) },
      });
      expect(
        editor.queryByTestId('privacy-sync-start-height-error'),
      ).toBeNull();
      fireEvent.blur(input);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(
        editor.getByTestId('privacy-sync-start-height-error').textContent,
      ).toBe(
        `${ETranslations.global_block_height} ≥ ${earliestBirthday.height}`,
      );
      fireEvent.click(editor.getByTestId('privacy-start-save'));
      expect(mockPreventClose).toHaveBeenCalledTimes(1);
      expect(mockToast).not.toHaveBeenCalled();
      expect(formRef.current.startChoice).toBe('today');
      expect(
        readEnableBirthday(formRef.current, earliestBirthday, networkId),
      ).toEqual({
        birthdayTimestamp: today,
      });
      fireEvent.change(input, {
        target: { value: String(earliestBirthday.height) },
      });
      expect(input.getAttribute('aria-invalid')).toBe('false');
      expect(
        editor.queryByTestId('privacy-sync-start-height-error'),
      ).toBeNull();
      fireEvent.click(editor.getByTestId('privacy-start-save'));
      expect(mockPreventClose).toHaveBeenCalledTimes(1);
      expect(formRef.current.startChoice).toBe('height');
      expect(
        readEnableBirthday(formRef.current, earliestBirthday, networkId),
      ).toEqual({
        birthdayHeight: earliestBirthday.height,
      });
      const summary = page.getByTestId(
        'privacy-enable-start-summary',
      ).textContent;
      expect(summary).toContain(ETranslations.global_block_height);
      expect(summary).not.toMatch(/\d/);
    },
  );

  it.each([
    '',
    ' ',
    '-1',
    '3428143.5',
    'abc',
    '4294967296',
    '9007199254740992',
  ])(
    'rejects height %p on Save without relying on blur and clears the error after correction',
    (height) => {
      const formRef = createPrivacyEnableForm({ earliestBirthday: earliest });
      const page = render(
        <PrivacyEnableContent
          accountId="hd-1--0"
          networkId="zec--0"
          formRef={formRef}
          earliestBirthday={earliest}
        />,
      );
      fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
      const editor = render(mockDialog.mock.calls[0][0].renderContent);
      fireEvent.click(editor.getByTestId('privacy-sync-start-advanced'));
      fireEvent.click(editor.getByTestId('privacy-sync-start-choice-height'));
      const input = editor.getByTestId('privacy-sync-start-height');
      fireEvent.change(input, { target: { value: height } });
      expect(
        editor.queryByTestId('privacy-sync-start-height-error'),
      ).toBeNull();
      fireEvent.click(editor.getByTestId('privacy-start-save'));
      expect(mockPreventClose).toHaveBeenCalledTimes(1);
      expect(mockToast).not.toHaveBeenCalled();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(
        editor.getByTestId('privacy-sync-start-height-error').textContent,
      ).toBe(ETranslationsMock.privacy_sync_start_height_invalid__msg);
      expect(formRef.current.startChoice).toBe('today');
      expect(readEnableBirthday(formRef.current, earliest, 'zec--0')).toEqual({
        birthdayTimestamp: today,
      });
      fireEvent.change(input, { target: { value: '3500000' } });
      expect(input.getAttribute('aria-invalid')).toBe('false');
      expect(
        editor.queryByTestId('privacy-sync-start-height-error'),
      ).toBeNull();
      fireEvent.click(editor.getByTestId('privacy-start-save'));
      expect(mockPreventClose).toHaveBeenCalledTimes(1);
      expect(readEnableBirthday(formRef.current, earliest, 'zec--0')).toEqual({
        birthdayHeight: 3_500_000,
      });
    },
  );

  it('rejects heights beyond the chain tip after switching choices and accepts the tip', () => {
    mockChainTip = 3_500_000;
    const formRef = createPrivacyEnableForm({ earliestBirthday: earliest });
    const page = render(
      <PrivacyEnableContent
        networkId="zec--0"
        accountId="hd-1--0"
        formRef={formRef}
        earliestBirthday={earliest}
      />,
    );
    fireEvent.click(page.getByTestId('privacy-enable-edit-start'));
    const editor = render(mockDialog.mock.calls[0][0].renderContent);
    fireEvent.click(editor.getByTestId('privacy-sync-start-advanced'));
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-height'));
    fireEvent.change(editor.getByTestId('privacy-sync-start-height'), {
      target: { value: '3500001' },
    });
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-today'));
    fireEvent.click(editor.getByTestId('privacy-sync-start-choice-height'));
    fireEvent.click(editor.getByTestId('privacy-start-save'));
    expect(mockPreventClose).toHaveBeenCalledTimes(1);
    expect(formRef.current.startChoice).toBe('today');
    expect(
      editor.getByTestId('privacy-sync-start-height-error').textContent,
    ).toBe(`${ETranslations.global_block_height} ≤ 3500000`);

    fireEvent.change(editor.getByTestId('privacy-sync-start-height'), {
      target: { value: '3500000' },
    });
    fireEvent.click(editor.getByTestId('privacy-start-save'));
    expect(mockPreventClose).toHaveBeenCalledTimes(1);
    expect(formRef.current.maxHeight).toBe(3_500_000);
    expect(readEnableBirthday(formRef.current, earliest, 'zec--0')).toEqual({
      birthdayHeight: 3_500_000,
    });
  });
});
