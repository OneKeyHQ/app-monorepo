import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';
import { clearWebRouteNotFoundState } from '../../routes/config/webDappUrlFallback';

function NotFound() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      gap="$4"
      p="$5"
    >
      <SizableText size="$headingLg">Not Found Page</SizableText>
      <Button
        testID="web-not-found-back-home"
        onPress={() => {
          const destination = platformEnv.isWebDappMode
            ? {
                screen: ETabRoutes.Market,
                params: { screen: ETabMarketRoutes.TabMarket },
              }
            : {
                screen: ETabRoutes.Home,
                params: { screen: ETabHomeRoutes.TabHome },
              };
          clearWebRouteNotFoundState();
          navigation.navigate(ERootRoutes.Main, destination);
        }}
      >
        {intl.formatMessage({ id: ETranslations.explore_back_to_home })}
      </Button>
    </YStack>
  );
}

export default NotFound;
