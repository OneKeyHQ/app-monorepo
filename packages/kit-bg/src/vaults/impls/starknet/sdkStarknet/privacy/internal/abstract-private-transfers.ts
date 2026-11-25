/**
 * Abstract base class for PrivateTransfers implementations
 *
 * Provides default implementations for discovery methods and builder creation,
 * leaving only the execute method as abstract for subclasses to implement.
 */

import type { BlockIdentifier } from "starknet";
import type {
  Actions,
  Channel,
  DiscoveryProviderInterface,
  ExecuteOptions,
  ExecuteResult,
  Note,
  PrivateTransfersBuilder,
  PrivateTransfersInterface,
  ProofInvocationResult,
  ProvingBlockId,
  SimulateOptions,
  StarknetAddress,
  StarknetAddressBigint,
  ViewingKey,
  ViewingKeyProvider,
} from "../interfaces";
import { SetupRequirement } from "../interfaces";
import { AddressMap } from "../utils/maps";
import { toBigInt } from "../utils/crypto";
import { PrivateTransfersBuilderImpl } from "./builders";
import type { ChannelCursor, NotesCursor, RecipientsFilter } from "./channel";

/**
 * Abstract base class that implements the common functionality for PrivateTransfers.
 * Subclasses only need to implement the execute method.
 */
export abstract class AbstractPrivateTransfers implements PrivateTransfersInterface {
  readonly user: StarknetAddressBigint;

  /** No-op in base; override in subclass when using a provider that caches nonce. */
  invalidateProofNonceCache(): void {}

  constructor(
    userAddress: StarknetAddress,
    protected readonly viewingKeyProvider: ViewingKeyProvider,
    protected readonly discoveryProvider: DiscoveryProviderInterface,
    protected readonly shadowAccountAnonymizerAddress?: StarknetAddress
  ) {
    this.user = toBigInt(userAddress);
  }

  /**
   * Get the current viewing key from the provider
   */
  protected async getViewingKey(): Promise<ViewingKey> {
    return await this.viewingKeyProvider.getViewingKey();
  }

  /**
   * Discover unspent notes per token
   */
  async discoverNotes(params: { since?: BlockIdentifier; cursor?: NotesCursor } = {}): Promise<{
    timestamp: BlockIdentifier;
    notes: AddressMap<Note[]>;
  }> {
    return this.discoveryProvider.discoverNotes(this.user, await this.getViewingKey(), params);
  }

  /**
   * Discover channels for one or more recipients
   */

  async discoverChannels(
    recipients: RecipientsFilter<StarknetAddress>,
    params?: { cursor?: ChannelCursor }
  ): Promise<{ timestamp: BlockIdentifier; channels?: AddressMap<Channel>; total?: number }> {
    return this.discoveryProvider.discoverChannels(
      this.user,
      await this.getViewingKey(),
      Array.isArray(recipients) ? recipients.map(toBigInt) : recipients,
      params
    );
  }

  /**
   * Check the setup requirements for a recipient and token
   */
  async discoverRequirement(
    recipient: StarknetAddress,
    token: StarknetAddress
  ): Promise<SetupRequirement> {
    return this.discoveryProvider.discoverRequirement(
      this.user,
      await this.getViewingKey(),
      toBigInt(recipient),
      toBigInt(token)
    );
  }

  /**
   * Create a builder for batching multiple operations
   */
  build(options?: ExecuteOptions): PrivateTransfersBuilder {
    return new PrivateTransfersBuilderImpl(this, this.user, options, {
      anonymizerAddress: this.shadowAccountAnonymizerAddress,
      getViewingKey: () => this.getViewingKey(),
    });
  }

  /**
   * Execute raw actions: compile, prove, and return the call+proof.
   */
  async execute(actions: Actions, options?: ExecuteOptions): Promise<ExecuteResult> {
    const invocationResult = await this.createProofInvocation(actions, options);
    return this.executeWithInvocation(invocationResult, options?.provingBlockId);
  }

  async simulate(
    _actions: Actions,
    _options: ExecuteOptions & SimulateOptions
  ): Promise<ExecuteResult> {
    throw new Error("simulate() is not supported by this implementation");
  }

  /**
   * Build a proof transaction for the raw actions - must be implemented by subclasses
   */
  abstract createProofInvocation(
    actions: Actions,
    options?: Omit<ExecuteOptions, "provingBlockId">
  ): Promise<ProofInvocationResult>;

  /**
   * Execute a pre-built proof invocation: prove it and return the call+proof ready for submission.
   */
  abstract executeWithInvocation(
    invocation: ProofInvocationResult,
    provingBlockId?: ProvingBlockId
  ): Promise<ExecuteResult>;
}
