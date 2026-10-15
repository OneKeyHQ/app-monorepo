/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { createPromiseTarget } from '@onekeyhq/shared/src/utils/promiseUtils';
import { createTradingViewNativeIndicatorSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  createTradingViewNativeIndicatorSettingsValue,
  getTradingViewNativeIndicatorSettings,
  getTradingViewNativeIndicatorSettingsValue,
} from './indicatorSettingsAdapter';
import { TradingViewMobileIndicatorEditor } from './TradingViewMobileIndicatorEditor';
import TradingViewMobileIndicatorSettingsPage from './TradingViewMobileIndicatorSettingsPage';

import type { ITradingViewNativeStorageNamespace } from './types';
import type { ITradingViewIndicatorSettingsItem } from '../TradingViewChartControls/chartSettings';

const mockPagePop = jest.fn();
const mockPageSetSettings = jest.fn();
const mockPageSettings = createTradingViewNativeIndicatorSettings();
let mockPageNamespace: ITradingViewNativeStorageNamespace = 'market';

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({
    params: { storageNamespace: mockPageNamespace, indicatorId: 'MA' },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPagePop }),
}));
jest.mock('./useTradingViewNativeSettings', () => ({
  useTradingViewNativeIndicatorSettings: () => [
    mockPageSettings,
    mockPageSetSettings,
  ],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSwapTradingViewIndicatorSettingsPersistAtom: () => [
    mockPageSettings,
    mockPageSetSettings,
  ],
}));

type IMockProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => {
  const View = ({ children, testID }: IMockProps) => (
    <div data-testid={testID}>{children}</div>
  );
  const Button = ({
    children,
    testID,
    onPress,
    disabled,
    loading,
  }: IMockProps) => (
    <button
      type="button"
      data-testid={testID}
      disabled={disabled || loading}
      onClick={onPress}
    >
      {children}
    </button>
  );
  return {
    Button,
    IconButton: Button,
    Page: Object.assign(View, { Header: () => null, Body: View, Footer: View }),
    SizableText: View,
    Stack: View,
    XStack: View,
    YStack: View,
    Divider: () => null,
    Keyboard: { dismiss: jest.fn() },
    Toast: { error: jest.fn() },
    Checkbox: ({
      value,
      onChange,
      testID,
    }: {
      value: boolean;
      onChange: (value: boolean) => void;
      testID: string;
    }) => (
      <input
        type="checkbox"
        data-testid={testID}
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
      />
    ),
    ColorPicker: ({
      onChange,
      testID,
    }: {
      onChange: (value: string) => void;
      testID: string;
    }) => (
      <button
        type="button"
        data-testid={testID}
        onClick={() => onChange('#abcdef')}
      >
        Color
      </button>
    ),
    SegmentSlider: () => null,
    Input: ({
      value,
      onChangeText,
      onBlur,
      testID,
    }: {
      value: string;
      onChangeText: (value: string) => void;
      onBlur: () => void;
      testID: string;
    }) => (
      <input
        data-testid={testID}
        value={value}
        onChange={(event) => onChangeText(event.target.value)}
        onBlur={onBlur}
      />
    ),
  };
});

function getIndicator(id: string) {
  const indicator =
    createTradingViewNativeIndicatorSettingsValue().indicators.find(
      (item) => item.id === id,
    );
  if (!indicator) {
    throw new OneKeyLocalError(`Missing indicator ${id}`);
  }
  return indicator;
}

function renderEditor(id: string, onSave = jest.fn(), onClose = jest.fn()) {
  const indicator = getIndicator(id);
  return {
    ...render(
      <TradingViewMobileIndicatorEditor
        indicator={indicator}
        defaultIndicator={indicator}
        onSave={onSave}
        onClose={onClose}
      />,
    ),
    indicator,
    onSave,
    onClose,
  };
}

