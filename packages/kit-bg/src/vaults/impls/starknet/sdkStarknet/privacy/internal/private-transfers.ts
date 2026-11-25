/**
 * Real PrivateTransfers implementation using Starknet contracts.
 */

import type {
  Actions,
  ExecuteOptions,
  ExecuteResult,
  ProofProviderInterface,
  DiscoveryProviderInterface,
  ViewingKeyProvider,
  StarknetAddress,
  ProofInvocationResult,
  ProvingBlockId,
  PrivateTransfersUser,
  SimulateOptions,
  Proof,
} from "../interfaces";
import type { TypedContractV2 } from "starknet";
import { ActionCompiler } from "./compiler";
import { PrivacyPoolABI } from "./abi";
import { AbstractPrivateTransfers } from "./abstract-private-transfers";
import { CallMockProofProvider } from "./mock-proving";
import { debugLog } from "../utils/logging";
import type { ProofInvocationFactoryInterface } from "./proof-invocation-factory";
import { toBigInt, toHex } from "../utils/convert";
import { screeningCalldataSuffix } from "./screening-calldata";

// Export the specific typed contract type for the Privacy Pool
export type PrivacyPoolContract = TypedContractV2<typeof PrivacyPoolABI>;

export class PrivateTransfers extends AbstractPrivateTransfers {
  constructor(
    private readonly params: {
      account: PrivateTransfersUser;
      viewingKeyProvider: ViewingKeyProvider;
      provingProvider: ProofProviderInterface;
      discoveryProvider: DiscoveryProviderInterface;
      proofInvocationFactory: ProofInvocationFactoryInterface;
      poolContractAddress: StarknetAddress;
      shadowAccountAnonymizerAddress?: StarknetAddress;
    }
  ) {
    super(
      params.account.address,
      params.viewingKeyProvider,
      params.discoveryProvider,
      params.shadowAccountAnonymizerAddress
    );
  }

  private async getCompiler(): Promise<ActionCompiler> {
    const viewingKey = await this.params.viewingKeyProvider.getViewingKey();
    return new ActionCompiler(
      this.user,
      viewingKey,
      this.params.discoveryProvider,
      toBigInt(this.params.poolContractAddress)
    );
  }

  async createProofInvocation(
    actions: Actions,
    options?: Omit<ExecuteOptions, "provingBlockId">
  ): Promise<ProofInvocationResult> {
    // Get viewing key for both compiler and calldata
    const viewingKey = await this.params.viewingKeyProvider.getViewingKey();
    const compiler = new ActionCompiler(
      this.user,
      viewingKey,
      this.params.discoveryProvider,
      toBigInt(this.params.poolContractAddress)
    );

    // Compile actions
    const { clientActions, registry, warnings } = await compiler.compile(actions, options);

    // Create invocation for proving
    const details = await this.params.provingProvider.getDefaultDetails();
    const invocation = await this.params.proofInvocationFactory.create(
      { ...this.params.account, viewingKey },
      this.params.poolContractAddress,
      clientActions,
      details
    );

    return { invocation, registry, warnings };
  }

  // onekey: `override` required by the repo tsconfig (noImplicitOverride).
  override invalidateProofNonceCache(): void {
    this.params.provingProvider.invalidateNonceCache?.();
  }

  async executeWithInvocation(
    { invocation, registry, warnings }: ProofInvocationResult,
    provingBlockId?: ProvingBlockId
  ): Promise<ExecuteResult> {
    const proof = await this.params.provingProvider.prove(invocation, provingBlockId);
    return this.buildExecuteResult(proof, registry, warnings);
  }

  /**
   * Assemble the `apply_actions` call and `ExecuteResult` from a proof. Shared
   * by `executeWithInvocation` (real proof) and `simulate` (mock proof) so both
   * produce identical calldata — notably the trailing screening attestation.
   */
  private buildExecuteResult(
    proof: Proof,
    registry: ProofInvocationResult["registry"],
    warnings: ProofInvocationResult["warnings"]
  ): ExecuteResult {
    // proof.output is the L2-to-L1 message payload: [class_hash, ...serialized_actions].
    // Strip the class_hash prefix — apply_actions expects only Span<ServerAction>.
    const serverActionsCalldata = proof.output.slice(1);

    // Parse and log server actions for debugging
    const parsedOutput = () =>
      this.params.proofInvocationFactory.parseOutput(serverActionsCalldata);
    debugLog("private-transfers", "execute", "parsed server actions", parsedOutput);

    // apply_actions takes a trailing Serde-encoded Option<ScreeningAttestation>:
    // Some when the prover attached a screening signature, None otherwise.
    const screeningSuffix = screeningCalldataSuffix(proof.additionalData);

    return {
      callAndProof: {
        call: {
          contractAddress: toHex(this.params.poolContractAddress),
          entrypoint: "apply_actions",
          calldata: [...serverActionsCalldata, ...screeningSuffix],
        },
        proof,
      },
      registry,
      warnings,
    };
  }

  // onekey: `override` required by the repo tsconfig (noImplicitOverride).
  override async simulate(
    actions: Actions,
    options: ExecuteOptions & SimulateOptions
  ): Promise<ExecuteResult> {
    const { invocation, registry, warnings } = await this.createProofInvocation(actions, options);

    // Source chainId from the same provider the mock prover calls, so proof
    // facts and signature validation are computed for the chain that actually
    // executes the view call.
    const chainId = await options.node.getChainId();

    const mockProvider = new CallMockProofProvider(options.node, chainId, {
      validateSignature: options.validateSignature ?? false,
    });

    const proof = await mockProvider.prove(invocation, options.provingBlockId);
    return this.buildExecuteResult(proof, registry, warnings);
  }
}
