import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Stack, XStack, YStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

interface IFeaturedFooterProps {
  ctaText: string;
  onCtaPress: () => void;
  showFullChangelog?: boolean;
  closeDialog: () => Promise<void>;
}

function FeaturedFooter({
  ctaText,
  onCtaPress,
  showFullChangelog = true,
  closeDialog,
}: IFeaturedFooterProps) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { md } = useMedia();

  const handleViewChangelog = useCallback(async () => {
    await closeDialog();
    navigation.pushModal(EModalRoutes.AppUpdateModal, {
      screen: EAppUpdateRoutes.WhatsNew,
    });
  }, [navigation, closeDialog]);

  if (md) {
    return (
      <YStack px="$5" pb="$5" gap="$4">
        <Button size="large" variant="primary" onPress={onCtaPress}>
          {ctaText}
        </Button>
        {showFullChangelog ? (
          <Button
            size="medium"
            variant="tertiary"
            onPress={handleViewChangelog}
          >
            {intl.formatMessage({ id: ETranslations.view_full_changelog })}
          </Button>
        ) : null}
      </YStack>
    );
  }

  return (
    <XStack px="$5" pb="$5" justifyContent="space-between" alignItems="center">
      {showFullChangelog ? (
        <Button size="medium" variant="tertiary" onPress={handleViewChangelog}>
          {intl.formatMessage({ id: ETranslations.view_full_changelog })}
        </Button>
      ) : (
        <Stack />
      )}
      <Button size="medium" variant="primary" onPress={onCtaPress}>
        {ctaText}
      </Button>
    </XStack>
  );
}

export { FeaturedFooter };
