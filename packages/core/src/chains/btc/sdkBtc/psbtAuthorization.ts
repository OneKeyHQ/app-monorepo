import { scriptPkToAddress } from '.';

import BigNumber from 'bignumber.js';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { isEqual } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getPsbtInputUtxo } from './providerUtils';

import type { ITxInputToSign } from '../../../types';
import type { IBtcOutput } from '../types';
import type { networks } from 'bitcoinjs-lib';

// What a signature commits to on the output side. This, not the PSBT as the
// dapp presented it, bounds what the signer can lose: outputs outside the
// commitment can be replaced after signing.
export enum EBtcPsbtSighashFamily {
  // DEFAULT / ALL, with or without ANYONECANPAY: every output is committed.
  All = 'all',
  // SINGLE, with or without ANYONECANPAY: only the output at the signed
  // input's index is committed.
  Single = 'single',
}

export type IBtcPsbtSighashClass = {
  family: EBtcPsbtSighashFamily;
  anyoneCanPay: boolean;
};

export type IBtcPsbtSignPolicyViolation = {
  index: number;
  message: string;
};

export type IBtcPsbtAuthorizedInput = {
  index: number;
  // satoshi, decimal string
  value: string;
  address: string;
  // SIGHASH_SINGLE only: the one output this signature commits to.
  committedOutput?: {
    index: number;
    address: string;
    value: string;
  };
};

export type IBtcPsbtAuthorization = {
  family: EBtcPsbtSighashFamily;
  hasAnyoneCanPay: boolean;
  signedInputs: IBtcPsbtAuthorizedInput[];
};

export type IBtcPsbtDisplayTransfer = {
  address: string;
  // satoshi, decimal string
  value: string;
};

export type IBtcPsbtDisplayTransfers = {
  sends: IBtcPsbtDisplayTransfer[];
  receives: IBtcPsbtDisplayTransfer[];
};

const SIGHASH_ALL_ANYONECANPAY =
  Transaction.SIGHASH_ALL | Transaction.SIGHASH_ANYONECANPAY;
const SIGHASH_SINGLE_ANYONECANPAY =
  Transaction.SIGHASH_SINGLE | Transaction.SIGHASH_ANYONECANPAY;

// Exact-match whitelist. An undeclared type signs as DEFAULT (taproot) or ALL.
// Anything else, SIGHASH_NONE included, has no class and must not be signed.
export function classifyBtcSighashType(
  sighashType: number | undefined,
): IBtcPsbtSighashClass | undefined {
  switch (sighashType) {
    case undefined:
    case Transaction.SIGHASH_DEFAULT:
    case Transaction.SIGHASH_ALL:
      return { family: EBtcPsbtSighashFamily.All, anyoneCanPay: false };
    case SIGHASH_ALL_ANYONECANPAY:
      return { family: EBtcPsbtSighashFamily.All, anyoneCanPay: true };
    case Transaction.SIGHASH_SINGLE:
      return { family: EBtcPsbtSighashFamily.Single, anyoneCanPay: false };
    case SIGHASH_SINGLE_ANYONECANPAY:
      return { family: EBtcPsbtSighashFamily.Single, anyoneCanPay: true };
    default:
      return undefined;
  }
}

// Output commitment of the signatures a request asks for. Callers that need a
// refusal reason use findBtcPsbtSignPolicyViolation; this only tells a
// summary screen whether "every output is final" holds for the request.
export function getBtcPsbtSighashFamily({
  psbt,
  inputsToSign,
}: {
  psbt: Psbt;
  inputsToSign: readonly Pick<ITxInputToSign, 'index'>[];
}): EBtcPsbtSighashFamily {
  const hasSingle = inputsToSign.some(
    ({ index }) =>
      classifyBtcSighashType(psbt.data.inputs[index]?.sighashType)?.family ===
      EBtcPsbtSighashFamily.Single,
  );
  return hasSingle ? EBtcPsbtSighashFamily.Single : EBtcPsbtSighashFamily.All;
}

export type IBtcPsbtSignPolicyParams = {
  psbt: Psbt;
  psbtNetwork: networks.Network;
  inputsToSign: readonly Pick<ITxInputToSign, 'index'>[];
  // Without it only the sighash rules are checked, for the signer layer that
  // has no account context.
  ownedAddresses?: string[];
  // False for a signer that may sign inputs outside `inputsToSign`, or with a
  // sighash type other than the declared one. Two things then no longer hold:
  // - a SIGHASH_SINGLE summary stands for exactly the requested inputs signed
  //   as declared, so it cannot describe what such a signer authorizes;
  // - an input outside the request may be signed as well, so it must commit
  //   to every output like the requested ones do.
  // Defaults to true: the software signer signs the requested inputs only.
  isSignerBoundToRequest?: boolean;
};

function formatSighashType(sighashType: number | undefined) {
  return `0x${(sighashType ?? 0).toString(16).padStart(2, '0')}`;
}

