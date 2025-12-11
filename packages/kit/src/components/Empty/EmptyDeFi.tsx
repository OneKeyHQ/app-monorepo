import { useIntl } from 'react-intl';

import { Button, Empty, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';

function EmptyDeFi() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="Wallet-DeFi-Empty"
      icon="CoinsOutline"
      title={
        <Button
          variant="tertiary"
          size="large"
          onPress={() => {
            navigation.switchTab(ETabRoutes.Earn);
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
    />
  );
}

export { EmptyDeFi };
