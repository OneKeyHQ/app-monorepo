import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { Recommended } from '../../../Earn/components/Recommended';
import { RichBlock } from '../RichBlock';

function EarnListView() {
  const navigation = useAppNavigation();
  const renderContent = useCallback(() => {
    return (
      <Recommended
        withHeader={false}
        recommendedItemContainerProps={{
          bg: '$bgSubdued',
          borderColor: '$neutral3',
        }}
      />
    );
  }, []);

  const handleViewMore = useCallback(() => {
    navigation.switchTab(ETabRoutes.Earn);
  }, [navigation]);

  const intl = useIntl();
  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.earn_title })}
      headerActions={
        <Button
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
      contentContainerProps={
        platformEnv.isNative
          ? {
              mx: '$-5',
            }
          : undefined
      }
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { EarnListView };
