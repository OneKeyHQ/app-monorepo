import BigNumber from 'bignumber.js';

import { zcashTransparentScriptForAddress } from '@onekeyhq/core/src/chains/zcash/sdkZcash';
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

// The outputs the signed transaction actually pays, checked against what the
// user reviewed. Inputs, fee and expiry echo the request and prove nothing on
// their own; a signer that swapped the recipient or the change address shows
// up only here.
function outputsMatchReview(
  request: IZcashTransparentTxRequest,
  outputs: { valueZat: string; scriptPubKey: string }[],
  reviewedAmountZat: string,
): boolean {
  const unmatched = [...outputs];
  for (const recipient of request.recipients) {
    const script = zcashTransparentScriptForAddress(recipient.address);
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
