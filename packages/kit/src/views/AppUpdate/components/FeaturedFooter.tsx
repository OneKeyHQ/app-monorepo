import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Stack,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { AppUpdateTestIDs } from '../testIDs';

import type { LayoutChangeEvent } from 'react-native';

interface IFeaturedFooterProps {
  ctaText: string;
  onCtaPress: () => void;
  showFullChangelog?: boolean;
  closeDialog: () => Promise<void>;
  onLayout?: (event: LayoutChangeEvent) => void;
}

function FeaturedFooter({
  ctaText,
  onCtaPress,
  showFullChangelog = true,
  closeDialog,
  onLayout,
}: IFeaturedFooterProps) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { md } = useMedia();
  const { bottom } = useSafeAreaInsets();
  // 20 = "$5" default. Use the system safe-area inset when larger so the
  // footer clears the iOS home indicator on bottom-sheet dialogs.
  const paddingBottom = Math.max(bottom, 20);

  const handleViewChangelog = useCallback(async () => {
    await closeDialog();
    navigation.pushModal(EModalRoutes.AppUpdateModal, {
      screen: EAppUpdateRoutes.WhatsNew,
    });
  }, [navigation, closeDialog]);

  if (md) {
    return (
      <YStack
        px="$5"
        gap="$4"
        paddingBottom={paddingBottom + 20}
        onLayout={onLayout}
      >
        <Button
          testID={AppUpdateTestIDs.featuredFooterCtaBtn}
          size="large"
          variant="primary"
          onPress={onCtaPress}
        >
          {ctaText}
        </Button>
        {showFullChangelog ? (
          <Button
            testID={AppUpdateTestIDs.featuredFooterViewChangelogBtn}
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
    <XStack
      px="$5"
      paddingBottom={paddingBottom}
      justifyContent="space-between"
      alignItems="center"
      onLayout={onLayout}
    >
      {showFullChangelog ? (
        <Button
          testID={AppUpdateTestIDs.featuredFooterViewChangelogBtn}
          size="small"
          variant="tertiary"
          onPress={handleViewChangelog}
        >
          {intl.formatMessage({ id: ETranslations.view_full_changelog })}
        </Button>
      ) : (
        <Stack />
      )}
      <Button
        testID={AppUpdateTestIDs.featuredFooterCtaBtn}
        size="medium"
        variant="primary"
        onPress={onCtaPress}
      >
        {ctaText}
      </Button>
    </XStack>
  );
}

export { FeaturedFooter };
