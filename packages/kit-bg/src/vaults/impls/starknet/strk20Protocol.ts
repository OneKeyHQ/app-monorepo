import BigNumber from 'bignumber.js';

import type {
  IDecodedTxExtraStarknet,
  IEncodedTxStarknetPrivacy,
  IStarknetCall,
} from '@onekeyhq/core/src/chains/starknet/types';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { starknetPrivacyOperationTitles } from '@onekeyhq/shared/src/locale/starknetPrivacy';
import { projectPrivacyChainHistoryTxToPool } from '@onekeyhq/shared/src/utils/privacyChainHistoryUtils';
import { strk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EStrk20ErrorCode,
  type EStrk20PrivateTxKind,
  type IStrk20TransferKind,
  type IStrk20Warning,
} from '@onekeyhq/shared/types/starknetPrivacy';
import type { IToken } from '@onekeyhq/shared/types/token';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import { STRK_TOKEN_ADDRESS } from './sdkStarknet/consts';
import { getStrk20HistoryTransfers } from './strk20Adapter';

import type ClientStarknet from './sdkStarknet/ClientStarknet';
import type {
  HistoryTransaction as IStrk20HistoryTransactionLike,
  PrivateTransfersInterface,
  ProofInvocationResult,
} from './sdkStarknet/privacy';
import type StarknetVault from './Vault';

/**
 * The starknet vault utils pull in starknet.js through the core SDK. The import
 * is dynamic so the bg startup bundle does not carry that library for users who
 * never touch Starknet.
 */
async function loadStarknetUtils() {
  return import('./utils');
}

// Display identity for this network's configured private pool; the contract address stays in extraInfo.
export const PRIVATE_HISTORY_POOL_ID = 1;

/**
 * Stateless discovery: always re-discover, never persist a note registry. Doc 01
 * §7 recommends exactly this, and it means nothing local can disagree with the
 * chain. `autoSetup` lets a first transfer to a new recipient carry its own
 * channel-opening actions.
 */
const STATELESS_EXECUTE_OPTIONS = {
  autoDiscover: { notes: 'refresh', channels: 'refresh' },
  autoSetup: true,
  autoSelectNotes: 'all',
} as const;

