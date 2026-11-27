import BigNumber from 'bignumber.js';

import type {
  IDecodedTxExtraStarknet,
  IEncodedTxStarknet,
  IEncodedTxStarknetPrivacy,
} from '@onekeyhq/core/src/chains/starknet/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { starknetPrivacyOperationTitles } from '@onekeyhq/shared/src/locale/starknetPrivacy';
import type {
  IAccountHistoryTx,
  IOnChainHistoryTx,
} from '@onekeyhq/shared/types/history';
import { EStrk20ErrorCode } from '@onekeyhq/shared/types/starknetPrivacy';
import {
  EDecodedTxActionType,
  type IDecodedTxAction,
  type IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import {
  STRK20_PRIVACY_CONFIG,
  STRK20_SCREENING_WINDOW_MS,
} from './sdkStarknet';
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
  fromRecovery?: boolean;
}): Promise<void> {
  const { backgroundApi, networkId, accountId, encodedTx, txid, fromRecovery } =
    params;
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
      ...(typeof privacy.provingBlockId === 'number'
        ? { provingBlockId: privacy.provingBlockId }
        : {}),
    };
    if (privacy.kind === 'register') {
      await backgroundApi.serviceStarknetPrivacy.noteRegisterSubmitted(key);
    } else {
      await backgroundApi.serviceStarknetPrivacy.notePrivateTransferSubmitted({
        ...key,
        kind: privacy.kind,
        ...(fromRecovery ? { fromRecovery: true } : {}),
      });
    }
  } catch {
    // Broadcast already succeeded; recording its public status must not change the result.
  }
}

/**
 * Strips sensitive private transfer details (`amount`, `recipient`, `tokenAddress`,
 * and clear `ASSET_TRANSFER` actions) before a history row is persisted to
 * `simpleDb.localHistory`. Public on-chain fields (txid, status, block, fees,
 * poolAddress, kind) are preserved so Discovery rows can still merge local fees.
 */
export function redactStarknetPrivacyHistoryTx(
  tx: IAccountHistoryTx,
): IAccountHistoryTx {
  const extraInfo = tx.decodedTx.extraInfo as
    | IDecodedTxExtraStarknet
    | undefined;
  const encodedTx = tx.decodedTx.encodedTx as IEncodedTxStarknet | undefined;
  const privacy = extraInfo?.privacy ?? encodedTx?.privacy;
  if (!privacy || privacy.kind === 'register') {
    return tx;
  }

  const stripSensitiveFields = <
    T extends { amount?: string; recipient?: string; tokenAddress?: string },
  >(
    value: T,
  ): Omit<T, 'amount' | 'recipient' | 'tokenAddress'> => {
    const {
      amount: _amount,
      recipient: _recipient,
      tokenAddress: _tokenAddress,
      ...publicFields
    } = value;
    return publicFields;
  };

  const pool = normalizeStarknetAddress(privacy.poolAddress);
  const publicAction: IDecodedTxAction = {
    type: EDecodedTxActionType.FUNCTION_CALL,
    functionCall: {
      from: tx.decodedTx.owner || tx.decodedTx.signer,
      to: pool,
      functionName: appLocale.intl.formatMessage({
        id: starknetPrivacyOperationTitles[privacy.kind],
      }),
      args: [],
    },
  };

  return {
    ...tx,
    decodedTx: {
      ...tx.decodedTx,
      actions: [publicAction],
      outputActions: undefined,
      txDisplay: undefined,
      ...(encodedTx?.privacy
        ? {
            encodedTx: {
              ...encodedTx,
              privacy: stripSensitiveFields(encodedTx.privacy),
            },
          }
        : {}),
      ...(extraInfo?.privacy
        ? {
            extraInfo: {
              ...extraInfo,
              privacy: stripSensitiveFields(extraInfo.privacy),
            },
          }
        : {}),
    },
  };
}

const STARKNET_ON_CHAIN_PRIVACY_KINDS: Record<
  string,
  IEncodedTxStarknetPrivacy['kind']
> = {
  strk20_register: 'register',
  strk20_deposit: 'deposit',
  strk20_withdraw: 'withdraw',
  strk20_transfer: 'transfer',
};

function matchStarknetOnChainTag(
  onChainHistoryTx: IOnChainHistoryTx,
): string | undefined {
  for (const candidate of [onChainHistoryTx.type, onChainHistoryTx.label]) {
    if (candidate) {
      const normalized = String(candidate).toLowerCase();
      if (
        normalized === 'deploy_account' ||
        normalized in STARKNET_ON_CHAIN_PRIVACY_KINDS
      ) {
        return normalized;
      }
    }
  }
  return undefined;
}

/**
 * Maps backend Starknet history tags (`deploy_account`, `strk20_*`) to
 * structured `IDecodedTxExtraStarknet` so list/detail titles and public-tab
 * visibility work consistently without requiring local history records.
 */
export function resolveStarknetOnChainHistoryExtraInfo(params: {
  networkId: string;
  onChainHistoryTx: IOnChainHistoryTx;
}): IDecodedTxExtraStarknet | null {
  const { networkId, onChainHistoryTx } = params;
  const tag = matchStarknetOnChainTag(onChainHistoryTx);
  if (!tag) {
    return null;
  }
  if (tag === 'deploy_account') {
    return { accountDeployment: true };
  }
  const kind = STARKNET_ON_CHAIN_PRIVACY_KINDS[tag];
  if (!kind) {
    return null;
  }
  const poolAddress =
    STRK20_PRIVACY_CONFIG[networkId]?.poolAddress ||
    onChainHistoryTx.to ||
    onChainHistoryTx.from ||
    '';
  return {
    privacy: {
      kind,
      poolAddress: poolAddress ? normalizeStarknetAddress(poolAddress) : '',
    },
  };
}

/**
 * Replaces raw backend snake_case Starknet tags on decoded actions with
 * localized titles so fallback UI surfaces never render raw identifiers.
 */
export function localizeStarknetOnChainHistoryAction(params: {
  action: IDecodedTxAction;
  extraInfo: IDecodedTxExtraStarknet | null;
}): IDecodedTxAction {
  const { action, extraInfo } = params;
  let titleKey: ETranslations | undefined;
  if (extraInfo?.accountDeployment) {
    titleKey = ETranslations.starknet_account_activation__title;
  } else if (extraInfo?.privacy?.kind) {
    titleKey = starknetPrivacyOperationTitles[extraInfo.privacy.kind];
  }
  if (!titleKey) {
    return action;
  }
  const localizedTitle = appLocale.intl.formatMessage({ id: titleKey });
  if (action.functionCall) {
    return {
      ...action,
      functionCall: {
        ...action.functionCall,
        functionName: localizedTitle,
      },
    };
  }
  if (action.assetTransfer) {
    return {
      ...action,
      assetTransfer: {
        ...action.assetTransfer,
        label: localizedTitle,
      },
    };
  }
  return action;
}
