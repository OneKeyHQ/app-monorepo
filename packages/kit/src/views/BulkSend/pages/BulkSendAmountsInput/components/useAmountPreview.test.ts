/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';
import type { IToken } from '@onekeyhq/shared/types/token';

import { useAmountPreview } from './useAmountPreview';

import type { IPreviewState } from './Context';

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

const previewState: IPreviewState = {
  specifiedPreviewed: false,
  rangePreviewed: false,
  rangePreviewAmounts: [],
};

describe('useAmountPreview', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // OK-66698: ManyToMany / ManyToOne range mode with only the max entered.
  it('fills range amounts from the chain minimum when min is empty', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const setTransfersInfo = jest.fn<void, [ITransferInfo[]]>();

    const { result } = renderHook(() =>
      useAmountPreview({
        tokenInfo,
        transfersInfo,
        setTransfersInfo,
        previewState,
        setPreviewState: jest.fn(),
        minTransferAmount: '0.01',
      }),
    );

    act(() => {
      result.current.updateTransfersInfoWithAmounts(EAmountInputMode.Range, {
        specifiedAmount: '',
        rangeMin: '',
        rangeMax: '1',
      });
    });

    expect(setTransfersInfo).toHaveBeenCalledTimes(1);
    const nextTransfersInfo = setTransfersInfo.mock.calls[0][0];
    expect(nextTransfersInfo).toHaveLength(2);
    nextTransfersInfo.forEach((transfer) => {
      expect(new BigNumber(transfer.amount).isEqualTo('0.01')).toBe(true);
    });
  });
});
