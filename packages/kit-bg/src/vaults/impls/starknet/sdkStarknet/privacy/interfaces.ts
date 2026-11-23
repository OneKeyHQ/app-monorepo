import type {
  AccountInvocationsFactoryDetails,
  AllowArray,
  BigNumberish,
  BlockIdentifier,
  BlockNumber,
  Call,
  CallDetails,
  constants,
  ProviderInterface,
  SignerInterface,
} from "starknet";
import { ec } from "starknet";
import { AddressMap } from "./utils/index";
import type { OhttpOption } from "./internal/ohttp-client";
import type { AdditionalData, ProvingRetryOptions } from "./internal/proving-service";

export type Amount = bigint;

/**
 * Maximum valid viewing key value (half the STARK curve order).
 * Private keys must be in range [1, MAX_VIEWING_KEY].
 */
export const MAX_VIEWING_KEY = ec.starkCurve.CURVE.n / 2n;

/** Marker for creating an open note (a note whose amount is open and can be deposited into later) */
export const Open = Symbol("Open");
export type Open = typeof Open;

export const All = Symbol("All");
export type All = typeof All;

/**
 * Union that allows both the concrete Account class as well as the lighter AccountInterface.
 */
export type ViewingKey = BigNumberish;

export type StarknetAddress = BigNumberish;

/**
 * Minimal user identity required by private transfers.
 *
 * The SDK only needs the user's Starknet address and a signer capable of
 * signing proof invocations. A full `Account` instance is accepted by the
 * factory for backwards compatibility, but is not required.
 */
export interface PrivateTransfersUser {
  address: StarknetAddress;
  signer: SignerInterface;
}

/**
 * Result of setupRequirement - indicates what setup is needed before a transfer.
 * Values are ordered by priority (higher value = more setup needed).
 */
export enum SetupRequirement {
  /** Recipient is not registered */
  Register = 0,
  /** Need to setup initial channel*/
  SetupChannel = 1,
  /** Need to setup the token subchannel */
  SetupToken = 2,
  /** Ready to transfer - no setup needed */
  Ready = 3,
}

/** A Starknet address normalized to bigint (for use as Map keys, etc.) */
export type StarknetAddressBigint = bigint;

// Import and re-export from internal channel
import { Witness, Channel } from "./internal/channel";
import type { ChannelCursor, NotesCursor, RecipientsFilter } from "./internal/channel";
import type { INVOKE_TXN_V3 } from "@starknet-io/starknet-types-0101";
export { Witness, Channel };
export type { NotesCursor as DiscoveryCursor };

export type Note = {
  readonly id: NoteId;
  readonly amount: Amount;
  readonly created?: BlockNumber; // required to know maturity (10 blocks)
  readonly witness: Witness;
  readonly viewingKey?: ViewingKey; // in case the viewing key is different than the privacy pool's.
  readonly sender: StarknetAddress;
  readonly open?: boolean;
};

/** Unique identifier for a note, used for semi-transparent (preprepared) notes */
export type NoteId = BigNumberish;

export type Proof = {
  readonly data: string;
  /** L2-to-L1 message payload: [class_hash, ...serialized_server_actions]. */
  readonly output: string[];
  /** Proof facts from the proving service; must be included in the tx when submitting to the chain. */
  readonly proofFacts: string[];
  /**
   * Typed side-channel from the prove response. For screened deposits it
   * carries the screening signature; absent otherwise.
   */
  readonly additionalData?: AdditionalData;
};

/**
 * Payload to be wrapped in a transaction to send to Starknet
 */
export type CallAndProof = {
  readonly call: Call;
  readonly proof: Proof;
};

export type PrivateInvocationResult = {
  readonly invocationData: CallAndProof;
  readonly remainder?: Note;
};

export interface ViewingKeyProvider {
  getViewingKey(): Promise<ViewingKey>;
}

/**
 * Config for creating a production proving provider (ProvingServiceProofProvider).
 * Use this when you want the factory to instantiate the prover from a URL instead of passing an instance.
 */
