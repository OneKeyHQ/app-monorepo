/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  EMarketPresetPriorityFeeType,
} from '../../hooks/marketPresetSettings';

import { MarketPresetSelector } from './MarketPresetSelector';

import type { IMarketPresetSettingsState } from '../../hooks/useMarketPresetSettings';

let mockMedia = { gtMd: false };
type IDialogShowParams = {
  renderContent: ReactNode;
};
const mockDialogShow = jest.fn((_params: IDialogShowParams) => ({
  close: jest.fn(),
}));

jest.mock('@onekeyhq/components', () => ({
  Button: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={onPress} type="button">
      {children}
    </button>
  ),
  Dialog: {
    Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    show: (params: IDialogShowParams) => mockDialogShow(params),
  },
  Divider: () => <span data-testid="divider" />,
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
  Input: () => <input />,
  SegmentControl: () => <div data-testid="segment-control" />,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: (event: {
      preventDefault: () => void;
      stopPropagation: () => void;
    }) => void;
    testID?: string;
  }) =>
    onPress ? (
      <div
        data-testid={testID}
        onClick={onPress}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onPress(event);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {children}
      </div>
    ) : (
      <div data-testid={testID}>{children}</div>
    ),
  YStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
  useMedia: () => mockMedia,
}));

jest.mock('@onekeyhq/kit/src/components/NetworkAvatar', () => ({
  NetworkAvatar: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/SlippageSettingDialog', () => ({
  SlippageInput: () => null,
}));

jest.mock('@onekeyhq/kit/src/utils/validateAmountInput', () => ({
  validateAmountInput: () => true,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => {
      if (id === ETranslations.global_auto) {
        return 'Auto';
      }
      if (id === ETranslations.global_market) {
        return 'Market';
      }
      return id;
    },
  }),
}));

function createPresetSettings({
  onPresetChange = jest.fn(),
}: {
  onPresetChange?: jest.Mock;
} = {}): IMarketPresetSettingsState {
  return {
    enabled: true,
    config: {
      enabled: true,
      networkId: 'evm--1',
      defaultPresetKey: EMarketPresetKey.AUTO,
      presets: [{ key: EMarketPresetKey.AUTO }, { key: EMarketPresetKey.P1 }],
      slippage: {
        editable: true,
      },
      priorityFee: {
        editable: true,
        supportedTypes: [
          EMarketPresetPriorityFeeType.MARKET,
          EMarketPresetPriorityFeeType.FAST,
          EMarketPresetPriorityFeeType.CUSTOM,
        ],
        customUnit: 'Gwei',
      },
    },
    presets: [{ key: EMarketPresetKey.AUTO }, { key: EMarketPresetKey.P1 }],
    presetCustomizedMap: {},
    selectedPresetKey: EMarketPresetKey.AUTO,
    selectedPreset: { key: EMarketPresetKey.AUTO },
    selectedDirectionSettings: {
      slippage: {
        key: ESwapSlippageSegmentKey.AUTO,
      },
      priorityFee: {
        type: EMarketPresetPriorityFeeType.MARKET,
      },
    },
    selectedSlippageValue: 0.5,
    defaultSlippageValue: 0.5,
    priorityFeeUnit: '',
    selectedNetworkFeeLevel: 'medium',
    tradeSide: 'buy',
    onPresetChange,
    onResetPresetDirectionSettings: jest.fn(),
    onSavePresetDirectionSettings: jest.fn(),
    getDirectionSettings: jest.fn(),
    getSavedDirectionSettings: jest.fn(),
  } as unknown as IMarketPresetSettingsState;
}

describe('MarketPresetSelector', () => {
  beforeEach(() => {
    mockMedia = { gtMd: false };
    mockDialogShow.mockClear();
  });

  it('defaults to showing the resolved slippage value', () => {
    render(<MarketPresetSelector presetSettings={createPresetSettings()} />);

    expect(screen.getByText('0.5%')).toBeTruthy();
    expect(screen.getAllByText('Auto')).toHaveLength(1);
  });

  it('can show Auto for mobile Swap Pro auto slippage', () => {
    render(
      <MarketPresetSelector
        presetSettings={createPresetSettings()}
        showAutoSlippageLabel
      />,
    );

    expect(screen.queryByText('0.5%')).toBeNull();
    expect(screen.getAllByText('Auto')).toHaveLength(2);
  });

  it('keeps desktop on the resolved slippage value', () => {
    mockMedia = { gtMd: true };

    render(
      <MarketPresetSelector
        presetSettings={createPresetSettings()}
        showAutoSlippageLabel
      />,
    );

    expect(screen.getByText('0.5%')).toBeTruthy();
  });

  it('switches the preset directly from the mobile compact row', () => {
    const onPresetChange = jest.fn();

    render(
      <MarketPresetSelector
        presetSettings={createPresetSettings({ onPresetChange })}
      />,
    );

    fireEvent.click(screen.getByTestId('market-preset-quick-switch'));

    expect(onPresetChange).toHaveBeenCalledWith(EMarketPresetKey.P1);
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('uses the extracted full widget preset buttons when requested', () => {
    const onPresetChange = jest.fn();

    render(
      <MarketPresetSelector
        presetSettings={createPresetSettings({ onPresetChange })}
        variant="full"
      />,
    );

    expect(screen.getByTestId('market-preset-auto')).toBeTruthy();
    fireEvent.click(screen.getByTestId('market-preset-p1'));

    expect(onPresetChange).toHaveBeenCalledWith(EMarketPresetKey.P1);
    expect(mockDialogShow).not.toHaveBeenCalled();
  });

  it('uses underline tabs for preset switching in the settings dialog', () => {
    render(<MarketPresetSelector presetSettings={createPresetSettings()} />);

    fireEvent.click(screen.getByTestId('market-preset-settings-trigger'));

    expect(mockDialogShow).toHaveBeenCalledTimes(1);
    const [dialogParams] = mockDialogShow.mock.calls[0] ?? [];
    expect(dialogParams).toBeDefined();
    render(dialogParams?.renderContent as ReactElement);

    expect(screen.getByTestId('market-preset-dialog-tab-auto')).toBeTruthy();
    fireEvent.click(screen.getByTestId('market-preset-dialog-tab-p1'));

    expect(screen.getAllByTestId('segment-control')).toHaveLength(3);
  });
});