describe('TradingViewMobileIndicatorEditor', () => {
  it('saves the focused numeric text together with curve visibility, color and width', async () => {
    const { onSave, onClose } = renderEditor('MA');
    fireEvent.change(
      screen.getByTestId('mobile-indicator-number-line:line:0'),
      { target: { value: '27' } },
    );
    fireEvent.click(screen.getByTestId('mobile-indicator-enabled-line:0'));
    fireEvent.click(screen.getByTestId('mobile-indicator-color-line:0'));
    fireEvent.click(screen.getByTestId('mobile-indicator-advanced'));
    fireEvent.click(screen.getByTestId('mobile-indicator-style-line:0-bold'));
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({
            id: 'line:0',
            period: 27,
            enabled: false,
            color: '#abcdef',
            style: 'bold',
          }),
        ]),
      }),
    );
  });

  it('steps fractional SAR values and saves without a blur event', async () => {
    const { onSave, onClose } = renderEditor('SAR');
    fireEvent.click(
      screen.getByTestId(
        'mobile-indicator-number-parameter:accelerationStep-increment',
      ),
    );
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: expect.arrayContaining([
          expect.objectContaining({ id: 'accelerationStep', value: 0.03 }),
        ]),
      }),
    );
  });

  it.each(['RSI', 'BOLL'])(
    'saves and reopens %s fractional periods as integers and keeps integer steps',
    async (id) => {
      const catalog = createTradingViewNativeIndicatorSettingsValue();
      let settings = createTradingViewNativeIndicatorSettings();
      const onSave = jest.fn((next: ITradingViewIndicatorSettingsItem) => {
        settings = getTradingViewNativeIndicatorSettings({
          ...catalog,
          indicators: catalog.indicators.map((indicator) =>
            indicator.id === id ? next : indicator,
          ),
        });
      });
      const { unmount, onClose, indicator } = renderEditor(id, onSave);
      const inputId = 'mobile-indicator-number-parameter:period';
      fireEvent.change(screen.getByTestId(inputId), {
        target: { value: '14.5' },
      });
      fireEvent.click(screen.getByTestId('mobile-indicator-save'));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          parameters: expect.arrayContaining([
            expect.objectContaining({ id: 'period', value: 15 }),
          ]),
        }),
      );
      unmount();

      const restored = getTradingViewNativeIndicatorSettingsValue(
        settings,
      ).indicators.find((item) => item.id === id);
      if (!restored) {
        throw new OneKeyLocalError(`Missing saved indicator ${id}`);
      }
      render(
        <TradingViewMobileIndicatorEditor
          indicator={restored}
          defaultIndicator={indicator}
          onSave={onSave}
          onClose={onClose}
        />,
      );
      const input = screen.getByTestId(inputId) as HTMLInputElement;
      expect(input.value).toBe('15');
      fireEvent.change(input, { target: { value: '14.5' } });
      fireEvent.click(screen.getByTestId(`${inputId}-increment`));
      expect(input.value).toBe('16');
      fireEvent.click(screen.getByTestId('mobile-indicator-save'));
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
      expect(onSave).toHaveBeenLastCalledWith(
        expect.objectContaining({
          parameters: expect.arrayContaining([
            expect.objectContaining({ id: 'period', value: 16 }),
          ]),
        }),
      );
    },
  );

  it('preserves existing fractional band thresholds when saving a color change', async () => {
    const defaultIndicator = getIndicator('RSI');
    const indicator = {
      ...defaultIndicator,
      parameters: defaultIndicator.parameters?.map((parameter) =>
        parameter.id === 'band:upper'
          ? { ...parameter, value: 70.5 }
          : parameter,
      ),
    };
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(
      <TradingViewMobileIndicatorEditor
        indicator={indicator}
        defaultIndicator={defaultIndicator}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('mobile-indicator-color-plot:rsi'));
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      ...indicator,
      lines: indicator.lines.map((line) =>
        line.id === 'plot:rsi' ? { ...line, color: '#abcdef' } : line,
      ),
    });
  });

  it('steps from an entered fractional threshold without rounding it', async () => {
    const { onSave, onClose } = renderEditor('WR');
    const input = screen.getByTestId(
      'mobile-indicator-number-parameter:band:upper',
    );
    fireEvent.change(input, { target: { value: '-20.5' } });
    fireEvent.click(
      screen.getByTestId(
        'mobile-indicator-number-parameter:band:upper-increment',
      ),
    );
    expect((input as HTMLInputElement).value).toBe('-19.5');
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: expect.arrayContaining([
          expect.objectContaining({ id: 'band:upper', value: -19.5 }),
        ]),
      }),
    );
  });

  it('resets only the draft and ignores the previous input when blur follows reset', async () => {
    const { onSave, onClose, indicator } = renderEditor('BOLL');
    const input = screen.getByTestId(
      'mobile-indicator-number-parameter:period',
    );
    fireEvent.change(input, { target: { value: '45' } });
    fireEvent.click(screen.getByTestId('mobile-indicator-reset'));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe('20');
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(indicator);
  });

  it('discards edits when leaving without Save', () => {
    const { unmount, onSave, indicator } = renderEditor('MA');
    fireEvent.change(
      screen.getByTestId('mobile-indicator-number-line:line:0'),
      { target: { value: '90' } },
    );
    fireEvent.click(screen.getByTestId('mobile-indicator-color-line:0'));
    unmount();
    expect(onSave).not.toHaveBeenCalled();
    expect(indicator).toEqual(getIndicator('MA'));
  });

  it('retains the draft on save failure and allows retry', async () => {
    const onSave = jest
      .fn()
      .mockRejectedValueOnce(new OneKeyLocalError('Save failed'))
      .mockResolvedValueOnce(undefined);
    const onClose = jest.fn();
    renderEditor('MA', onSave, onClose);
    fireEvent.change(
      screen.getByTestId('mobile-indicator-number-line:line:0'),
      { target: { value: '31' } },
    );
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() => expect(Toast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
    expect(
      (
        screen.getByTestId(
          'mobile-indicator-number-line:line:0',
        ) as HTMLInputElement
      ).value,
    ).toBe('31');
    fireEvent.click(screen.getByTestId('mobile-indicator-save'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});

describe.each(['market', 'swap', 'perps'] as const)(
  '%s mobile indicator settings page persistence',
  (storageNamespace) => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockPageSetSettings.mockReset();
      mockPageNamespace = storageNamespace;
    });

    it('keeps the editor open until the settings setter resolves', async () => {
      const pending = createPromiseTarget<void>();
      mockPageSetSettings.mockReturnValue(pending.ready);
      render(<TradingViewMobileIndicatorSettingsPage />);
      await act(async () => {
        fireEvent.click(screen.getByTestId('mobile-indicator-save'));
      });
      expect(mockPageSetSettings).toHaveBeenCalledTimes(1);
      expect(mockPagePop).not.toHaveBeenCalled();
      expect(
        (screen.getByTestId('mobile-indicator-save') as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      await act(async () => {
        pending.resolveTarget(undefined);
        await pending.ready;
      });
      expect(mockPagePop).toHaveBeenCalledTimes(1);
    });

    it('keeps the draft and permits retry when the settings setter rejects', async () => {
      const pending = createPromiseTarget<void>();
      mockPageSetSettings
        .mockReturnValueOnce(pending.ready)
        .mockResolvedValueOnce(undefined);
      render(<TradingViewMobileIndicatorSettingsPage />);
      const input = screen.getByTestId('mobile-indicator-number-line:line:0');
      fireEvent.change(input, { target: { value: '31' } });
      await act(async () => {
        fireEvent.click(screen.getByTestId('mobile-indicator-save'));
      });
      expect(mockPagePop).not.toHaveBeenCalled();
      await act(async () => {
        pending.rejectTarget(new OneKeyLocalError('Persistence failed'));
        await expect(pending.ready).rejects.toThrow('Persistence failed');
      });
      expect(Toast.error).toHaveBeenCalledTimes(1);
      expect(mockPagePop).not.toHaveBeenCalled();
      expect((input as HTMLInputElement).value).toBe('31');
      fireEvent.click(screen.getByTestId('mobile-indicator-save'));
      await waitFor(() => expect(mockPagePop).toHaveBeenCalledTimes(1));
      expect(mockPageSetSettings).toHaveBeenCalledTimes(2);
    });
  },
);
