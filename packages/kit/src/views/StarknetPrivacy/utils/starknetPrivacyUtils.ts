import type {
  IDecodedTxExtraStarknet,
  IDecodedTxPrivacyStarknet,
} from '@onekeyhq/core/src/chains/starknet/types';
import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { EStrk20SetupRequirement } from '@onekeyhq/shared/types/starknetPrivacy';
import type { IDecodedTxExtraInfo } from '@onekeyhq/shared/types/tx';

import type { IntlShape } from 'react-intl';

/**
 * `ETranslationsMock` ids are the English copy itself and are absent from the
 * message catalog, so react-intl only interpolates ICU placeholders when the
 * same string is also handed over as `defaultMessage`. A real `ETranslations`
 * id is already in the catalog, so the `defaultMessage` fallback is simply
 * unused for it; accepting both lets this format `mapStrk20Error`'s
 * `translationKey` without a branch.
 */
export function formatMockMessage(
  intl: IntlShape,
  id: ETranslations | ETranslationsMock,
  values?: Record<string, string | number>,
): string {
  return intl.formatMessage({ id, defaultMessage: id }, values);
}

/**
 * Renders the sequencing cooldown estimate. Block time is an estimate, so the
 * output is deliberately coarse and never claims a deadline.
 */
export function formatStrk20Countdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '0s';
  }
  const seconds = Math.ceil(totalSeconds);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  if (minutes < 60) {
    return restSeconds === 0 ? `${minutes}m` : `${minutes}m ${restSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes === 0 ? `${hours}h` : `${hours}h ${restMinutes}m`;
}

export type IStrk20RecipientCopy = {
  /** Blocks submission: the recipient has never registered with the pool. */
  blocking: boolean;
  messageKey?: ETranslationsMock;
};

export function getStrk20RecipientRequirementCopy(
  requirement: EStrk20SetupRequirement | undefined,
): IStrk20RecipientCopy {
  switch (requirement) {
    case EStrk20SetupRequirement.Register:
      return {
        blocking: true,
        messageKey:
          ETranslationsMock.starknet_privacy_error_recipient_not_registered,
      };
    case EStrk20SetupRequirement.SetupChannel:
    case EStrk20SetupRequirement.SetupToken:
      return {
        blocking: false,
        messageKey: ETranslationsMock.starknet_privacy_recipient_setup_note,
      };
    default:
      return { blocking: false };
  }
}

/**
 * Reads the STRK20 privacy block `buildDecodedTx` copies onto
 * `decodedTx.extraInfo.privacy` (core/src/chains/starknet/types). This is the
 * confirm screen's only source of display data for the block; the encodedTx
 * carries the build-time payload (proof, proofFacts, ...), not this.
 */
export function readStarknetPrivacyBlock(
  extraInfo: IDecodedTxExtraInfo | null | undefined,
): IDecodedTxPrivacyStarknet | undefined {
  return (extraInfo as IDecodedTxExtraStarknet | null | undefined)?.privacy;
}
