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
        $md={{
          flexDirection: 'column-reverse',
          gap: '$4',
        }}
      >
        <Button size="small" variant="tertiary" onPress={handleViewChangelog}>
          View full changelog
        </Button>
      </Page.FooterActions>
    </Page.Footer>
  );
}

export { FeaturedFooter };
