/**
 * Builder implementations for constructing private transfer operations.
 */

import {
  type CreateNoteAction,
  type DepositAction,
  type ExecuteOptions,
  type ExecuteResult,
  type Note,
  type OpenChannelAction,
  type OpenTokenChannelAction,
  type PrivateTransfersBuilder,
  type ProofInvocationResult,
  type Actions,
  type SetViewingKeyAction,
  type StarknetAddress,
  type StarknetAddressBigint,
  type TokenOperationsBuilder,
  type UseNoteAction,
  type WithdrawAction,
  type WithdrawOutput,
  type DepositInput,
  type TransferOutput,
  type SurplusAction,
  type InvokeAction,
  type ComputeAndInvokeAction,
  type ComputeAndInvokeDetails,
  type Amount,
  type InvokeCalldataBuilderArgs,
  type SimulateOptions,
  type ShadowAccountsBuilder,
  type ViewingKey,
  Open,
  PrivateTransfersInterface,
} from "../interfaces";
import { AddressMap, toBigInt } from "../utils/index";
import { debugLog } from "../utils/logging";
import { isOpenNote } from "../utils/validation";
import { ShadowAccountsBuilderImpl } from "./shadow-accounts";
import type { BigNumberish, CallDetails } from "starknet";

// ============ Token Operations Builder ============

export class TokenOperationsBuilderImpl implements TokenOperationsBuilder {
  // Actions stored without context - context resolved during execute
  public openTokenChannels: OpenTokenChannelAction[] = [];
  public useNotes: UseNoteAction[] = [];
  public deposits: DepositAction[] = [];
  public createNotes: CreateNoteAction[] = [];
  public withdraws: WithdrawAction[] = [];
  // Surplus recipient (overrides parent builder's surplus recipient for this token)
  public surplusAction?: SurplusAction;

  public readonly token: StarknetAddressBigint;

  constructor(
    private parentBuilder: PrivateTransfersBuilderImpl,
    token: StarknetAddress
  ) {
    this.token = toBigInt(token);
    debugLog("builder", `TokenBuilder created for ${token}`);
  }

  setup(recipient: StarknetAddress): this {
    debugLog("builder", `TokenBuilder.setup for ${this.token} -> ${recipient}`);
    this.openTokenChannels.push({ recipient: toBigInt(recipient), token: this.token });
    return this;
  }

  inputs(...notes: Note[]): this {
    for (const note of notes) {
      this.useNotes.push({ token: this.token, note });
    }
    return this;
  }

  deposit(...inputs: DepositInput[]): this {
    debugLog("builder", `TokenBuilder.deposit for ${this.token}`, inputs);
    for (const input of inputs) {
      this.deposits.push({ token: this.token, amount: input.amount });
      if (input.recipient !== undefined) {
        // similar to an explicit transfer
        this.createNotes.push({
          token: this.token,
          amount: input.amount,
          recipient: toBigInt(input.recipient),
        });
      }
    }
    return this;
  }

  withdraw(...outputs: WithdrawOutput[]): this {
    for (const output of outputs) {
      this.withdraws.push({
        token: this.token,
        recipient: toBigInt(output.recipient ?? this.parentBuilder.userAddress),
        amount: output.amount,
      });
    }
    return this;
  }

  transfer(...outputs: TransferOutput[]): this {
    for (const output of outputs) {
      if (isOpenNote(output)) {
        this.createNotes.push({
          token: this.token,
          recipient: toBigInt(output.recipient),
          amount: Open,
        });
      } else {
        this.createNotes.push({
          token: this.token,
          recipient: toBigInt(output.recipient),
          amount: output.amount as Amount,
        });
      }
    }
    return this;
  }

  surplusTo(recipient: StarknetAddress, withdraw?: boolean): this {
    this.surplusAction = { recipient: toBigInt(recipient), token: this.token, withdraw };
    return this;
  }

  with(token: StarknetAddress): TokenOperationsBuilder;
  with(token: StarknetAddress, ops: (t: TokenOperationsBuilder) => void): this;
  with(
    token: StarknetAddress,
    ops?: (t: TokenOperationsBuilder) => void
  ): TokenOperationsBuilder | this {
    if (ops) {
      ops(this.parentBuilder.with(token));
      return this;
    }
    return this.parentBuilder.with(token);
  }

  done(): PrivateTransfersBuilder {
    return this.parentBuilder;
  }

  async execute(options?: ExecuteOptions): Promise<ExecuteResult> {
    return this.parentBuilder.execute(options);
  }

  async createProofInvocation(options?: ExecuteOptions): Promise<ProofInvocationResult> {
    return this.parentBuilder.createProofInvocation(options);
  }

  async simulate(options: SimulateOptions): Promise<ExecuteResult> {
    return this.parentBuilder.simulate(options);
  }
}

// ============ Private Transfers Builder ============

export class PrivateTransfersBuilderImpl implements PrivateTransfersBuilder {
  public setViewingKey?: SetViewingKeyAction;
  public openChannels: OpenChannelAction[] = [];
  public invokeExternal?: InvokeAction;
  public computeAndInvokeAction?: ComputeAndInvokeAction;
  public tokenBuilders = new AddressMap<TokenOperationsBuilderImpl>(
    (token) => new TokenOperationsBuilderImpl(this, token)
  );

  // Default surplus recipient for all tokens
  public defaultSurplusAction?: SurplusAction;

  // Options passed at build time
  private buildOptions?: ExecuteOptions;

