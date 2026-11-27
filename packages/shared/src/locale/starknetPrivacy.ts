import type { EStrk20PrivateTxKind } from '@onekeyhq/shared/types/starknetPrivacy';

import { ETranslations } from './enum/translations';

export const starknetPrivacyOperationTitles = {
  register: ETranslations.privacy_enable__title,
  deposit: ETranslations.privacy_balance_shield__action,
  withdraw: ETranslations.privacy_balance_unshield__action,
  transfer: ETranslations.private_send_private_send,
} satisfies Record<EStrk20PrivateTxKind, ETranslations>;
