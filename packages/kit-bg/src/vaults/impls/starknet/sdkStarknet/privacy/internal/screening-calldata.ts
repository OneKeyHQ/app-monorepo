/**
 * Packing of the screening attestation into `apply_actions` calldata.
 *
 * The attestation travels as a Serde-encoded `Option<ScreeningAttestation>`
 * appended after the action span: `[0x1]` when absent, `[0x0, issued_at,
 * sig_r, sig_s]` when present. It is a separately-deserialized parameter, not
 * part of the proof-committed action span, so it can be swapped (e.g. a
 * timestamp refresh) without re-proving.
 */

import { cairo, CairoOption, CairoOptionVariant, CallData } from "starknet";
import type { AdditionalData } from "./proving-service";
import { toHex } from "../utils/convert";

/**
 * Serde-encode the attestation from a prove response's `additional_data` as
 * the trailing calldata felts, hex-encoded to match the prover-produced
 * action felts they follow.
 */
export function screeningCalldataSuffix(additionalData?: AdditionalData): string[] {
  const signature = additionalData?.signature;
  const attestationOption =
    signature === undefined
      ? new CairoOption<never>(CairoOptionVariant.None)
      : new CairoOption(CairoOptionVariant.Some, {
          issued_at: signature.issued_at,
          signature: cairo.tuple(signature.sig_r, signature.sig_s),
        });
  return CallData.compile([attestationOption]).map((felt) => toHex(BigInt(felt)));
}