// An input outside the request that the signer could still sign: not yet
// finalized, and spending an address of the account. An input whose address
// cannot be told apart from the account's counts as signable.
function isBtcPsbtInputSignableOutsideRequest({
  psbt,
  psbtNetwork,
  index,
  ownedAddressSet,
}: {
  psbt: Psbt;
  psbtNetwork: networks.Network;
  index: number;
  ownedAddressSet: Set<string> | undefined;
}) {
  const input = psbt.data.inputs[index];
  if (input.finalScriptSig || input.finalScriptWitness) {
    return false;
  }
  if (!ownedAddressSet) {
    return true;
  }
  let address = '';
  try {
    const { script } = getPsbtInputUtxo({ psbt, index });
    address = scriptPkToAddress(Buffer.from(script), psbtNetwork);
  } catch {
    // No usable UTXO record: the owner is unknown.
  }
  return !address || ownedAddressSet.has(address);
}

function resolveBtcPsbtSignedInputs({
  psbt,
  psbtNetwork,
  inputsToSign,
  ownedAddresses,
  isSignerBoundToRequest = true,
}: IBtcPsbtSignPolicyParams):
  | { violation: IBtcPsbtSignPolicyViolation }
  | {
      violation?: undefined;
      family: EBtcPsbtSighashFamily;
      hasAnyoneCanPay: boolean;
      signedInputs: Array<
        Pick<IBtcPsbtAuthorizedInput, 'index' | 'committedOutput'>
      >;
    } {
  const ownedAddressSet = ownedAddresses ? new Set(ownedAddresses) : undefined;
  let family: EBtcPsbtSighashFamily | undefined;
  let hasAnyoneCanPay = false;
  const signedInputs: Array<
    Pick<IBtcPsbtAuthorizedInput, 'index' | 'committedOutput'>
  > = [];
  const requestedIndexes = new Set<number>();

  for (const { index } of inputsToSign) {
    // The index is dapp-supplied. Aliases of one input ("0", [0]) are distinct
    // Set keys, and an out-of-range index reads as an undeclared sighash.
    if (!Number.isSafeInteger(index) || index < 0 || index >= psbt.inputCount) {
      return {
        violation: {
          index,
          message: `Input index ${String(index)} is not a valid input of this PSBT`,
        },
      };
    }
    // An input is given up once. A repeated index would be summarized once
    // per repeat and inflate what the request appears to pay and return.
    if (requestedIndexes.has(index)) {
      return {
        violation: {
          index,
          message: `Input ${index} is requested for signing more than once`,
        },
      };
    }
    requestedIndexes.add(index);

    const sighashType = psbt.data.inputs[index]?.sighashType;
    const sighashClass = classifyBtcSighashType(sighashType);
    if (!sighashClass) {
      const isNone =
        typeof sighashType === 'number' &&
        (sighashType & Transaction.SIGHASH_OUTPUT_MASK) ===
          Transaction.SIGHASH_NONE;
      return {
        violation: {
          index,
          message: isNone
            ? `SIGHASH_NONE is not supported for input ${index}`
            : `Sighash type ${formatSighashType(
                sighashType,
              )} is not supported for input ${index}`,
        },
      };
    }
    // One signature per input, and each can be lifted into another
    // transaction on its own terms. A request mixing the two families has no
    // single answer to "which outputs are guaranteed", so it is not signed.
    if (family && family !== sighashClass.family) {
      return {
        violation: {
          index,
          message: `Input ${index} cannot mix SIGHASH_SINGLE with inputs that commit to every output`,
        },
      };
    }
    family = sighashClass.family;
    hasAnyoneCanPay = hasAnyoneCanPay || sighashClass.anyoneCanPay;

    if (sighashClass.family === EBtcPsbtSighashFamily.All) {
      signedInputs.push({ index });
    } else if (!isSignerBoundToRequest) {
      return {
        violation: {
          index,
          message: `SIGHASH_SINGLE is not supported by this wallet for input ${index}`,
        },
      };
    } else {
      // Without a matching output a legacy SIGHASH_SINGLE signature covers a
      // constant digest and is valid for any spend of that key.
      const output = psbt.txOutputs[index];
      if (!output) {
        return {
          violation: {
            index,
            message: `SIGHASH_SINGLE input ${index} has no matching output`,
          },
        };
      }
      const address = scriptPkToAddress(
        Buffer.from(output.script),
        psbtNetwork,
      );
      // The matching output is the only thing the signer is guaranteed to
      // get back, so it has to come back to the signer.
      if (ownedAddressSet && (!address || !ownedAddressSet.has(address))) {
        return {
          violation: {
            index,
            message: `SIGHASH_SINGLE input ${index} must pay its matching output to the signing account`,
          },
        };
      }
      signedInputs.push({
        index,
        committedOutput: {
          index,
          address,
          value: output.value.toString(),
        },
      });
    }
  }

  if (!isSignerBoundToRequest) {
    for (let index = 0; index < psbt.inputCount; index += 1) {
      const sighashType = psbt.data.inputs[index].sighashType;
      if (
        !requestedIndexes.has(index) &&
        classifyBtcSighashType(sighashType)?.family !==
          EBtcPsbtSighashFamily.All &&
        isBtcPsbtInputSignableOutsideRequest({
          psbt,
          psbtNetwork,
          index,
          ownedAddressSet,
        })
      ) {
        return {
          violation: {
            index,
            message: `Input ${index} is outside the signing request and must not declare sighash type ${formatSighashType(
              sighashType,
            )}`,
          },
        };
      }
    }
  }

  return {
    family: family ?? EBtcPsbtSighashFamily.All,
    hasAnyoneCanPay,
    signedInputs,
  };
}

