import { useCallback } from 'react';

import { Button, Page } from '@onekeyhq/components';
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
        <Button
          size="small"
          variant="tertiary"
          onPress={handleViewChangelog}
          $md={{ pb: '$4' }}
        >
          {'View full changelog'}
        </Button>
      </Page.FooterActions>
    </Page.Footer>
  );
}

export { FeaturedFooter };