export type ProofProviderConfig = {
  /** Base URL of the proving service (e.g. https://prover.example.com:3000). */
  url: string;
  /** Chain ID used for proof invocation details (e.g. SN_MAIN, SN_SEPOLIA). */
  chainId: constants.StarknetChainId;
  /** Request timeout in ms. Default 30_000. */
  requestTimeoutMs?: number;
  /** Default block identifier for proving when not provided in execute options. Default "latest". */
  blockIdentifier?: ProvingBlockId;
  /**
   * Optional RPC node URL used only to fetch the pool nonce (cached; use invalidateProofNonceCache() after nonce errors).
   * The pool contract address is taken from the enclosing createPrivateTransfers call.
   * When set, the nonce is fetched once and cached; call invalidateProofNonceCache() to force a refresh.
   */
  nodeUrl?: string;
  /** Enable OHTTP envelope encryption for the proving service. Pass `true` for defaults, or an object for custom relay/key config. */
  ohttp?: OhttpOption;
  /**
   * Retry policy for transient (service-busy `-32005` / HTTP 503) prove failures.
   * Pass `{ maxRetries: 0 }` to disable.
   */
  retry?: ProvingRetryOptions;
};

/**
 * Config for creating a production discovery provider (IndexerDiscoveryProvider).
 * Use this when you want the factory to instantiate discovery from a URL instead of passing an instance.
 */
export type DiscoveryProviderConfig = {
  /** Base URL of the discovery/indexer API. */
  url: string;
};

export interface PrivateRecipient {
  address: StarknetAddress;
  context: Channel;
}

/**
 * it is expected that the implementing object will receive an account signer instance to sign the invocation
 */
export interface ProveInterface {
  /**
   * Analogous to AccountInterface.execute. A default implementation will use the account signer and build an invocation with the privacy pool account address
   *
   * Customizations can add data to the call (e.g. fee withdrawal to the paymaster) before the user's signature.
   */
  prove(calls: AllowArray<Call>): Promise<Proof>;
}

// ============ Raw Actions (builder output, no context) ============

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type SetViewingKeyAction = {};

export type OpenChannelAction = {
  recipient: StarknetAddressBigint;
};

export type OpenTokenChannelAction = {
  recipient: StarknetAddressBigint;
  token: StarknetAddressBigint;
};

export type DepositAction = {
  token: StarknetAddressBigint;
  amount: Amount;
  noteId?: NoteId;
};

export type UseNoteAction = {
  token: StarknetAddressBigint;
  note: Note;
};

export type CreateNoteAction = {
  recipient: StarknetAddressBigint;
  token: StarknetAddressBigint;
} & ({ amount: Amount } | { amount: Open });

export type WithdrawAction = {
  recipient: StarknetAddressBigint;
  token: StarknetAddressBigint;
  amount: Amount;
};

export type SurplusAction = {
  recipient: StarknetAddressBigint;
  token: StarknetAddressBigint;
  withdraw?: boolean;
};

export type InvokeOpenNote = {
  noteId: NoteId;
  token: StarknetAddressBigint;
};

export type InvokeWithdrawal = {
  recipient: StarknetAddressBigint;
  token: StarknetAddressBigint;
  amount: Amount;
};

export type InvokeCalldataBuilderArgs = {
  openNotes: InvokeOpenNote[];
  withdrawals: InvokeWithdrawal[];
  poolAddress: StarknetAddressBigint;
};

export type InvokeAction = {
  callBuilder: (args: InvokeCalldataBuilderArgs) => CallDetails;
};

/**
 * Result of a `computeAndInvoke` call builder.
 * `computeAdditionalData` is forwarded to the target's `privacy_compute` (after the derived identity key);
 * `invokeAdditionalData` is forwarded to its `privacy_invoke_with_computation` (after the compute result).
 */
export type ComputeAndInvokeDetails = {
  contractAddress: string;
  computeAdditionalData?: CallDetails["calldata"];
  invokeAdditionalData?: CallDetails["calldata"];
};

export type ComputeAndInvokeAction = {
  callBuilder: (args: InvokeCalldataBuilderArgs) => ComputeAndInvokeDetails;
};

