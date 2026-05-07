/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapSlippageSegmentKey } from '@onekeyhq/shared/types/swap/types';

import {
  EMarketPresetKey,
  EMarketPresetPriorityFeeType,
} from '../../hooks/marketPresetSettings';

import { MarketPresetSelector } from './MarketPresetSelector';

import type { IMarketPresetSettingsState } from '../../hooks/useMarketPresetSettings';

let mockMedia = { gtMd: false };

jest.mock('@onekeyhq/components', () => ({
  Button: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Dialog: {
    show: jest.fn(() => ({
      close: jest.fn(),
    })),
  },
  Divider: () => <span data-testid="divider" />,
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
  Input: () => <input />,
  SegmentControl: () => <div />,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  XStack: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
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

function createPresetSettings(): IMarketPresetSettingsState {
  return {
    enabled: true,
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
    priorityFeeUnit: '',
    onPresetChange: jest.fn(),
  } as unknown as IMarketPresetSettingsState;
}

describe('MarketPresetSelector', () => {
  beforeEach(() => {
    mockMedia = { gtMd: false };
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
});
