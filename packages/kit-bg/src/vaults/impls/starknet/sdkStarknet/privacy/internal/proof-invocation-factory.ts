/**
 * ProofInvocationFactory - Creates invocation data for proving.
 *
 * Abstracts how client actions are transformed into data for the proof provider.
 * - Starknet implementation: serializes to Cairo calldata and builds an invocation
 * - Mock implementation: passes through client actions directly
 */

import type {
  BigNumberish,
  CallResult,
  SignerInterface,
  V3InvocationsSignerDetails,
} from "starknet";
import type { constants } from "starknet";
import { CallData, ETransactionVersion, hash, stark } from "starknet";

import { serializeClientActions } from "./serialization";
import { PrivacyPoolABI } from "./abi";
import type {
  ProofInvocation,
  ProofInvocationFactoryDetails,
  StarknetAddress,
} from "../interfaces";
import { toBigInt } from "../utils/crypto";
import { ClientAction } from "./client-actions";
import { toHex } from "../utils/convert";

/** Default L2 gas max amount for proof invocations */
const DEFAULT_L2_GAS_MAX_AMOUNT = 100_000_000n;

/** Hardcoded nonce for proof invocations (no chain fetch). */
const PROOF_INVOCATION_NONCE = 0n;

/**
 * Build default proof invocation factory details for a given chain.
 * Plain helper so providers only need to pass their chainId.
 */
export function getDefaultProofDetails(
  chainId: constants.StarknetChainId
): ProofInvocationFactoryDetails {
  return {
    versions: [ETransactionVersion.V3],
    nonce: PROOF_INVOCATION_NONCE,
    skipValidate: true,
    resourceBounds: {
      l1_gas: { max_amount: 1n, max_price_per_unit: 0n },
      l2_gas: { max_amount: DEFAULT_L2_GAS_MAX_AMOUNT, max_price_per_unit: 0n },
      l1_data_gas: { max_amount: 1n, max_price_per_unit: 0n },
    },
    tip: 0n,
    paymasterData: [],
    accountDeploymentData: [],
    nonceDataAvailabilityMode: "L1",
    feeDataAvailabilityMode: "L1",
    version: ETransactionVersion.V3,
    chainId,
  };
}

/**
 * Minimal user info needed for creating a proof invocation.
 */
export interface ProofUser {
  address: BigNumberish;
  signer: SignerInterface;
  viewingKey: BigNumberish;
}

/**
 * Factory interface for creating proof invocation data.
 */
export interface ProofInvocationFactoryInterface {
  create(
    user: ProofUser,
    poolAddress: StarknetAddress,
    clientActions: ClientAction[],
    details: ProofInvocationFactoryDetails
  ): Promise<ProofInvocation>;

  /**
   * Parse proof output for logging/debugging.
   * Returns the decoded server actions.
   */
  parseOutput(output: string[]): CallResult;
}

/**
 * Build __execute__ calldata wrapping a single Call to compile_actions.
 * Layout: [array_len=1, to, selector, inner_calldata_len, ...inner_calldata]
 */
export function compileExecuteCalldata(
  poolAddress: string,
  executeViewCalldata: string[]
): string[] {
  const callDataCompiler = new CallData(PrivacyPoolABI);
  return callDataCompiler.compile("__execute__", [
    [
      {
        to: poolAddress,
        selector: hash.getSelectorFromName("compile_actions"),
        calldata: executeViewCalldata,
      },
    ],
  ]);
}

/**
 * Extract inner compile_actions calldata from __execute__'s Array<Call> calldata.
 * Layout: [array_len=1, to, selector, inner_calldata_len, ...inner_calldata]
 */
export function extractExecuteViewCalldata(executeCalldata: string[]): string[] {
  const innerCalldataLength = Number(BigInt(executeCalldata[3]));
  return executeCalldata.slice(4, 4 + innerCalldataLength);
}

/**
 * Starknet implementation - serializes client actions to an invocation with signature.
 */
export class ProofInvocationFactory implements ProofInvocationFactoryInterface {
  async create(
    user: ProofUser,
    poolAddress: StarknetAddress,
    clientActions: ClientAction[],
    details: ProofInvocationFactoryDetails
  ): Promise<ProofInvocation> {
    const cairoActions = serializeClientActions(clientActions);
    const callDataCompiler = new CallData(PrivacyPoolABI);
    const userAddress = toBigInt(user.address);
    const poolAddressHex = toHex(poolAddress);

    const executeViewCalldata = callDataCompiler.compile("compile_actions", [
      userAddress,
      user.viewingKey,
      cairoActions,
    ]);
    const compiledCalldata = compileExecuteCalldata(poolAddressHex, executeViewCalldata).map((v) =>
      toHex(v)
    );

    const nonce = BigInt(details.nonce ?? PROOF_INVOCATION_NONCE);
    const detailsWithNonce = { ...details, nonce };

    // Sign the transaction using details from the proof provider
    // signTransaction internally calls getExecuteCalldata which wraps the call
    // into Array<Call> format — the same layout as compiledCalldata. So we pass
    // the inner executeViewCalldata here, not the already-wrapped compiledCalldata.
    const signature = await user.signer.signTransaction(
      [
        {
          contractAddress: poolAddressHex,
          entrypoint: "compile_actions",
          calldata: executeViewCalldata,
        },
      ],
      {
        walletAddress: poolAddressHex,
        cairoVersion: "1",
        ...detailsWithNonce,
      } as V3InvocationsSignerDetails
    );

    const rb = detailsWithNonce.resourceBounds ?? {
      l1_gas: { max_amount: 0n, max_price_per_unit: 0n },
      l2_gas: { max_amount: 0n, max_price_per_unit: 0n },
      l1_data_gas: { max_amount: 0n, max_price_per_unit: 0n },
    };
    return {
      type: "INVOKE",
      sender_address: poolAddressHex,
      calldata: compiledCalldata,
      signature: stark.formatSignature(signature),
      nonce: toHex(detailsWithNonce.nonce ?? 0n),
      resource_bounds: {
        l1_gas: {
          max_amount: toHex(rb.l1_gas.max_amount),
          max_price_per_unit: toHex(rb.l1_gas.max_price_per_unit),
        },
        l2_gas: {
          max_amount: toHex(rb.l2_gas.max_amount),
          max_price_per_unit: toHex(rb.l2_gas.max_price_per_unit),
        },
        l1_data_gas: {
          max_amount: toHex(rb.l1_data_gas?.max_amount ?? 0n),
          max_price_per_unit: toHex(rb.l1_data_gas?.max_price_per_unit ?? 0n),
        },
      },
      tip: toHex(detailsWithNonce.tip ?? 0n),
      paymaster_data: (detailsWithNonce.paymasterData ?? []).map((x) => toHex(x)),
      account_deployment_data: (detailsWithNonce.accountDeploymentData ?? []).map((x) => toHex(x)),
      nonce_data_availability_mode: detailsWithNonce.nonceDataAvailabilityMode ?? "L1",
      fee_data_availability_mode: detailsWithNonce.feeDataAvailabilityMode ?? "L1",
      version: "0x3",
    };
  }

  parseOutput(output: string[]): CallResult {
    const decoder = new CallData(PrivacyPoolABI);
    return decoder.decodeParameters("core::array::Span::<privacy::actions::ServerAction>", output);
  }
}
