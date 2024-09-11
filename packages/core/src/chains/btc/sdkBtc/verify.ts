import { isEqual } from 'lodash';

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
  if (!isEqualFn(unsignedPsbt.data.globalMap, signedPsbt.data.globalMap)) {
    // psbt uuid not matched
    throw new Error(
      appLocale.intl.formatMessage({
        id: ETranslations.feedback_psbt_uuid_mismatch,
      }),
    );
  }
}