function parseSpecVersion(version: string): number[] {
  return version
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

/** true when `version` is at least `minimum`, comparing major.minor.patch. */
export function isSpecVersionAtLeast(
  version: string,
  minimum: string,
): boolean {
  const actual = parseSpecVersion(version);
  const wanted = parseSpecVersion(minimum);
  for (let i = 0; i < Math.max(actual.length, wanted.length); i += 1) {
    const a = actual[i] ?? 0;
    const w = wanted[i] ?? 0;
    if (a !== w) {
      return a > w;
    }
  }
  return true;
}

/**
 * Amounts arrive as base-unit integer strings. A decimal or exponent form is a
 * caller bug, not something to round: the SDK and the approve would each round
 * independently and the allowance could come out one unit short.
 */
export function parseStrk20BaseAmount(amount: string): string {
  const value = new BigNumber(amount);
  if (!value.isFinite() || value.isNegative() || !value.isInteger()) {
    throw strk20Error(EStrk20ErrorCode.InvalidAmount);
  }
  return value.toFixed(0);
}

/**
 * Builds the proof and the matching invoke transaction. `apply_actions` pulls
 * its STRK fee from the caller first, so the allowance rides in the same
 * transaction: a separate approve would be a transparent tx the next proof
 * reads, which re-arms the §3 wait.
 */
export async function buildStrk20UnsignedTx(params: {
  poolAddress: string;
  client: ClientStarknet;
  vault: StarknetVault;
  accountAddress: string;
  intent:
    | { kind: 'register' }
    | {
        kind: IStrk20TransferKind;
        tokenAddress: string;
        amount: string;
        recipient?: string;
      };
  transfers: PrivateTransfersInterface;
  provingBlockId: number;
  protocolFee?: string;
  assertSession: () => void;
}): Promise<{ unsignedTx: IUnsignedTxPro; warnings: IStrk20Warning[] }> {
  const {
    buildErc20ApproveCall,
    normalizeStarknetAddress,
    normalizeTokenAddress,
    toHexFelt,
  } = await loadStarknetUtils();
  const { intent, transfers } = params;
  const builder = transfers.build(STATELESS_EXECUTE_OPTIONS);
  params.assertSession();
  let tokenAddress: string | undefined;
  let invocation: ProofInvocationResult;
  if (intent.kind === 'register') {
    invocation = await builder.register().createProofInvocation();
  } else {
    tokenAddress = normalizeTokenAddress(intent.tokenAddress);
    const amount = BigInt(intent.amount);
    const tokenOps = builder
      .with(tokenAddress)
      .surplusTo(params.accountAddress);
    if (intent.kind === 'deposit') {
      tokenOps.deposit({ amount });
    } else if (intent.kind === 'withdraw') {
      tokenOps.withdraw(
        intent.recipient
          ? { amount, recipient: normalizeStarknetAddress(intent.recipient) }
          : { amount },
      );
    } else {
      tokenOps.transfer({
        amount,
        recipient: normalizeStarknetAddress(intent.recipient ?? ''),
      });
    }
    invocation = await tokenOps.createProofInvocation();
  }
  params.assertSession();
  const {
    callAndProof: { call, proof },
    warnings = [],
  } = await transfers.executeWithInvocation(invocation, params.provingBlockId);
  params.assertSession();
  const protocolFee =
    params.protocolFee ??
    (await params.client.getPoolFeeAmount(params.poolAddress));
  // Depositing STRK needs one allowance covering the fee AND the deposit, and
  // approve overwrites rather than adds, so the two are summed here.
  const depositsStrk =
    intent.kind === 'deposit' &&
    tokenAddress === normalizeTokenAddress(STRK_TOKEN_ADDRESS);
  const strkAllowance = new BigNumber(protocolFee)
    .plus(depositsStrk ? intent.amount : 0)
    .toFixed(0);

  const calls: IStarknetCall[] = [];
  // A zero allowance is a no-op call; skip it rather than paying gas for it.
  if (new BigNumber(strkAllowance).gt(0)) {
    calls.push(
      buildErc20ApproveCall({
        tokenAddress: STRK_TOKEN_ADDRESS,
        spender: params.poolAddress,
        amount: strkAllowance,
      }),
    );
  }
  // A non-STRK deposit needs its own allowance on that token as well.
  if (intent.kind === 'deposit' && tokenAddress && !depositsStrk) {
    calls.push(
      buildErc20ApproveCall({
        tokenAddress,
        spender: params.poolAddress,
        amount: intent.amount,
      }),
    );
  }
  calls.push({
    contractAddress: normalizeStarknetAddress(call.contractAddress),
    entrypoint: call.entrypoint,
    calldata:
      (call.calldata as unknown[] | undefined)?.map((item) =>
        toHexFelt(item as string | number | bigint),
      ) ?? [],
  });

  const privacy: IEncodedTxStarknetPrivacy = {
    poolAddress: params.poolAddress,
    kind: intent.kind,
    proofFacts: proof.proofFacts.map((fact) => toHexFelt(fact)),
    proof: proof.data,
    provingBlockId: params.provingBlockId,
    builtAt: Date.now(),
    ...(intent.kind !== 'register'
      ? {
          tokenAddress,
          amount: intent.amount,
          ...(intent.recipient ? { recipient: intent.recipient } : {}),
        }
      : {}),
    protocolFee,
    ...(warnings.length ? { warnings } : {}),
  };

  const encodedTx = await params.vault.buildPrivacyEncodedTx({
    from: params.accountAddress,
    calls,
    privacy,
  });
  return { unsignedTx: { encodedTx, transfersInfo: [] }, warnings };
}

/**
 * Token-specific movements with known counterparties. Metadata comes from
 * the token service. Keep the actual block when no timestamp is provided;
 * unknown fees stay unknown.
 */
export async function buildStrk20HistoryTx(params: {
  vault: StarknetVault;
  networkId: string;
  accountId: string;
  accountAddress: string;
  poolAddress: string;
  transaction: IStrk20HistoryTransactionLike;
  tokenAddress: string;
  getTokenInfo: () => Promise<IToken | undefined>;
}): Promise<IAccountHistoryTx | undefined> {
  const { transaction } = params;
  const { normalizeStarknetAddress, toHexFelt } = await loadStarknetUtils();
  const txid = toHexFelt(transaction.transactionHash);
  const movements = (
    await getStrk20HistoryTransfers(
      transaction,
      BigInt(params.accountAddress),
      BigInt(params.poolAddress),
    )
  ).filter((item) => item.token === BigInt(params.tokenAddress));
  if (!movements.length) return undefined;
  const kind: EStrk20PrivateTxKind = movements.every(
    (item) => item.kind === movements[0].kind,
  )
    ? movements[0].kind
    : 'transfer';
  const { vault } = params;
  const token = await params.getTokenInfo();
  if (!token || token.decimals === undefined)
    throw strk20Error(EStrk20ErrorCode.History);
  const action = await vault.buildTxTransferAssetAction({
    from: normalizeStarknetAddress(toHexFelt(movements[0].from)),
    to: normalizeStarknetAddress(toHexFelt(movements[0].to)),
    transfers: movements.map((item) => ({
      from: normalizeStarknetAddress(toHexFelt(item.from)),
      to: normalizeStarknetAddress(toHexFelt(item.to)),
      tokenIdOnNetwork: params.tokenAddress,
      amount: new BigNumber(item.amount.toString())
        .shiftedBy(-token.decimals)
        .toFixed(),
      icon: token.logoURI ?? '',
      name: token.name,
      symbol: token.symbol,
      isNFT: false,
      isNative:
        token.isNative ??
        BigInt(params.tokenAddress) === BigInt(STRK_TOKEN_ADDRESS),
    })),
  });

  const isReceiveOnly =
    kind === 'transfer' &&
    movements.every(
      (item) =>
        item.to === BigInt(params.accountAddress) &&
        item.from !== BigInt(params.accountAddress),
    );
  if (action.assetTransfer && !isReceiveOnly) {
    action.assetTransfer.label = appLocale.intl.formatMessage({
      id: starknetPrivacyOperationTitles[kind],
    });
  }

  const delta = movements
    .reduce((balance, movement) => {
      if (movement.kind === 'deposit')
        return balance.plus(movement.amount.toString());
      if (movement.kind === 'withdraw')
        return balance.minus(movement.amount.toString());
      return balance
        .plus(
          (movement.to === BigInt(params.accountAddress)
            ? movement.amount
            : BigInt(0)
          ).toString(),
        )
        .minus(
          (movement.from === BigInt(params.accountAddress)
            ? movement.amount
            : BigInt(0)
          ).toString(),
        );
    }, new BigNumber(0))
    .shiftedBy(-token.decimals)
    .toFixed();
  const tx: IAccountHistoryTx = {
    id: txid,
    isLocalCreated: false,
    privacyChainHistorySide: 'private',
    privacyChainHistoryPoolIds: [PRIVATE_HISTORY_POOL_ID],
    privacyChainHistoryPoolDeltas: { [PRIVATE_HISTORY_POOL_ID]: delta },
    privacyChainHistoryFeePoolId: 0,
    decodedTx: {
      txid,
      owner: params.accountAddress,
      signer: normalizeStarknetAddress(toHexFelt(movements[0].from)),
      actions: [action],
      status: EDecodedTxStatus.Confirmed,
      networkId: params.networkId,
      accountId: params.accountId,
      extraInfo: {
        privacy: {
          kind,
          poolAddress: normalizeStarknetAddress(params.poolAddress),
        },
      } as IDecodedTxExtraStarknet,
      block: transaction.blockNumber,
    },
  };
  return projectPrivacyChainHistoryTxToPool({
    tx,
    selectedPoolId: PRIVATE_HISTORY_POOL_ID,
  });
}