// Returns the first input whose requested signature must be refused.
export function findBtcPsbtSignPolicyViolation(
  params: IBtcPsbtSignPolicyParams,
): IBtcPsbtSignPolicyViolation | undefined {
  return resolveBtcPsbtSignedInputs(params).violation;
}

export function buildBtcPsbtAuthorization(
  params: IBtcPsbtSignPolicyParams & { ownedAddresses: string[] },
): IBtcPsbtAuthorization {
  const resolved = resolveBtcPsbtSignedInputs(params);
  if (resolved.violation) {
    throw new OneKeyLocalError(resolved.violation.message);
  }
  const { psbt, psbtNetwork } = params;
  return {
    family: resolved.family,
    hasAnyoneCanPay: resolved.hasAnyoneCanPay,
    signedInputs: resolved.signedInputs.map(({ index, committedOutput }) => {
      const { script, value } = getPsbtInputUtxo({ psbt, index });
      return {
        index,
        value: value.toString(),
        address: scriptPkToAddress(Buffer.from(script), psbtNetwork),
        ...(committedOutput ? { committedOutput } : {}),
      };
    }),
  };
}

const BTC_PSBT_SIGNATURE_FIELDS = [
  'partialSig',
  'tapKeySig',
  'tapScriptSig',
  'finalScriptSig',
  'finalScriptWitness',
] as const;

// A device hands back the whole PSBT and may have signed inputs the request
// did not name. Those inputs are put back to the signatures they arrived
// with, so nothing is released beyond what the confirm page described. The
// device result is returned as is when there is nothing to drop.
export function dropBtcPsbtSignaturesOutsideRequest({
  unsignedPsbt,
  signedPsbtHex,
  inputsToSign,
  network,
}: {
  unsignedPsbt: Psbt;
  signedPsbtHex: string;
  inputsToSign: readonly Pick<ITxInputToSign, 'index'>[];
  network: networks.Network;
}): string {
  const requestedIndexes = new Set(inputsToSign.map(({ index }) => index));
  const signedPsbt = Psbt.fromHex(signedPsbtHex, { network });
  let hasDropped = false;
  signedPsbt.data.inputs.forEach((input, index) => {
    if (requestedIndexes.has(index)) {
      return;
    }
    const original = unsignedPsbt.data.inputs[index];
    BTC_PSBT_SIGNATURE_FIELDS.forEach((field) => {
      if (isEqual(input[field], original?.[field])) {
        return;
      }
      hasDropped = true;
      if (original?.[field] === undefined) {
        delete input[field];
      } else {
        Object.assign(input, { [field]: original[field] });
      }
    });
  });
  return hasDropped ? signedPsbt.toHex() : signedPsbtHex;
}

// The transfers a confirm page may show for a PSBT, derived from what the
// signatures commit to rather than from how the outputs look:
// - every output committed: each output that is not change is shown. No
//   output is dropped for matching an input, for being small, or for having
//   no address; only an empty data output (OP_RETURN marker) is skipped.
// - SIGHASH_SINGLE: each signed input is given up and its matching output
//   comes back. Every other output can still be replaced, so none of them
//   counts as a payment or as change.
export function buildBtcPsbtDisplayTransfers({
  authorization,
  outputs,
}: {
  authorization: IBtcPsbtAuthorization;
  outputs: Array<Pick<IBtcOutput, 'address' | 'value' | 'payload'>>;
}): IBtcPsbtDisplayTransfers {
  if (authorization.family === EBtcPsbtSighashFamily.Single) {
    return {
      // The signature names no recipient for the input it gives up.
      sends: authorization.signedInputs.map((input) => ({
        address: '',
        value: input.value,
      })),
      receives: authorization.signedInputs.flatMap((input) =>
        input.committedOutput
          ? [
              {
                address: input.committedOutput.address,
                value: input.committedOutput.value,
              },
            ]
          : [],
      ),
    };
  }

  const toTransfer = (
    output: Pick<IBtcOutput, 'address' | 'value'>,
  ): IBtcPsbtDisplayTransfer => ({
    address: output.address,
    value: output.value,
  });
  if (outputs.length <= 1) {
    return { sends: outputs.map(toTransfer), receives: [] };
  }
  const visibleOutputs = outputs.filter(
    (output) =>
      !output.payload?.isChange &&
      (Boolean(output.address) || new BigNumber(output.value).gt(0)),
  );
  return {
    sends: (visibleOutputs.length ? visibleOutputs : outputs).map(toTransfer),
    receives: [],
  };
}