/** Actions - context comes from registry */
export type Actions = {
  setViewingKey?: SetViewingKeyAction;
  openChannels?: OpenChannelAction[];
  openTokenChannels?: OpenTokenChannelAction[];
  deposits?: DepositAction[];
  useNotes?: UseNoteAction[];
  createNotes?: CreateNoteAction[];
  withdraws?: WithdrawAction[];
  surpluses?: SurplusAction[];
  invoke?: InvokeAction;
  computeAndInvoke?: ComputeAndInvokeAction;
};

// ============ Auto-Discovery & Registry Types ============

/**
 * Discovery level controls when/whether to call the discovery service.
 * - 'none': Never call discovery. Missing data → error.
 * - 'missing': Only discover when data is missing from registry. Trust existing registry contents.
 * - 'refresh': Always discover. Use registry as optimization hint.
 */
export type DiscoveryLevel = "missing" | "refresh";

/**
 * Options for automatic discovery during execute.
 */
export type AutoDiscoveryOptions = {
  /** Discovery level for notes. 'all' means discover all tokens regardless if used in the actions */
  notes?: DiscoveryLevel | "all";
  /** Discovery level for recipient channels (includes self) */
  channels?: DiscoveryLevel;
};

/**
 * Auto-selection strategy for notes.
 * - 'all': Select all notes (requires surplus handling)
 * - 'naive': Select first notes until balance is non negative (may create surplus)
 */
export type AutoSelectionStrategy = "all" | "naive" /*| "exact"*/; //

/**
 * Registry holding the user's private state: channels and notes.
 * Passed to execute() for context resolution and updated with new state.
 */
export type PrivateRegistry = {
  /** Channels by recipient address */
  channels: AddressMap<Channel>;
  /** Notes by token address */
  notes: AddressMap<Note[]>;
  /** Cursor for discovery */
  cursor?: NotesCursor;
};

/** Create an empty private registry */
export function createEmptyRegistry(): PrivateRegistry {
  return {
    channels: new AddressMap<Channel>(),
    notes: new AddressMap<Note[]>(() => []),
  };
}

/**
 * Block reference for proving. Passed as block_id to the proving service.
 * Server currently supports: "latest" | { block_number: N } | { block_hash: "0x..." }.
 */
// TODO: Add latest-verifiable to the proving service.
export type ProvingBlockId = BlockIdentifier;

/**
 * Options for building and executing private transfers.
 */
export type ExecuteOptions = {
  /** adds a set viewing key action if the user is not in the registry */
  autoRegister?: boolean;
  /** Auto-discovery options */
  autoDiscover?: AutoDiscoveryOptions;
  /** If true, add OpenChannel/OpenTokenChannel actions implicitly when missing */
  autoSetup?: boolean;
  /** If defined, auto select notes from registry. **/
  autoSelectNotes?: AutoSelectionStrategy;
  /** Registry for context/notes lookup. Updated during execute unless registryConst is true. */
  registry?: PrivateRegistry;
  /** If true, registry is not mutated; a new one is returned instead */
  registryConst?: boolean;
  /** If defined, use the given block id for proving */
  provingBlockId?: ProvingBlockId;
};

export type SimulateOptions = {
  /**
   * Node used to call the pool's view function for fee estimation. Required because the minimal
   * `PrivateTransfersUser` ({ address, signer }) carries no node of its own.
   */
  node: ProviderInterface;
  /** When true, validate the user's signature during simulation. Default: false. */
  validateSignature?: boolean;
};

export type Warning = {
  code: WarningCode;
  message: string;
};

export enum WarningCode {
  USER_LINKAGE = "USER_LINKAGE",
}
/**
 * Result of execute, including the call/proof and updated registry.
 */
export type ExecuteResult = {
  callAndProof: CallAndProof;
  /** Updated registry (new object if registryConst was true, same object otherwise) */
  registry: PrivateRegistry;

  warnings: Warning[];
};

export type ProofInvocationResult = {
  invocation: ProofInvocation;
  registry: PrivateRegistry;
  warnings: Warning[];
};

/**
 * Simple interface for simple private transfer scenarios
 */
