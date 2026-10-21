import { useIntl } from 'react-intl';

import { SizableText, Stack } from '@onekeyhq/components';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';

import {
  isStrk20Registered,
  useStarknetPrivacyAccountState,
  useStarknetPrivacyAvailability,
} from '../hooks/useStarknetPrivacy';
import { formatMockMessage } from '../utils/starknetPrivacyUtils';

/**
 * Private transfer rows are rebuilt from the account's own notes, so the list
 * is incomplete by construction (plan section 4.5). Shown only once the account
 * actually has private rows to be wrong about.
 */
export function StarknetPrivacyHistoryNote({
  networkId,
  accountId,
}: {
  networkId?: string;
  accountId?: string;
}) {
  const intl = useIntl();
  const { isAvailable } = useStarknetPrivacyAvailability({ networkId });
  const { state } = useStarknetPrivacyAccountState({
    networkId,
    accountId,
    enabled: isAvailable,
  });

  if (!isStrk20Registered(state)) {
    return null;
  }

  return (
    <Stack px="$pagePadding" pb="$4">
      <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
        {formatMockMessage(
          intl,
          ETranslationsMock.starknet_privacy_history_not_authoritative,
        )}
      </SizableText>
    </Stack>
  );
}
