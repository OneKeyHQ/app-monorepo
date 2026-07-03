import {
  getKnownPerpsDepositOrderTxIds,
  isPerpsDepositOrderMatchedByTargetTxIds,
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
    expect(isPerpsDepositOrderMatchedByTargetTxIds(marker, txIds)).toBe(true);
    expect(shouldKeepHistoryConfirmationMarker(marker, txIds)).toBe(false);
  });

  it('keeps a marker with target toTxId when only source tx confirmed', () => {
    const txIds = getKnownPerpsDepositOrderTxIds({
      txid: '0xSourceTx',
      originalTxId: undefined,
    });
    const marker = {
      fromTxId: '0xsourcetx',
      toTxId: '0xTargetTx',
      keepForHistoryConfirmation: true,
    };

    expect(isPerpsDepositOrderMatchedByTxIds(marker, txIds)).toBe(true);
    expect(isPerpsDepositOrderMatchedByTargetTxIds(marker, txIds)).toBe(false);
    expect(shouldKeepHistoryConfirmationMarker(marker, txIds)).toBe(true);
  });

  it('clears a direct-deposit marker without target toTxId by source tx', () => {
    const txIds = getKnownPerpsDepositOrderTxIds({
      txid: '0xSourceTx',
      originalTxId: undefined,
    });
    const marker = {
      fromTxId: '0xsourcetx',
      keepForHistoryConfirmation: true,
    };

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