export interface SimplePrivateTransfersInterface {
  readonly user: StarknetAddress;
  readonly registry: PrivateRegistry;

  /**
   * deposit tokens into the privacy pool
   *
   * v1: the recipient is the same as the account address or has setup a semi transparent note for the deposit.
   */
  deposit(token: StarknetAddress, amount: Amount): Promise<ExecuteResult>;

  /**
   * Withdraw tokens from the privacy pool
   */
  withdraw(
    token: StarknetAddress,
    recipient: StarknetAddress,
    amount: Amount | All
  ): Promise<ExecuteResult>;

  /**
   * transfer tokens from the privacy pool to a single recipient.
   */
  transfer(
    token: StarknetAddress,
    recipient: StarknetAddress,
    amount: Amount | All
  ): Promise<ExecuteResult>;

  /**
   * will withdraw to the contract in `executor` and then deposit to the privacy pool in `toToken`
   */
  swap(
    fromToken: StarknetAddress,
    fromAmount: Amount,
    toToken: StarknetAddress,
    executor: StarknetAddress
  ): Promise<ExecuteResult>;
}

/**
 * Main interface for clients to use. It is stateless.
 * The methods call the proof provider to generate a proof and prepare a public call to send to Starknet.
 *
 * The wallet is in charge of:
 *   - storing state (channels, notes)
 *   - executing public transactions
 *   - selecting notes to spend
 *   - mark notes as spent
 *   -
 *
 * Matching private contract calls:
 *   fn deposit(addruser, kuser, i, token, amount)
 *   fn withdraw(addrowner, addrrecipient, kowner, note: (j: channel index, i: note index))
 *   fn transfer(addrowner, kowner, notes_to_use: Span<(j, i)>, notes_to_create: Span<(addrrecipient, token, i, amount)>)
 */
export interface PrivateTransfersInterface {
  /**
   * expected properties to be set by the implementing object
  readonly prover: ProveInterface;
  readonly viewingSigner: ViewingKey;
  readonly discoveryProvider: DiscoveryProviderInterface;
  readonly pool: StarknetAddress;
  */
  readonly user: StarknetAddress;

  /**
   * given a recipient and token, check if there needs to be a setup for the recipient and token.
   * @returns SetupRequirement
   * @throws if the user is not registered
   */
  discoverRequirement(
    recipient: StarknetAddress,
    token: StarknetAddress
  ): Promise<SetupRequirement>;

  /**
   * Discover unspent notes per token
   *
   */
  discoverNotes(params?: {
    cursor?: NotesCursor;
    tokens?: StarknetAddressBigint[];
    blockIdentifier?: BlockIdentifier;
  }): Promise<{
    timestamp: BlockIdentifier;
    notes: AddressMap<Note[]>;
  }>;

  /**
   * Discover channels for one or more recipients
   */
  discoverChannels(
    recipients: RecipientsFilter<StarknetAddress>,
    params?: { cursor?: ChannelCursor; blockIdentifier?: BlockIdentifier }
  ): Promise<{ timestamp: BlockIdentifier; channels?: AddressMap<Channel>; total?: number }>;

  /**
   * Execute raw actions. The implementation:
   * 1. Compiles actions (resolves contexts from registry, openChannels, autoSetup, or discovery)
   * 2. Validates the compiled actions
   * 3. Executes on the pool
   * 4. Returns result with updated registry
   */
  execute(actions: Actions, options?: ExecuteOptions): Promise<ExecuteResult>;

  /**
   * Simulate a private transaction to estimate gas costs without real proof generation.
   * Uses a mock proof provider internally — the returned CallAndProof has the same
   * calldata structure as a real transaction, suitable for fee estimation.
   */
  simulate(actions: Actions, options: ExecuteOptions & SimulateOptions): Promise<ExecuteResult>;

  /**
   * Return the transaction to be proven so it can be sent independently to the prover
   */
  createProofInvocation(
    actions: Actions,
    options?: Omit<ExecuteOptions, "provingBlockId">
  ): Promise<ProofInvocationResult>;

