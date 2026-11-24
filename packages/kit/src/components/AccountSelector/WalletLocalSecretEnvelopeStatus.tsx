import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Button, Icon } from '@onekeyhq/components';
import { useWalletLocalSecretEnvelopeStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/walletLocalSecretEnvelopeStatus';
import { getLocalSecretEnvelopeCredentialKey } from '@onekeyhq/shared/src/errors/utils/localSecretEnvelopeErrorData';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslationsMock } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

export function formatWalletLocalSecretEnvelopeStatus(intl: IntlShape) {
  return intl.formatMessage({
    id: ETranslationsMock.wallet_lse_unavailable_status__title,
    defaultMessage: intl.locale.startsWith('zh')
      ? '钱包不可用'
      : ETranslationsMock.wallet_lse_unavailable_status__title,
  });
}

export function WalletLocalSecretEnvelopeStatus({
  credentialId,
  compact,
  fallback = null,
}: {
  credentialId?: string;
  compact?: boolean;
  fallback?: ReactNode;
}) {
  const intl = useIntl();
  const [{ issues, sessionId }] = useWalletLocalSecretEnvelopeStatusAtom();
  const issue =
    credentialId && sessionId
      ? issues[getLocalSecretEnvelopeCredentialKey(sessionId, credentialId)]
      : undefined;
  if (!issue) {
    return fallback;
  }
  const label = formatWalletLocalSecretEnvelopeStatus(intl);
  const openDetails = () => {
    appEventBus.emit(
      EAppEventBusNames.ShowLocalSecretEnvelopeErrorDialog,
      issue,
    );
  };
  if (compact) {
    return (
      <Badge
        testID="wallet-lse-unavailable-details"
        render={<button type="button" aria-label={label} />}
        accessible
        accessibilityLabel={label}
        accessibilityRole="button"
        badgeSize="sm"
        badgeType="critical"
        borderWidth={0}
        alignSelf="flex-start"
        ml="$1.5"
        gap="$1"
        cursor="pointer"
        focusable
        focusVisibleStyle={{
          outlineColor: '$focusRingCritical',
          outlineStyle: 'solid',
          outlineWidth: 2,
        }}
        pressStyle={{ opacity: 0.8 }}
        onPress={openDetails}
      >
        <Badge.Text>{label}</Badge.Text>
        <Icon
          name="ChevronRightSmallOutline"
          size="$3.5"
          color="$iconCritical"
        />
      </Badge>
    );
  }
  return (
    <Button
      testID="wallet-lse-unavailable-details"
      accessibilityLabel={label}
      variant="tertiary"
      size="small"
      icon="ErrorOutline"
      alignSelf="center"
      onPress={openDetails}
    >
      {label}
    </Button>
  );
}
