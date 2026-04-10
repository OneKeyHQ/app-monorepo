import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';

import useAppNavigation from '../../../hooks/useAppNavigation';

interface IFeaturedFooterProps {
  ctaText: string;
  onCtaPress: () => void;
}

function FeaturedFooter({ ctaText, onCtaPress }: IFeaturedFooterProps) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const handleViewChangelog = useCallback(() => {
    navigation.push(EAppUpdateRoutes.WhatsNew);
  }, [navigation]);

  return (
    <Page.Footer>
      <Page.FooterActions
        onConfirmText={ctaText}
        onConfirm={() => onCtaPress()}
        $md={{
          flexDirection: 'column-reverse',
          gap: '$4',
        }}
      >
        <Button size="small" variant="tertiary" onPress={handleViewChangelog}>
          {intl.formatMessage({ id: ETranslations.view_full_changelog })}
        </Button>
      </Page.FooterActions>
    </Page.Footer>
  );
}

export { FeaturedFooter };
