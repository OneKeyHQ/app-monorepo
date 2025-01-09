import { isEqual, isEqualWith } from 'lodash';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import type { Psbt } from 'bitcoinjs-lib';

export function verifyBtcSignedPsbtMatched({
  unsignedPsbt,
  signedPsbt,
}: {
  unsignedPsbt: Psbt | undefined;
  signedPsbt: Psbt | undefined;
}) {
  if (!unsignedPsbt || !signedPsbt) {
    // psbt not found
    throw new Error(
      appLocale.intl.formatMessage({
        id: ETranslations.feedback_psbt_not_found,
      }),
    );
  }
  const isEqualFn = isEqual;
  if (!isEqualFn(unsignedPsbt.txInputs, signedPsbt.txInputs)) {
    // psbt inputs not matched
    throw new Error(
      appLocale.intl.formatMessage({
        id: ETranslations.feedback_psbt_inputs_mismatch,
      }),
    );
  }
  if (!isEqualFn(unsignedPsbt.txOutputs, signedPsbt.txOutputs)) {
    // psbt outputs not matched
    throw new Error(
      appLocale.intl.formatMessage({
        id: ETranslations.feedback_psbt_outputs_mismatch,
      }),
    );
  }
  if (
    !isEqualWith(
      unsignedPsbt.data.globalMap,
      signedPsbt.data.globalMap,
      (value1, value2) => {
        if (
          (value1 instanceof Uint8Array || value1 instanceof Buffer) &&
          (value2 instanceof Uint8Array || value2 instanceof Buffer)
        ) {
          const buffer1 = Buffer.from(value1).toString('hex');
          const buffer2 = Buffer.from(value2).toString('hex');
          if (buffer1 && buffer2) {
            return buffer1 === buffer2;
          }
        }
        return undefined;
      },
    )
  ) {
    // psbt uuid not matched
    throw new Error(
      appLocale.intl.formatMessage({
        id: ETranslations.feedback_psbt_uuid_mismatch,
      }),
    );
  }
}