  /**
   * Execute a pre-built proof invocation: prove it and return the call+proof ready for submission.
   */
  executeWithInvocation(
    invocation: ProofInvocationResult,
    provingBlockId?: ProvingBlockId
  ): Promise<ExecuteResult>;

  /**
   * Clear the cached pool nonce so the next createProofInvocation/execute fetches a fresh one.
   * Call this before retrying after a submission failure caused by a stale nonce.
   */
  invalidateProofNonceCache(): void;

  /** Create a builder for batching multiple operations */
  build(options?: ExecuteOptions): PrivateTransfersBuilder;
}

/** A shadow account: its `nonce` for the dapp and the deployed `address`. */
export type ShadowAccount = { nonce: number; address: StarknetAddressBigint };

/**
 * How much of the shadow account's balance a settled open note collects, per the anonymizer's
 * `CollectPolicy`: `all` — the shadow account's entire token balance; `diff` — only the balance gained
 * during this interaction; `exact` — the given amount. A single policy applies to every open note
 * settled by a {@link ShadowAccountsBuilder.invoke}.
 */
export type CollectPolicy = { type: "all" } | { type: "diff" } | { type: "exact"; amount: Amount };

/**
 * Shadow account operations for one user + dapp, driven through the shadow account anonymizer contract.
 * Each `nonce` maps to a distinct, deterministic shadow account address.
 */
export interface ShadowAccountsBuilder {
  /**
   * Return the nonce-independent commitment for this user + dapp:
   * `hash(identity_key, dappName)`.
   *
   * Computed locally in TypeScript; does not call the anonymizer contract.
   */
  partialCommitment(): Promise<bigint>;

  /**
   * Return the full shadow account commitment for `nonce`:
   * `hash(partialCommitment(), nonce)`.
   *
   * Computed locally in TypeScript; does not call the anonymizer contract.
   */
  commitment(nonce: BigNumberish): Promise<bigint>;

  /**
   * Queue a `computeAndInvoke` against the shadow account for `nonce`: run `calls` through it and
   * settle the proceeds into the open notes created in the same transaction. `collectPolicy` (one
   * policy for all of the transaction's open notes; default `{ type: "all" }`) selects how much of
   * the shadow account's balance each note collects. Returns the builder so the caller can add the
   * open-note creation (e.g. `.with(token).transfer({ recipient, amount: Open })`) and `.execute()`.
   */
  invoke(
    nonce: BigNumberish,
    options: { calls: Call[]; collectPolicy?: CollectPolicy }
  ): PrivateTransfersBuilder;
}

// ============ Builder Types ============

/**
 * Output specification for transfer/withdraw operations
 */
export type TransferOutput = { recipient: StarknetAddress } & (
  | { amount: Amount }
  | { amount: Open }
);
export type WithdrawOutput = { recipient?: StarknetAddress; amount: Amount };
export type DepositInput = { recipient?: StarknetAddress; amount: Amount };

/**
 * Token-specific sub-builder for operations on a single token.
 * All methods return the builder for chaining.
 *
 * @example
 * // Transfer 10 STRK to Alice and 20 STRK to Bob using 2 notes
 * .with(STRK)
 *   .inputs(note1, note2)
 *   .transfer({ recipient: alice, amount: 10n }, { recipient: bob, amount: 20n })
 */
export interface TokenOperationsBuilder {
  /** Setup this token in recipient's channel */
  setup(recipient: StarknetAddress): this;

  /** Specify input notes for this token. If not called and autoSelectNotes is enabled, notes are auto-selected. */
  inputs(...notes: Note[]): this;

  /**
   * Deposit this token.
   * @param inputs Array of inputs to deposit. Each input can be a recipient address or a note id.
   */
  deposit(...inputs: DepositInput[]): this;

  /** Withdraw this token to one or more public addresses */
  withdraw(...outputs: WithdrawOutput[]): this;

  /**
   * Transfer this token privately to one or more recipients.
   * Context for each recipient is resolved from registry or discovery.
   */
  transfer(...outputs: TransferOutput[]): this;

  /**
   * Set the recipient for any surplus for this token.
   * Overrides the top-level surplusTo for this specific token.
   * If inputs exceed outputs, a CreateNoteAction is automatically added for the difference.
   */
  surplusTo(recipient: StarknetAddress, withdraw?: boolean): this;

