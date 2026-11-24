import BigNumber from 'bignumber.js';

import type {
  IEncodedTxStarknet,
  IEncodedTxStarknetPrivacy,
} from '@onekeyhq/core/src/chains/starknet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { starknetPrivacyOperationTitles } from '@onekeyhq/shared/src/locale/starknetPrivacy';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';
import {
  EDecodedTxActionType,
  type IDecodedTxAction,
  type IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { STRK20_SCREENING_WINDOW_MS } from './sdkStarknet';
import { normalizeStarknetAddress, normalizeTokenAddress } from './utils';

import type { ClientStarknet } from './sdkStarknet';
import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

export type IStarknetTokenMetadata = {
  name: string;
  symbol: string;
  decimals: number;
  logoURI: string;
  isNative?: boolean;
};

/**
 * Decodes a STRK20 privacy transaction into a user-facing `IDecodedTxAction`,
 * keeping STRK20 display/label concerns out of the core Starknet Vault.
 */
export async function buildStarknetPrivacyDecodedAction(params: {
  encodedTx: IEncodedTxStarknet;
  privacy: IEncodedTxStarknetPrivacy;
  getTokenMetadata: (tokenAddress: string) => Promise<IStarknetTokenMetadata>;
  buildTransferAction: (p: {
    from: string;
    to: string;
    transfers: IDecodedTxTransferInfo[];
  }) => Promise<IDecodedTxAction>;
}): Promise<IDecodedTxAction> {
  const { encodedTx, privacy, getTokenMetadata, buildTransferAction } = params;
  if (privacy.kind === 'register') {
    return {
      type: EDecodedTxActionType.FUNCTION_CALL,
      functionCall: {
        from: encodedTx.from,
        to: normalizeStarknetAddress(privacy.poolAddress),
        functionName: appLocale.intl.formatMessage({
          id: ETranslations.privacy_enable__title,
        }),
        args: [],
      },
    };
  }
  if (!privacy.tokenAddress || !privacy.amount) {
    return {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: encodedTx.from,
        to: normalizeStarknetAddress(privacy.poolAddress),
        label: privacy.kind,
      },
    };
  }

  const tokenAddress = normalizeTokenAddress(privacy.tokenAddress);
  const token = await getTokenMetadata(tokenAddress);
  const pool = normalizeStarknetAddress(privacy.poolAddress);
  const defaultRecipient = privacy.kind === 'withdraw' ? encodedTx.from : pool;
  const counterparty = privacy.recipient
    ? normalizeStarknetAddress(privacy.recipient)
    : defaultRecipient;
  const from = privacy.kind === 'withdraw' ? pool : encodedTx.from;
  const to = privacy.kind === 'deposit' ? pool : counterparty;

  const action = await buildTransferAction({
    from,
    to,
    transfers: [
      {
        from,
        to,
        amount: new BigNumber(privacy.amount)
          .shiftedBy(-token.decimals)
          .toFixed(),
        tokenIdOnNetwork: tokenAddress,
        icon: token.logoURI,
        name: token.name,
        symbol: token.symbol,
        isNFT: false,
        isNative: token.isNative,
      },
    ],
  });
  if (action.assetTransfer) {
    action.assetTransfer.label = appLocale.intl.formatMessage({
      id: starknetPrivacyOperationTitles[privacy.kind],
    });
  }
  return action;
}

/**
 * Refuses stale privacy builds before broadcast so the user does not burn a
 * real fee on a SCREENING_REQUIRED or PROOF_EXPIRED revert.
 * - Deposits additionally enforce STRK20_SCREENING_WINDOW_MS.
 * - All privacy txs check `provingBlockId` against the pool's
 *   `get_proof_validity_blocks` window.
 */
export async function assertStarknetPrivacyBuildIsFresh(params: {
  client: ClientStarknet;
  encodedTx: IEncodedTxStarknet | undefined;
}): Promise<void> {
  const { client, encodedTx } = params;
  const privacy = encodedTx?.privacy;
  if (!privacy) {
    return;
  }
  if (
    privacy.kind === 'deposit' &&
    Date.now() - privacy.builtAt > STRK20_SCREENING_WINDOW_MS
  ) {
    throw new OneKeyLocalError({
      key: ETranslations.privacy_error_review_expired__msg,
      data: {
        starknetPrivacyErrorCode: EStrk20ErrorCode.ScreeningWindowExpired,
      },
      message: appLocale.intl.formatMessage({
        id: ETranslations.privacy_error_review_expired__msg,
      }),
    });
  }
  if (
    typeof privacy.provingBlockId !== 'number' ||
    !privacy.poolAddress ||
    typeof client.getBlockNumber !== 'function' ||
    typeof client.getPoolProofValidityBlocks !== 'function'
  ) {
    return;
  }
  let latestBlock: number;
  let validityBlocks: number;
  try {
    [latestBlock, validityBlocks] = await Promise.all([
      client.getBlockNumber(),
      client.getPoolProofValidityBlocks(privacy.poolAddress),
    ]);
  } catch {
    // Transient pre-check RPC failures fall through to the broadcast itself.
    return;
  }
  if (
    validityBlocks > 0 &&
    latestBlock - privacy.provingBlockId >= validityBlocks
  ) {
    throw new OneKeyLocalError({
      key: ETranslations.privacy_error_review_expired__msg,
      data: {
        starknetPrivacyErrorCode: EStrk20ErrorCode.ProofExpired,
      },
      message: appLocale.intl.formatMessage({
        id: ETranslations.privacy_error_review_expired__msg,
      }),
    });
  }
}

/**
 * Records public status once the node accepts a privacy transaction or
 * counterfactual account activation. Recording failures must not make an
 * accepted broadcast look like a failed submission.
 */
export async function noteStarknetPrivacyBroadcastSubmitted(params: {
  backgroundApi: IBackgroundApi;
  networkId: string;
  accountId: string;
  encodedTx: IEncodedTxStarknet | undefined;
  txid: string;
}): Promise<void> {
  const { backgroundApi, networkId, accountId, encodedTx, txid } = params;
  if (encodedTx?.type === 'DEPLOY_ACCOUNT') {
    try {
      await backgroundApi.serviceStarknetPrivacy.noteAccountActivationSubmitted(
        {
          networkId,
          accountId,
          txid,
        },
      );
    } catch {
      // The normal local history still tracks an accepted deployment.
    }
    return;
  }
  const privacy = encodedTx?.privacy;
  if (!privacy) {
    return;
  }
  try {
    const key = {
      networkId,
      accountId,
      poolAddress: privacy.poolAddress,
      txid,
    };
    if (privacy.kind === 'register') {
      await backgroundApi.serviceStarknetPrivacy.noteRegisterSubmitted(key);
    } else {
      await backgroundApi.serviceStarknetPrivacy.notePrivateTransferSubmitted({
        ...key,
        kind: privacy.kind,
      });
    }
  } catch {
    // Broadcast already succeeded; recording its public status must not change the result.
  }
}
