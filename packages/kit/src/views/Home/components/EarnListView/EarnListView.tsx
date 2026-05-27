import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabEarnRoutes } from '@onekeyhq/shared/src/routes';

import { Recommended } from '../../../Earn/components/Recommended';
import { safePushToEarnRoute } from '../../../Earn/earnUtils';
import { RichBlock } from '../RichBlock';

const HOME_EARN_FETCH_IDLE_TIMEOUT_MS = 1200;

function EarnListView({ isActive = true }: { isActive?: boolean }) {
  const navigation = useAppNavigation();
  const [enableRecommendedFetch, setEnableRecommendedFetch] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setEnableRecommendedFetch(false);
      return undefined;
    }

    const timeoutId = setTimeout(
      () => setEnableRecommendedFetch(true),
      HOME_EARN_FETCH_IDLE_TIMEOUT_MS,
    );
    const idleId =
      typeof requestIdleCallback === 'function'
        ? requestIdleCallback(() => setEnableRecommendedFetch(true), {
            timeout: HOME_EARN_FETCH_IDLE_TIMEOUT_MS,
          })
        : undefined;

    return () => {
      clearTimeout(timeoutId);
      if (idleId !== undefined && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleId);
      }
    };
  }, [isActive]);

  const renderContent = useCallback(() => {
    return (
      <Recommended
        withHeader={false}
        disableHorizontalBleed
        enableFetch={enableRecommendedFetch}
        recommendedItemContainerProps={{
          bg: '$bgSubdued',
          borderColor: '$neutral3',
          hoverStyle: { bg: '$bgHover' },
          pressStyle: { bg: '$bgActive' },
        }}
      />
    );
  }, [enableRecommendedFetch]);

  const handleViewMore = useCallback(() => {
    void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome);
  }, [navigation]);

  const intl = useIntl();
  const [isDeFiEnabled, setIsDeFiEnabled] = useState(true);
  const checkDeFiEnabled = useCallback(async () => {
    const blockData = await backgroundApiProxy.serviceStaking.getBlockRegion();
    setIsDeFiEnabled(!blockData);
  }, []);

  useEffect(() => {
    void checkDeFiEnabled();
  }, [checkDeFiEnabled]);

  if (!isDeFiEnabled) {
    return null;
  }

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.earn_title })}
      headerContainerProps={{ px: '$pagePadding' }}
      headerActions={
        <Button
          testID="home-block-data-btn"
          size="small"
          variant="tertiary"
          iconAfter="ChevronRightSmallOutline"
          color="$textSubdued"
          iconProps={{ color: '$iconSubdued' }}
          onPress={handleViewMore}
        >
          {intl.formatMessage({
            id: ETranslations.global_view_more,
          })}
        </Button>
      }
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { EarnListView };
