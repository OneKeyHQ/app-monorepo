import BigNumber from 'bignumber.js';

import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { strk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';
import {
  EStrk20ErrorCode,
  EStrk20OptInStatus,
  EStrk20SequencingStatus,
  type IStrk20AccountKey,
  type IStrk20AccountPrivacyState,
  type IStrk20SequencingState,
  type IStrk20TransferKind,
  type IStrk20Warning,
} from '@onekeyhq/shared/types/starknetPrivacy';

import simpleDb from '../../dbs/simple/simpleDb';

import type {
  IStarknetPrivacyContext,
  IStarknetPrivacyScope,
  IStarknetVaultResolver,
} from './types';

type IPrivacyTxBuilderDeps = {
  resolvePoolAddress: (networkId: string) => Promise<string>;
  isDisabledByServer: (networkId: string) => Promise<boolean>;
  getStarknetVault: IStarknetVaultResolver;
  getAccountPrivacyState: (
    p: IStrk20AccountKey,
  ) => Promise<IStrk20AccountPrivacyState>;
  getSequencingState: (p: IStrk20AccountKey) => Promise<IStrk20SequencingState>;
  isRecipientRegistered: (p: {
    networkId: string;
    recipient: string;
  }) => Promise<boolean>;
  getPrivacyContext: (p: {
    networkId: string;
    accountId: string;
    allowPrompt: boolean;
    purpose?: 'read' | 'register' | 'transfer';
  }) => Promise<IStarknetPrivacyContext>;
  getRegisteredPrivacyContext: (
    p: IStrk20AccountKey,
    purpose?: 'read' | 'transfer',
    allowPrompt?: boolean,
  ) => Promise<IStarknetPrivacyContext | undefined>;
  dropCachedViewingKey: (p: IStarknetPrivacyScope) => void;
};

/**
 * Builds unsigned STRK20 transactions (register, deposit, withdraw, transfer)
 * after enforcing pool pause, sequencing gate, recipient registration, and
 * deposit STRK balance preconditions.
 */
export class PrivacyTxBuilder {
  private readonly deps: IPrivacyTxBuilderDeps;

  constructor(deps: IPrivacyTxBuilderDeps) {
    this.deps = deps;
  }

  /**
   * Refuses to build when the protocol has paused the pool or when the §3 wait
   * is still running, rather than letting the transaction revert on-chain.
   */
  private async assertBuildable(p: {
    networkId: string;
    accountId: string;
    poolAddress: string;
    client: { isPoolPaused: (poolAddress: string) => Promise<boolean> };
  }): Promise<IStrk20SequencingState & { provingBlockId: number }> {
    if (await p.client.isPoolPaused(p.poolAddress)) {
      throw strk20Error(EStrk20ErrorCode.PoolPaused);
    }
    const sequencing = await this.deps.getSequencingState({
      networkId: p.networkId,
      accountId: p.accountId,
    });
    if (sequencing.status === EStrk20SequencingStatus.Unavailable) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    if (sequencing.status !== EStrk20SequencingStatus.Ready) {
      throw strk20Error(EStrk20ErrorCode.Waiting);
    }
    if (sequencing.provingBlockId === undefined) {
      throw new OneKeyLocalError(
        'STRK20 sequencing reported ready without a proving block',
      );
    }
    return { ...sequencing, provingBlockId: sequencing.provingBlockId };
  }

  /**
   * Consent is already recorded by the time this runs (§4.2), so a failed
   * register never restarts the consent flow. The pool's viewing key is
   * write-once: a matching on-chain key (reinstall, new device, re-opt-in)
   * means already registered, and a differing one is a terminal `mismatch`.
   * Neither may lead to a second registration.
   */
  async buildRegisterTx(
    p: IStrk20AccountKey & { resumeOnly?: boolean },
  ): Promise<
    | { alreadyRegistered: true }
    | { alreadyRegistered: false; unsignedTx: IUnsignedTxPro }
  > {
    const current = await this.deps.getAccountPrivacyState(p);
    if (current.optInStatus === EStrk20OptInStatus.None) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    if (current.optInStatus === EStrk20OptInStatus.RegisterPending) {
      throw strk20Error(EStrk20ErrorCode.Waiting);
    }
    if (current.optInStatus === EStrk20OptInStatus.Mismatch) {
      throw strk20Error(EStrk20ErrorCode.KeyMismatch);
    }
    const ctx = await this.deps.getPrivacyContext({
      ...p,
      allowPrompt: true,
      purpose: 'register',
    });
    const registered = await ctx.client.getPoolRegisteredPublicKey({
      poolAddress: ctx.poolAddress,
      accountAddress: ctx.account.address,
    });
    ctx.assertSession();
    if (registered && registered === ctx.viewing.publicKeyX) {
      const updated = await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: ctx.poolAddress,
        expected: { optInStatus: current.optInStatus },
        patch: {
          optInStatus: EStrk20OptInStatus.Registered,
          registeredPublicKey: registered,
        },
      });
      ctx.assertSession();
      if (updated?.optInStatus !== EStrk20OptInStatus.Registered) {
        throw strk20Error(EStrk20ErrorCode.Unavailable);
      }
      return { alreadyRegistered: true };
    }
    if (registered) {
      const updated = await simpleDb.starknetPrivacy.patchRecord({
        ...p,
        poolAddress: ctx.poolAddress,
        expected: { optInStatus: current.optInStatus },
        patch: {
          optInStatus: EStrk20OptInStatus.Mismatch,
          registeredPublicKey: registered,
        },
      });
      ctx.assertSession();
      if (updated?.optInStatus !== EStrk20OptInStatus.Mismatch) {
        throw strk20Error(EStrk20ErrorCode.Unavailable);
      }
      this.deps.dropCachedViewingKey({ ...p, poolAddress: ctx.poolAddress });
      throw strk20Error(EStrk20ErrorCode.KeyMismatch);
    }

    if (p.resumeOnly) throw strk20Error(EStrk20ErrorCode.Unavailable);

    const sequencing = await this.assertBuildable({
      ...p,
      poolAddress: ctx.poolAddress,
      client: ctx.client,
    });
    const { buildStrk20UnsignedTx } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const { unsignedTx } = await buildStrk20UnsignedTx({
      poolAddress: ctx.poolAddress,
      client: ctx.client,
      vault: ctx.vault,
      accountAddress: ctx.account.address,
      intent: { kind: 'register' },
      transfers: await ctx.buildTransfers(),
      assertSession: ctx.assertSession,
      provingBlockId: sequencing.provingBlockId,
    });
    ctx.assertSession();
    return { alreadyRegistered: false, unsignedTx };
  }

  /**
   * Amounts are base-unit integer strings, matching
   * `IStrk20PrivateBalances.byToken`; nothing here re-scales by decimals.
   */
  async buildPrivateTransferTx(
    p: IStrk20AccountKey & {
      kind: IStrk20TransferKind;
      tokenAddress: string;
      amount: string;
      recipient?: string;
    },
  ): Promise<{ unsignedTx: IUnsignedTxPro; warnings: IStrk20Warning[] }> {
    if (await this.deps.isDisabledByServer(p.networkId)) {
      throw strk20Error(EStrk20ErrorCode.Unavailable);
    }
    if (
      p.kind === 'transfer' &&
      (!p.recipient ||
        !(await this.deps.isRecipientRegistered({
          networkId: p.networkId,
          recipient: p.recipient,
        })))
    ) {
      throw strk20Error(EStrk20ErrorCode.RecipientNotRegistered);
    }
    const { parseStrk20BaseAmount, buildStrk20UnsignedTx } =
      await import('../../vaults/impls/starknet/strk20Protocol');
    const amountBase = parseStrk20BaseAmount(p.amount);
    if (amountBase === '0') throw strk20Error(EStrk20ErrorCode.InvalidAmount);
    const poolAddress = await this.deps.resolvePoolAddress(p.networkId);
    const vault = await this.deps.getStarknetVault(p);
    const client = await vault.getClient();
    const sequencing = await this.assertBuildable({
      ...p,
      poolAddress,
      client,
    });
    let protocolFee: string | undefined;
    if (p.kind === 'deposit') {
      const { STRK_TOKEN_ADDRESS } =
        await import('../../vaults/impls/starknet/sdkStarknet/consts');
      const { normalizeTokenAddress, u256ToDecimalString } =
        await import('../../vaults/impls/starknet/utils');
      const accountAddress = await vault.getAccountAddress();
      const [fee, [low, high]] = await Promise.all([
        client.getPoolFeeAmount(poolAddress),
        client.getTokenBalance({
          tokenAddress: STRK_TOKEN_ADDRESS,
          accountAddress,
        }),
      ]);
      protocolFee = fee;
      const required = new BigNumber(fee).plus(
        normalizeTokenAddress(p.tokenAddress) === STRK_TOKEN_ADDRESS
          ? amountBase
          : 0,
      );
      if (required.gt(u256ToDecimalString(low, high))) {
        const key = ETranslations.send_error_insufficient_balance;
        const info = { token: 'STRK' };
        throw new OneKeyLocalError({
          key,
          info,
          message: appLocale.intl.formatMessage({ id: key }, info),
        });
      }
    }
    const ctx = await this.deps.getRegisteredPrivacyContext(p);
    if (!ctx) throw strk20Error(EStrk20ErrorCode.Unavailable);

    const built = await buildStrk20UnsignedTx({
      poolAddress: ctx.poolAddress,
      client: ctx.client,
      vault: ctx.vault,
      accountAddress: ctx.account.address,
      intent: {
        kind: p.kind,
        tokenAddress: p.tokenAddress,
        amount: amountBase,
        recipient: p.recipient,
      },
      transfers: await ctx.buildTransfers(),
      assertSession: ctx.assertSession,
      provingBlockId: sequencing.provingBlockId,
      protocolFee,
    });
    ctx.assertSession();
    return built;
  }
}
