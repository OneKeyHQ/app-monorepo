/** @jest-environment jsdom */
import { createContext, useContext } from 'react';
import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntlProvider } from 'react-intl';

import enMessages from '@onekeyhq/shared/src/locale/json/en_US.json';

import SetTpslModal from './SetTpslModal';

const messages: Record<string, string> = enMessages;
const mockAccountAddress = '0x1111111111111111111111111111111111111111';
const mockMidPrice = createContext('1830');
const mockSetPositionTpsl = jest.fn();

function mockContainer({ children }: PropsWithChildren) {
  return children;
}

jest.mock('@onekeyhq/components', () => ({
  Page: Object.assign(mockContainer, {
    Header: () => null,
    Body: mockContainer,
    Footer: mockContainer,
  }),
  XStack: mockContainer,
  YStack: mockContainer,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Divider: () => null,
  Checkbox: () => null,
  getFontSize: () => 16,
  useMedia: () => ({ gtMd: true }),
  Button: ({
    children,
    disabled,
    onPress,
  }: PropsWithChildren<{ disabled?: boolean; onPress?: () => void }>) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {children}
    </button>
  ),
  Input: ({
    value,
    placeholder,
    onChangeText,
  }: {
    value: string;
    placeholder: string;
    onChangeText: (text: string) => void;
  }) => (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));
jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: { coin: 'ETH', assetId: 1, szDecimals: 4 } }),
  useNavigation: () => ({ goBack: jest.fn() }),
}));
jest.mock(
  '@onekeyhq/kit/src/background/instance/backgroundApiProxy',
  () => ({}),
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: { setPositionTpsl: mockSetPositionTpsl },
  }),
  usePerpsActiveOpenOrdersAtom: () => [
    { accountAddress: mockAccountAddress, openOrdersByCoin: {} },
  ],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: mockAccountAddress }],
}));
jest.mock('../../hooks/usePerpsAccountScopedCacheAddress', () => ({
  usePerpsAccountScopedCacheAddress: () => mockAccountAddress,
}));
jest.mock('../../hooks/usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedActivePositions: () => [
    {
      position: {
        coin: 'ETH',
        entryPx: '1830',
        szi: '1',
        leverage: { value: 22 },
      },
    },
  ],
}));
jest.mock('../../hooks/usePerpsMidPrice', () => ({
  usePerpsMidPrice: () => ({ mid: useContext(mockMidPrice) }),
}));
jest.mock('../../hooks/useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => jest.fn(),
}));
jest.mock('../../PerpsAccountSelectorProviderMirror', () => ({
  PerpsAccountSelectorProviderMirror: mockContainer,
}));
jest.mock('../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: mockContainer,
}));
jest.mock('../TradingGuardWrapper', () => ({
  TradingGuardWrapper: mockContainer,
}));
jest.mock('../TradingPanel/inputs/TradingFormInput', () => ({}));
jest.mock('../PerpsSlider', () => ({}));

function modalAtMid(mid: string) {
  return (
    <IntlProvider locale="en" messages={messages}>
      <mockMidPrice.Provider value={mid}>
        <SetTpslModal />
      </mockMidPrice.Provider>
    </IntlProvider>
  );
}

describe('position TP/SL confirmation', () => {
  beforeEach(() => {
    mockSetPositionTpsl.mockClear();
  });

  it.each([
    ['1850', 'TP trigger price must be above the mid price'],
    ['1801.9', 'SL trigger price must be below the mid price'],
  ])(
    'blocks submission when the mid moves to %s past a trigger',
    (mid, error) => {
      const { rerender } = render(modalAtMid('1830'));
      fireEvent.click(screen.getByRole('button', { name: '+10%' }));
      fireEvent.click(screen.getByRole('button', { name: '-10%' }));
      const confirm = screen.getByRole('button', { name: 'Confirm Order' });
      expect(confirm.hasAttribute('disabled')).toBe(false);

      rerender(modalAtMid(mid));
      expect(screen.getByText(error)).toBeTruthy();
      expect(confirm.hasAttribute('disabled')).toBe(true);
      fireEvent.click(confirm);
      expect(mockSetPositionTpsl).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      leg: 'TP',
      preset: '+10%',
      emptyField: 'SL Price',
      tpTriggerPx: '1838.3',
      slTriggerPx: undefined,
    },
    {
      leg: 'SL',
      preset: '-10%',
      emptyField: 'TP Price',
      tpTriggerPx: undefined,
      slTriggerPx: '1821.7',
    },
  ])(
    'submits only the $leg trigger',
    async ({ preset, emptyField, tpTriggerPx, slTriggerPx }) => {
      render(modalAtMid('1830'));
      const confirm = screen.getByRole('button', { name: 'Confirm Order' });
      expect(confirm.hasAttribute('disabled')).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: preset }));
      expect(
        screen.getByPlaceholderText<HTMLInputElement>(emptyField).value,
      ).toBe('');
      expect(confirm.hasAttribute('disabled')).toBe(false);
      fireEvent.click(confirm);
      await waitFor(() => expect(mockSetPositionTpsl).toHaveBeenCalledTimes(1));
      expect(mockSetPositionTpsl).toHaveBeenCalledWith({
        assetId: 1,
        expectedAccountAddress: mockAccountAddress,
        isBuy: true,
        positionSize: '0',
        tpTriggerPx,
        slTriggerPx,
      });
    },
  );
});
