import { useIntl } from 'react-intl';

import { Button, Empty, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';
import { safePushToEarnRoute } from '../../views/Earn/earnUtils';

function EmptyDeFi({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="Wallet-DeFi-Empty"
      illustration="Coins"
      title={
        <Button
          variant="tertiary"
          size="large"
          onPress={() => {
            if (tableLayout) {
              navigation.switchTab(ETabRoutes.Earn);
            } else {
              void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome);
            }
          }}
          iconAfter="ArrowRightOutline"
        >
          <SizableText size="$headingXl">
            {intl.formatMessage({
              id: ETranslations.wallet_defi_portfolio_empty_cta,
            })}
          </SizableText>
        </Button>
      }
      description={intl.formatMessage({
        id: ETranslations.wallet_positions_empty_desc,
      })}
      descriptionProps={{
        mt: '$1',
      }}
    />
  );
}

export { EmptyDeFi };
