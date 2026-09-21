import BigNumber from 'bignumber.js';

import type {
  IZcashTransparentTxBuildResult,
  IZcashTransparentTxRequest,
} from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';

import type { IEncodedTxZcash } from './types';
import type { SimpleDbEntityZcash } from '../../../dbs/simple/entity/SimpleDbEntityZcash';

export async function signTransparentTransaction({
  journal,
  accountId,
  encodedTx,
  request,
  sign,
}: {
  journal: Pick<
    SimpleDbEntityZcash,
    | 'reserveTransparentOutpoints'
    | 'saveTransparentPendingTx'
    | 'releaseTransparentReservation'
  >;
  accountId: string;
  encodedTx: IEncodedTxZcash;
  request: IZcashTransparentTxRequest;
  sign: () => Promise<IZcashTransparentTxBuildResult>;
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
      [...actual].some((outpoint) => !expected.has(outpoint))
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
    throw error;
  }
}