  constructor(
    private transfers: PrivateTransfersInterface,
    public readonly userAddress: StarknetAddress,
    options?: ExecuteOptions,
    private shadowAccountDeps?: {
      anonymizerAddress?: StarknetAddress;
      getViewingKey: () => Promise<ViewingKey>;
    }
  ) {
    this.buildOptions = options;
  }

  register(): this {
    this.setViewingKey = {};
    return this;
  }

  setup(recipient: StarknetAddress): this {
    this.openChannels.push({ recipient: toBigInt(recipient) });
    return this;
  }

  invoke(callBuilder: (args: InvokeCalldataBuilderArgs) => CallDetails): this {
    this.assertNoInvokePhaseAction();
    this.invokeExternal = {
      callBuilder,
    };
    return this;
  }

  computeAndInvoke(
    callBuilder: (args: InvokeCalldataBuilderArgs) => ComputeAndInvokeDetails
  ): this {
    this.assertNoInvokePhaseAction();
    this.computeAndInvokeAction = {
      callBuilder,
    };
    return this;
  }

  // `invoke` and `computeAndInvoke` both occupy the single invoke phase the contract allows
  // per transaction, so only one of them may be queued.
  private assertNoInvokePhaseAction(): void {
    if (this.invokeExternal !== undefined || this.computeAndInvokeAction !== undefined) {
      throw new Error(
        "At most one invoke-phase action (.invoke() / .computeAndInvoke()) per transaction; already set."
      );
    }
  }

  shadowAccounts(dappName: string | BigNumberish): ShadowAccountsBuilder {
    const deps = this.shadowAccountDeps;
    if (deps?.anonymizerAddress === undefined) {
      throw new Error(
        "shadowAccounts(...) requires `shadowAccountAnonymizerAddress` in the createPrivateTransfers config."
      );
    }
    return new ShadowAccountsBuilderImpl({
      builder: this,
      dappName,
      shadowAccountAnonymizerAddress: deps.anonymizerAddress,
      user: toBigInt(this.userAddress),
      getViewingKey: deps.getViewingKey,
    });
  }

  surplusTo(recipient: StarknetAddress, withdraw?: boolean): this {
    this.defaultSurplusAction = { recipient: toBigInt(recipient), token: undefined!, withdraw };
    return this;
  }

  with(token: StarknetAddress): TokenOperationsBuilder;
  with(token: StarknetAddress, ops: (t: TokenOperationsBuilder) => void): this;
  with(
    token: StarknetAddress,
    ops?: (t: TokenOperationsBuilder) => void
  ): TokenOperationsBuilder | this {
    const tokenBuilder = this.tokenBuilders.get(token)!;
    if (ops) {
      ops(tokenBuilder);
      return this;
    }
    return tokenBuilder;
  }

  private collectActionsAndOptions(options?: ExecuteOptions): {
    actions: Actions;
    mergedOptions: ExecuteOptions;
  } {
    const mergedOptions: ExecuteOptions = {
      ...this.buildOptions,
      ...options,
      autoDiscover: {
        ...this.buildOptions?.autoDiscover,
        ...options?.autoDiscover,
      },
    };

    const openTokenChannels: OpenTokenChannelAction[] = [];
    const deposits: DepositAction[] = [];
    const useNotes: UseNoteAction[] = [];
    const createNotes: CreateNoteAction[] = [];
    const withdraws: WithdrawAction[] = [];
    const surpluses: SurplusAction[] = [];

    for (const [token, tokenBuilder] of this.tokenBuilders.entries()) {
      debugLog("builder", `Collecting actions for ${token}`, {
        openTokenChannels: tokenBuilder.openTokenChannels,
        deposits: tokenBuilder.deposits.length,
      });
      openTokenChannels.push(...tokenBuilder.openTokenChannels);
      deposits.push(...tokenBuilder.deposits);
      useNotes.push(...tokenBuilder.useNotes);
      createNotes.push(...tokenBuilder.createNotes);
      withdraws.push(...tokenBuilder.withdraws);

      const surplusToAction = tokenBuilder.surplusAction ?? this.defaultSurplusAction;
      if (surplusToAction) {
        surpluses.push({ ...surplusToAction, token });
      }
    }

    const actions: Actions = {
      setViewingKey: this.setViewingKey,
      openChannels: this.openChannels,
      openTokenChannels,
      deposits,
      useNotes,
      createNotes,
      withdraws,
      surpluses,
      invoke: this.invokeExternal,
      computeAndInvoke: this.computeAndInvokeAction,
    };

    return { actions, mergedOptions };
  }

  async execute(options?: ExecuteOptions): Promise<ExecuteResult> {
    debugLog("builder", "PrivateTransfersBuilderImpl.execute called");
    const { actions, mergedOptions } = this.collectActionsAndOptions(options);
    return this.transfers.execute(actions, mergedOptions);
  }

  async createProofInvocation(options?: ExecuteOptions): Promise<ProofInvocationResult> {
    debugLog("builder", "PrivateTransfersBuilderImpl.createProofInvocation called");
    const { actions, mergedOptions } = this.collectActionsAndOptions(options);
    return this.transfers.createProofInvocation(actions, mergedOptions);
  }

  async simulate(options: SimulateOptions): Promise<ExecuteResult> {
    debugLog("builder", "PrivateTransfersBuilderImpl.simulate called");
    const { actions, mergedOptions } = this.collectActionsAndOptions();
    return this.transfers.simulate(actions, { ...mergedOptions, ...options });
  }
}
