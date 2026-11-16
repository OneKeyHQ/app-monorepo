/** @jest-environment jsdom */
/* eslint-disable import/first */

import type { ReactNode } from 'react';
import { useContext, useMemo } from 'react';

import { render } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAmountInputMode,
  EBulkSendMode,
  type IAmountInputError,
} from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

// Jest maps every `@onekeyhq/components*` import to one module (see
// moduleNameMapper), so the real hook is loaded by its relative path.
jest.mock('@onekeyhq/components', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { useUpdateEffect } = jest.requireActual<
    typeof import('../../../../../../../components/src/hooks/useUpdateEffect')
  >('../../../../../../../components/src/hooks/useUpdateEffect');
  const box = ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children);
  const empty = () => null;
  return {
    Input: empty,
    NumberSizeableText: empty,
    SegmentControl: empty,
    SizableText: box,
    Stack: box,
    XStack: box,
    YStack: box,
    getSharedInputStyles: () => ({}),
    useUpdateEffect,
  };
});
jest.mock('@onekeyhq/kit/src/components/AmountInput', () => ({
  AmountInput: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAccountData', () => ({
  useAccountData: () => ({ network: undefined }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { symbol: '$' } }],
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: Record<string, string | number>,
    ) => (values ? `${id}:${JSON.stringify(values)}` : id),
  }),
}));

import { RangeAmountInput } from './AmountInput';
import {
  BulkSendAmountsInputContext,
  type IBulkSendAmountsInputContext,
  type IPreviewState,
} from './Context';

const tokenInfo = {
  address: '',
  decimals: 8,
  isNative: true,
  name: 'Dogecoin',
  symbol: 'DOGE',
} as IToken;

const transfersInfo = [
  { from: 'sender1', to: 'receiver1', amount: '' },
  { from: 'sender2', to: 'receiver2', amount: '' },
] as ITransferInfo[];

function Harness({
  overrides,
}: {
  overrides: Partial<IBulkSendAmountsInputContext>;
}) {
  // Outside a provider this reads the context's default value.
  const defaults = useContext(BulkSendAmountsInputContext);
  const value = useMemo(
    () => ({ ...defaults, ...overrides }),
    [defaults, overrides],
  );
  return (
    <BulkSendAmountsInputContext.Provider value={value}>
      <RangeAmountInput />
    </BulkSendAmountsInputContext.Provider>
  );
}

// Mounts the range input with only the max entered while the vault settings
// are still loading, which the page reports as a minimum of '0'.
function renderBeforeVaultSettingsLoad(rangeMax: string) {
  let previewState: IPreviewState = {
    specifiedPreviewed: false,
    rangePreviewed: true,
    rangePreviewAmounts: [],
  };
  let amountInputErrors: IAmountInputError = {};

  const setPreviewState = jest.fn(
    (update: React.SetStateAction<IPreviewState>) => {
      previewState =
        typeof update === 'function' ? update(previewState) : update;
    },
  );
  const setAmountInputErrors = jest.fn((errors: IAmountInputError) => {
    amountInputErrors = errors;
  });

  const buildOverrides = (
    minTransferAmount: string,
  ): Partial<IBulkSendAmountsInputContext> => ({
    tokenInfo,
    transfersInfo,
    bulkSendMode: EBulkSendMode.ManyToMany,
    amountInputMode: EAmountInputMode.Range,
    amountInputValues: { specifiedAmount: '', rangeMin: '', rangeMax },
    amountInputErrors,
    setAmountInputErrors,
    setPreviewState,
    minTransferAmount,
  });

  const view = render(<Harness overrides={buildOverrides('0')} />);

  return {
    setPreviewState,
    getPreviewState: () => previewState,
    getAmountInputErrors: () => amountInputErrors,
    loadMinTransferAmount: (minTransferAmount: string) =>
      view.rerender(<Harness overrides={buildOverrides(minTransferAmount)} />),
  };
}

describe('RangeAmountInput', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The chain minimum arrives with the vault settings, after the page mounts.
  // Amounts generated before that sit on the smallest token unit.
  it('regenerates the amounts when the chain minimum loads', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const view = renderBeforeVaultSettingsLoad('1');

    expect(view.getPreviewState().rangePreviewAmounts).toEqual([
      '0.00000001',
      '0.00000001',
    ]);

    view.loadMinTransferAmount('0.01');

    const { rangePreviewAmounts, rangePreviewed } = view.getPreviewState();
    expect(rangePreviewAmounts).toHaveLength(2);
    rangePreviewAmounts.forEach((amount) => {
      expect(new BigNumber(amount).isEqualTo('0.01')).toBe(true);
    });
    // Transfers filled from the older preview have to be previewed again.
    expect(rangePreviewed).toBe(false);
    expect(view.getAmountInputErrors().rangeError).toBeUndefined();
  });

  it('reports a max that falls below the chain minimum once it loads', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const view = renderBeforeVaultSettingsLoad('0.005');

    expect(view.getPreviewState().rangePreviewAmounts).toHaveLength(2);
    expect(view.getAmountInputErrors().rangeError).toBeUndefined();

    view.loadMinTransferAmount('0.01');

    expect(view.getAmountInputErrors().rangeError).toBe(
      `${ETranslations.send_error_minimum_amount}:${JSON.stringify({
        amount: '0.01',
        token: 'DOGE',
      })}`,
    );
    expect(view.getPreviewState().rangePreviewAmounts).toEqual([]);
    expect(view.getPreviewState().rangePreviewed).toBe(false);
  });

  it('keeps the generated amounts while the chain minimum is unchanged', () => {
    const view = renderBeforeVaultSettingsLoad('1');
    const callsAfterMount = view.setPreviewState.mock.calls.length;

    view.loadMinTransferAmount('0');

    expect(view.setPreviewState).toHaveBeenCalledTimes(callsAfterMount);
  });
});
