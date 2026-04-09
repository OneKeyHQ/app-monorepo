import { useCallback } from 'react';

import { Button, Page, SizableText, YStack } from '@onekeyhq/components';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';

import useAppNavigation from '../../../hooks/useAppNavigation';

interface IFeaturedFooterProps {
  ctaText: string;
  onCtaPress: () => void;
  isForceUpdate?: boolean;
}

function FeaturedFooter({ ctaText, onCtaPress }: IFeaturedFooterProps) {
  const navigation = useAppNavigation();

  const handleViewChangelog = useCallback(() => {
    navigation.push(EAppUpdateRoutes.WhatsNew);
  }, [navigation]);

  return (
    <Page.Footer>
      {/* TODO: replace hardcoded string with ETranslations.update_view_full_changelog once i18n key is added via Lokalise */}
      <YStack
        p="$5"
        pt="$0"
        gap="$3"
        $gtMd={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          textAlign="center"
          cursor="pointer"
          hoverStyle={{ color: '$textInteractive' }}
          pressStyle={{ opacity: 0.7 }}
          onPress={handleViewChangelog}
          $gtMd={{ order: -1, textAlign: 'left', flex: 1 }}
        >
          {'View full changelog ›'}
        </SizableText>
        <Button
          variant="primary"
          size="large"
          onPress={onCtaPress}
          $gtMd={{ flexGrow: 0, minWidth: 160 }}
        >
          {ctaText}
        </Button>
      </YStack>
    </Page.Footer>
  );
}

export { FeaturedFooter };
