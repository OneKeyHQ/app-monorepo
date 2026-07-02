import {
  getKnownPerpsDepositOrderTxIds,
  isPerpsDepositOrderMatchedByTxIds,
  shouldKeepHistoryConfirmationMarker,
} from './perpsDepositHistoryUtils';

describe('perpsDepositHistoryUtils', () => {
  it('matches and clears a marker by target toTxId after source tx confirmed first', () => {
    const txIds = getKnownPerpsDepositOrderTxIds({
      txid: '0xTargetTx',
      originalTxId: undefined,
    });
    const marker = {
      fromTxId: '0xSourceTx',
      toTxId: '0xtargettx',
      keepForHistoryConfirmation: true,
    };

    expect(isPerpsDepositOrderMatchedByTxIds(marker, txIds)).toBe(true);
    expect(shouldKeepHistoryConfirmationMarker(marker, txIds)).toBe(false);
  });

  it('keeps unmatched markers and non-marker orders', () => {
    const txIds = getKnownPerpsDepositOrderTxIds({
      txid: '0xTargetTx',
      originalTxId: undefined,
    });

    expect(
      shouldKeepHistoryConfirmationMarker(
        {
          fromTxId: '0xSourceTx',
          toTxId: '0xOtherTargetTx',
          keepForHistoryConfirmation: true,
        },
        txIds,
      ),
    ).toBe(true);
    expect(
      shouldKeepHistoryConfirmationMarker(
        {
          fromTxId: '0xSourceTx',
          toTxId: '0xTargetTx',
        },
        txIds,
      ),
    ).toBe(true);
  });
});
