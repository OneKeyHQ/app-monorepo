import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { mapStrk20Error } from '@onekeyhq/shared/src/utils/strk20ErrorUtils';

import { formatMockMessage } from './starknetPrivacyUtils';

import type { IntlShape } from 'react-intl';

export async function validateStarknetPrivacyRecipient(
  intl: IntlShape,
  networkId: string,
  recipient: string,
) {
  try {
    if (
      await backgroundApiProxy.serviceStarknetPrivacy.isRecipientRegistered({
        networkId,
        recipient,
      })
    )
      return undefined;
    return formatMockMessage(
      intl,
      ETranslations.starknet_privacy_error_recipient_not_registered__msg,
    );
  } catch (error) {
    return formatMockMessage(intl, mapStrk20Error(error).translationKey);
  }
}
