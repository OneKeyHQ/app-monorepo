import BigNumber from 'bignumber.js';

import {
  isShieldedAddress,
  zcashTransparentScriptForAddress,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash';
import { toUserFacingZcashError } from '@onekeyhq/core/src/chains/zcash/sdkZcash/errorCopy';
import type {
  IZcashTransparentTxBuildResult,
  IZcashTransparentTxRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import type { IEncodedTxZcash } from './types';
import type { SimpleDbEntityPrivacyChainJournal } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainJournal';
import type { SimpleDbEntityPrivacyChainZcashSent } from '../../../dbs/simple/entity/SimpleDbEntityPrivacyChainZcashSent';

// The outputs the signed tx actually pays, checked against the review; a swapped recipient or change address shows up only here.
function outputsMatchReview(
  request: IZcashTransparentTxRequest,
  outputs: { valueZat: string; scriptPubKey: string }[],
  reviewedAmountZat: string,
): boolean {
  const unmatched = [...outputs];
  for (const recipient of request.recipients) {
    const script = zcashTransparentScriptForAddress(recipient.address);
    // A u1 recipient is an Ironwood output: the keys runtime signs only when
    // it pays this request's recipient and amount.
    if (script) {
      const index = unmatched.findIndex(
        (output) =>
          output.scriptPubKey.toLowerCase() === script &&
          new BigNumber(output.valueZat).isEqualTo(
            request.sendMax ? reviewedAmountZat : (recipient.amountZat ?? ''),
          ),
      );
      if (index === -1) return false;
      unmatched.splice(index, 1);
    }
  }
  const changeScript = request.change
    ? zcashTransparentScriptForAddress(request.change.address)
    : null;
  return unmatched.every(
    (output) =>
      changeScript !== null &&
      output.scriptPubKey.toLowerCase() === changeScript,
  );
}

export async function signTransparentTransaction({
  journal,
  sentStore,
  accountId,
  encodedTx,
  request,
  sign,
  parseOutputs,
}: {
  journal: Pick<
    SimpleDbEntityPrivacyChainJournal,
    | 'reserveTransparentOutpoints'
    | 'saveTransparentPendingTx'
    | 'releaseTransparentReservation'
  >;
  sentStore: Pick<SimpleDbEntityPrivacyChainZcashSent, 'recordZcashSent'>;
  accountId: string;
  encodedTx: IEncodedTxZcash;
  request: IZcashTransparentTxRequest;
  sign: () => Promise<IZcashTransparentTxBuildResult>;
  parseOutputs: (
    result: IZcashTransparentTxBuildResult,
  ) => Promise<{ valueZat: string; scriptPubKey: string }[]>;
}): Promise<ISignedTxPro> {
  const { ownerId } = checkIsDefined(encodedTx.zcashTransparentPlan);
  await journal.reserveTransparentOutpoints({
    accountId,
    ownerId,
    outpoints: request.selectedOutpoints,
    currentHeight: request.targetHeight,
    expiryHeight: request.expiryHeight,
  });
  try {
    const result = await sign();
    const expected = new Set(
      request.selectedOutpoints.map(({ txid, vout }) => `${txid}:${vout}`),
    );
    const actual = new Set(
      result.spentOutpoints.map(({ txid, vout }) => `${txid}:${vout}`),
    );
    if (
      !new BigNumber(result.feeZat).isEqualTo(encodedTx.fee) ||
      result.expiryHeight !== request.expiryHeight ||
      result.spentOutpoints.length !== expected.size ||
      actual.size !== expected.size ||
      [...actual].some((outpoint) => !expected.has(outpoint)) ||
      !outputsMatchReview(
        request,
        await parseOutputs(result),
        encodedTx.zcashAmountValue,
      )
    ) {
      throw new OneKeyLocalError(
        'Zcash transparent signing result did not match the reviewed transaction',
      );
    }
    // Before broadcast: neither the backend nor the runtime can tell this wallet a shielded recipient or memo.
    if (isShieldedAddress(encodedTx.zcashTo)) {
      await sentStore.recordZcashSent({
        accountId,
        txid: result.txid,
        record: {
          recipient: encodedTx.zcashTo,
          amountZat: encodedTx.zcashAmountValue,
          feeZat: result.feeZat,
          memoHex: encodedTx.zcashMemoHex,
          createdAt: Date.now(),
        },
      });
    }
    await journal.saveTransparentPendingTx({
      accountId,
      requireLiveReservation: true,
      tx: {
        ownerId,
        rawTx: result.rawTx,
        txid: result.txid,
        spentOutpoints: result.spentOutpoints,
        expiryHeight: result.expiryHeight,
        createdAt: Date.now(),
        broadcastState: 'unknown',
        broadcastAuthorized: false,
      },
    });
    const signedEncodedTx: IEncodedTxZcash = {
      ...encodedTx,
      zcashTransparentBuild: result,
    };
    return {
      txid: result.txid,
      rawTx: result.rawTx,
      encodedTx: signedEncodedTx,
    };
  } catch (error) {
    await journal.releaseTransparentReservation({ accountId, ownerId });
    throw toUserFacingZcashError(error);
  }
}