  /** Switch to another token (fluent style) */
  with(token: StarknetAddress): TokenOperationsBuilder;
  /** Switch to another token with callback (block style, prettier-friendly) */
  with(token: StarknetAddress, ops: (t: TokenOperationsBuilder) => void): this;

  /** End the token-specific operations and return the builder */
  done(): PrivateTransfersBuilder;

  /** Execute all queued operations */
  execute(options?: ExecuteOptions): Promise<ExecuteResult>;

  /** Build proof invocation without executing */
  createProofInvocation(options?: ExecuteOptions): Promise<ProofInvocationResult>;

  /** Simulate all queued operations for fee estimation without real proof generation */
  simulate(options: SimulateOptions): Promise<ExecuteResult>;
}

/**
 * Builder for batching multiple private transfer operations.
 *
 * Use `.with(token)` to start token-specific operations.
 *
 * @example Simple deposit (fluent style - good for one-liners)
 * ```ts
 * await transfers.build().with(STRK).deposit(100n).execute();
 * ```
 *
 * @example Simple deposit (block style - prettier-friendly)
 * ```ts
 * await transfers.build()
 *   .with(STRK, t => t
 *     .deposit(100n))
 *   .execute();
 * ```
 *
 * @example Register and setup a new recipient
 * ```ts
 * await transfers.build({ autoSetup: true })
 *   .register()
 *   .setup(BOB_ADDRESS)
 *   .with(STRK, t => t
 *     .setup(BOB_ADDRESS)
 *     .deposit(100n, BOB_ADDRESS))
 *   .execute();
 * ```
 *
 * @example Transfer to multiple recipients
 * ```ts
 * // Transfer 10 STRK to Alice and 20 ETH to Bob using 3 notes
 * await transfers.build()
 *   .with(STRK, t => t
 *     .inputs(strkNote)
 *     .transfer({ recipient: alice, amount: 10n }))
 *   .with(ETH, t => t
 *     .inputs(ethNote1, ethNote2)
 *     .transfer({ recipient: bob, amount: 20n }))
 *   .execute();
 * ```
 *
 * @example Partial withdrawal with remainder
 * ```ts
 * await transfers.build()
 *   .with(STRK, t => t
 *     .inputs(note100Strk)
 *     .withdraw({ recipient: self, amount: 50n })
 *     .transfer({ recipient: self, amount: 25n })
 *     .transfer({ recipient: self, amount: 25n }))
 *   .execute();
 * ```
 *
 * @example Swap
 * ```ts
 * // Prepare for swap: withdraw STRK to swap anonymizer, deposit result back
 * await transfers.build()
 *   .with(STRK, t => t
 *     .inputs(strkNote)
 *     .withdraw({ recipient: swapAnonymizer, amount: 10n }))
 *   .with(BTC, t => t
 *     .deposit(open)) // semi-transparent note for swap result
 *   .invoke(({ openNotes, withdrawals, poolAddress }) => ({
 *       contractAddress: swapAnonymizer,
 *       calldata: [...]
 *   }))
 *   .execute();
 * ```
 */
export interface PrivateTransfersBuilder {
  /** Register the account in the privacy pool */
  register(): this;

  /** Setup initial channel for a new recipient. */
  setup(recipient: StarknetAddress): this;

  /** Add a call to `privacy_invoke` entrypoint that will run on starknet after the private operations are executed */
  invoke(callBuilder: (args: InvokeCalldataBuilderArgs) => CallDetails): this;

  /**
   * Add a `privacy_invoke_with_computation` call that runs on starknet after the private
   * operations: the pool first queries the target's `privacy_compute` (with the derived
   * identity key and `computeAdditionalData`), then invokes it with the compute result and `invokeAdditionalData`.
   * Mutually exclusive with `invoke` — at most one invoke-phase action per transaction.
   */
  computeAndInvoke(callBuilder: (args: InvokeCalldataBuilderArgs) => ComputeAndInvokeDetails): this;

