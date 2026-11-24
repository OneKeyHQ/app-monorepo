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
    Button: empty,
    Icon: empty,
    IconButton: empty,
    Input: empty,
    NumberSizeableText: empty,
    Select: empty,
    SizableText: box,
    Skeleton: { BodySm: empty },
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
jest.mock('../../../components/IntervalSettingsContent', () => ({
  IntervalRangeInputs: () => null,
  useIntervalLabels: () => ({
    title: '',
    specifiedLabel: '',
    noneLabel: '',
    maxSecPlaceholder: '',
  }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: Record<string, string | number>,
    ) => (values ? `${id}:${JSON.stringify(values)}` : id),
  }),
}));

import {
  BulkSendAmountsInputContext,
  type IBulkSendAmountsInputContext,
} from './Context';
import TableLayout from './TableLayout';

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
      <TableLayout />
    </BulkSendAmountsInputContext.Provider>
  );
}

// Mounts the table with only the range max entered while the vault settings
// are still loading, which the page reports as a minimum of '0'.
function renderBeforeVaultSettingsLoad({
  rangeMax,
  amountInputMode = EAmountInputMode.Range,
}: {
  rangeMax: string;
  amountInputMode?: EAmountInputMode;
}) {
  let amountInputErrors: IAmountInputError = {};
  const setAmountInputErrors = jest.fn((errors: IAmountInputError) => {
    amountInputErrors = errors;
  });
  const setTransfersInfo = jest.fn<void, [ITransferInfo[]]>();

  const buildOverrides = (
    minTransferAmount: string,
  ): Partial<IBulkSendAmountsInputContext> => ({
    tokenInfo,
    transfersInfo,
    setTransfersInfo,
    bulkSendMode: EBulkSendMode.ManyToMany,
    amountInputMode,
    amountInputValues: { specifiedAmount: '', rangeMin: '', rangeMax },
    amountInputErrors,
    setAmountInputErrors,
    minTransferAmount,
  });

  const view = render(<Harness overrides={buildOverrides('0')} />);

  return {
    setTransfersInfo,
    getAmountInputErrors: () => amountInputErrors,
    loadMinTransferAmount: (minTransferAmount: string) =>
      view.rerender(<Harness overrides={buildOverrides(minTransferAmount)} />),
  };
}

describe('TableLayout range amounts', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The chain minimum arrives with the vault settings, after the page mounts.
  // Transfers generated before that sit on the smallest token unit.
  it('regenerates the transfers when the chain minimum loads', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const view = renderBeforeVaultSettingsLoad({ rangeMax: '1' });

    view.loadMinTransferAmount('0.01');

    expect(view.setTransfersInfo).toHaveBeenCalledTimes(1);
    const [regenerated] = view.setTransfersInfo.mock.calls[0];
    expect(regenerated).toHaveLength(2);
    regenerated.forEach((transfer) => {
      expect(new BigNumber(transfer.amount).isEqualTo('0.01')).toBe(true);
    });
    expect(view.getAmountInputErrors().rangeError).toBeUndefined();
  });

  it('reports a max that falls below the chain minimum once it loads', () => {
    const view = renderBeforeVaultSettingsLoad({ rangeMax: '0.005' });

    view.loadMinTransferAmount('0.01');

    expect(view.getAmountInputErrors().rangeError).toBe(
      `${ETranslations.send_error_minimum_amount}:${JSON.stringify({
        amount: '0.01',
        token: 'DOGE',
      })}`,
    );
  });

  it('leaves the transfers alone while the chain minimum is unchanged', () => {
    const view = renderBeforeVaultSettingsLoad({ rangeMax: '1' });

    view.loadMinTransferAmount('0');

    expect(view.setTransfersInfo).not.toHaveBeenCalled();
  });

  it('leaves the transfers alone outside range mode', () => {
    const view = renderBeforeVaultSettingsLoad({
      rangeMax: '1',
      amountInputMode: EAmountInputMode.Specified,
    });

    view.loadMinTransferAmount('0.01');

    expect(view.setTransfersInfo).not.toHaveBeenCalled();
  });
});
