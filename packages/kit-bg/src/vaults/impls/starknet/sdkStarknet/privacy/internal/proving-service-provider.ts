/**
 * Proof provider that calls a remote proving service (JSON-RPC starknet_proveTransaction).
 */

import type { constants } from "starknet";
import { RpcProvider } from "starknet";
import type {
  Proof,
  ProofInvocationFactoryDetails,
  ProvingBlockId,
  ProofInvocation,
  ProofProviderInterface,
  StarknetAddress,
} from "../interfaces";
import { toHex } from "../utils/convert";
import { getDefaultProofDetails } from "./proof-invocation-factory";
import { OhttpClient, type OhttpOption } from "./ohttp-client";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  ProvingService,
  type ProvingRetryOptions,
  type ProveTransport,
} from "./proving-service";

/** Options for ProvingServiceProofProvider. */
export type ProvingServiceProofProviderOptions = {
  /** Request timeout in ms. */
  requestTimeoutMs?: number;
  /**
   * Default block identifier for proving. Sent as block_id: "latest" | { block_number } | { block_hash }.
   * Used when `blockIdentifier` is not provided in `prove()`.
   * Default `"latest"`.
   */
  // TODO: Change default to latest-verifiable.
  blockIdentifier?: ProvingBlockId;
  /**
   * Optional RPC node URL used to fetch the pool nonce (cached; use invalidateNonceCache() after
   * nonce errors). Requires `poolAddress` to be set. When both are provided, getDefaultDetails()
   * returns details with the fetched nonce; no provider on account or factory needed.
   */
  nodeUrl?: string;
  /**
   * Pool contract address used for nonce fetching. Required when `nodeUrl` is set.
   */
  poolAddress?: StarknetAddress;
  /** Enable OHTTP envelope encryption. Pass `true` for defaults, or an object for custom relay/key config. */
  ohttp?: OhttpOption;
  /**
   * Retry policy for transient (service-busy `-32005` / HTTP 503) prove failures.
   * Pass `{ maxRetries: 0 }` to disable.
   */
  retry?: ProvingRetryOptions;
  // onekey: added; lets a non-JSON-RPC prover plug in.
  /**
   * Replaces the built-in JSON-RPC client (e.g. StarkscanProvingService).
   * When set, `provingServiceUrl`, `ohttp`, `requestTimeoutMs` and `retry` are ignored.
   */
  transport?: ProveTransport;
};

/**
 * Proof provider that sends the invocation to a remote proving service (JSON-RPC)
 * and returns the STARK proof. Server actions for execute_actions come from the
 * L2-to-L1 message payload (from_address = pool).
 *
 * @param provingServiceUrl - Full base URL of the proving service (e.g. https://prover.example.com:3000)
 */
export class ProvingServiceProofProvider implements ProofProviderInterface {
  // onekey: typed as the transport seam so an injected transport fits.
  private readonly provingService: ProveTransport;
  private readonly blockIdentifier: ProvingBlockId;
  private readonly rpcProvider: RpcProvider | null;
  private readonly poolAddressHex: string | null;
  private cachedNonce: bigint | null = null;

  constructor(
    provingServiceUrl: string,
    private readonly chainId: constants.StarknetChainId,
    options: ProvingServiceProofProviderOptions = {}
  ) {
    let ohttpClient: OhttpClient | undefined;
    // onekey: no OHTTP client when an injected transport replaces ProvingService.
    if (options.ohttp && !options.transport) {
      const ohttpOptions =
        typeof options.ohttp === "object"
          ? { relayUrl: options.ohttp.relayUrl, publicKeyConfig: options.ohttp.publicKeyConfig }
          : undefined;
      ohttpClient = new OhttpClient(provingServiceUrl, ohttpOptions);
    }

    // onekey: prefer the injected transport.
    this.provingService =
      options.transport ??
      new ProvingService({
        baseUrl: provingServiceUrl,
        requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
        ohttpClient,
        retry: options.retry,
      });
    this.blockIdentifier = options.blockIdentifier ?? "latest";
    if (options.nodeUrl != null) {
      if (options.poolAddress == null) {
        throw new Error("ProvingServiceProofProvider: nodeUrl requires poolAddress to be set");
      }
      this.rpcProvider = new RpcProvider({ nodeUrl: options.nodeUrl });
      this.poolAddressHex = toHex(options.poolAddress);
    } else {
      this.rpcProvider = null;
      this.poolAddressHex = null;
    }
  }

  invalidateNonceCache(): void {
    this.cachedNonce = null;
  }

  async getDefaultDetails(): Promise<ProofInvocationFactoryDetails> {
    const base = getDefaultProofDetails(this.chainId);
    if (this.rpcProvider == null || this.poolAddressHex == null) {
      return base;
    }
    if (this.cachedNonce == null) {
      this.cachedNonce = BigInt(
        await this.rpcProvider.getNonceForAddress(this.poolAddressHex, "latest")
      );
    }
    return { ...base, nonce: this.cachedNonce };
  }

  async prove(invocation: ProofInvocation, blockIdentifier?: ProvingBlockId): Promise<Proof> {
    const blockId = blockIdentifier ?? this.blockIdentifier;

    const result = await this.provingService.proveTransaction(blockId, invocation);

    // L2-to-L1 message payload from the pool: [class_hash, ...serialized_actions].
    // The consumer strips the class_hash prefix before calling apply_actions.
    // TODO: Generalize this to support other projects.
    const poolAddressHex = toHex(invocation.sender_address);
    const poolMessage = result.l2_to_l1_messages?.find(
      (m) => m.from_address?.toLowerCase() === poolAddressHex.toLowerCase()
    );
    const output = poolMessage?.payload ?? [];

    const proofFacts = result.proof_facts ?? [];

    return {
      data: result.proof,
      output,
      proofFacts,
      additionalData: result.additional_data,
    };
  }
}