  /**
   * Shadow account operations scoped to a single dapp.
   *
   * `dappName` scopes the derived shadow accounts to one dapp (a felt; a plain string is encoded as a
   * Cairo short string). Requires `shadowAccountAnonymizerAddress` in the factory config; throws
   * otherwise.
   */
  shadowAccounts(dappName: string | BigNumberish): ShadowAccountsBuilder;

  /**
   * Set the default recipient for any surplus across all tokens.
   * If inputs exceed outputs for a token, a CreateNoteAction is automatically added for the difference.
   * Can be overridden per-token using TokenOperationsBuilder.surplusTo().
   */
  surplusTo(recipient: StarknetAddress, withdraw?: boolean): this;

  /** Start token-specific operations (fluent style) */
  with(token: StarknetAddress): TokenOperationsBuilder;
  /** Start token-specific operations with callback (block style, prettier-friendly) */
  with(token: StarknetAddress, ops: (t: TokenOperationsBuilder) => void): this;

  /** Execute all queued operations and return the results */
  execute(options?: ExecuteOptions): Promise<ExecuteResult>;

  /** Build proof invocation without executing */
  createProofInvocation(options?: ExecuteOptions): Promise<ProofInvocationResult>;

  /** Simulate all queued operations for fee estimation without real proof generation */
  simulate(options: SimulateOptions): Promise<ExecuteResult>;
}

/** INVOKE branch of AccountInvocationItem; used for proof invocations and buildTransaction. */
export type ProofInvocation = INVOKE_TXN_V3;

/**
 * Factory details for creating proof invocations.
 * Extends AccountInvocationsFactoryDetails with chainId for signing.
 */
export type ProofInvocationFactoryDetails = AccountInvocationsFactoryDetails & {
  chainId: constants.StarknetChainId;
};

////// The following are more likely to change /////////

/**
 * Operator API contract — the proving service must implement this surface.
 */
export interface ProofProviderInterface {
  /** Get the default factory details for creating proof invocations. May fetch and cache the pool nonce when configured with a nodeUrl. */
  getDefaultDetails(): Promise<ProofInvocationFactoryDetails>;
  /** Prove the given invocation against the given block id. If no block id is provided, use the default block identifier defined in the provider. */
  prove(invocation: ProofInvocation, blockIdentifier?: ProvingBlockId): Promise<Proof>;
  /** Clear the cached nonce so the next getDefaultDetails() fetches a fresh one. Optional — only providers that cache nonce need to implement this. */
  invalidateNonceCache?(): void;
}

export interface DiscoveryProviderInterface {
  /**
   * Discover unspent notes per token
   */
  discoverNotes(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    params?: {
      cursor?: NotesCursor;
      tokens?: StarknetAddressBigint[];
      blockIdentifier?: BlockIdentifier;
    }
  ): Promise<{
    timestamp: BlockIdentifier;
    notes: AddressMap<Note[]>;
    cursor: NotesCursor;
  }>;

  /**
   * Discover channels for one or more recipients.
   * Pass "all" to discover all outgoing channels by iterating through the outgoing channel map.
   */
  discoverChannels(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    recipients: RecipientsFilter,
    params?: { cursor?: ChannelCursor; blockIdentifier?: BlockIdentifier }
  ): Promise<{ timestamp: BlockIdentifier; channels?: AddressMap<Channel>; total?: number }>;

  /**
   * Check the setup requirements for a recipient.
   *
   * @param recipient - The recipient to check the setup requirements for. if self, check for 'address'
   */
  discoverRequirement(
    address: StarknetAddressBigint,
    viewingKey: ViewingKey,
    recipient: StarknetAddressBigint,
    token: StarknetAddressBigint
  ): Promise<SetupRequirement>;
}

type BlobT = string | Uint8Array;

export type Blob<B extends BlobT> = B & { readonly __blob: unique symbol };

export type Serde<T, B extends BlobT> = {
  encode(from: T): Blob<B>;
  decode(from: Blob<B>): T;
};
export type WitnessSerde<B extends BlobT = string> = Serde<Witness, B>;
export type ChannelSerde<B extends BlobT = string> = Serde<Channel, B>;
