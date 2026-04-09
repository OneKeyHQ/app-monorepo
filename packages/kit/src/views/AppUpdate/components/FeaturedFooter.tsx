import { useCallback } from 'react';

import { Page, SizableText } from '@onekeyhq/components';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';

import useAppNavigation from '../../../hooks/useAppNavigation';

interface IFeaturedFooterProps {
  ctaText: string;
  onCtaPress: () => void;
}

function FeaturedFooter({ ctaText, onCtaPress }: IFeaturedFooterProps) {
  const navigation = useAppNavigation();

  const handleViewChangelog = useCallback(() => {
    navigation.push(EAppUpdateRoutes.WhatsNew);
  }, [navigation]);

  return (
    <Page.Footer>
      {/* TODO: replace hardcoded string with ETranslations key once added via Lokalise */}
      <Page.FooterActions
        onConfirmText={ctaText}
        onConfirm={() => onCtaPress()}
      >
        <SizableText
          size="$bodyMd"
          color="$textSubdued"
          textAlign="center"
          cursor="pointer"
          hoverStyle={{ color: '$textInteractive' }}
          pressStyle={{ opacity: 0.7 }}
          onPress={handleViewChangelog}
          $gtMd={{ textAlign: 'left' }}
        >
          {'View full changelog ›'}
        </SizableText>
      </Page.FooterActions>
    </Page.Footer>
  );
}

export { FeaturedFooter };
