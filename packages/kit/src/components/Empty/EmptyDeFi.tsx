import { useIntl } from 'react-intl';

import {
  Button,
  Empty,
  Icon,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabEarnRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../hooks/useAppNavigation';
import { safePushToEarnRoute } from '../../views/Earn/earnUtils';

function EmptyDeFi({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
  const navigation = useAppNavigation();

  if (!tableLayout) {
    return (
      <Stack alignItems="center" justifyContent="center" p="$5">
        <XStack alignItems="flex-start" gap="$3">
          <Icon name="CoinsOutline" size="$8" color="$iconSubdued" />
          <YStack flexShrink={1} alignItems="flex-start" gap="$0.5">
            <XStack
              alignItems="center"
              gap="$1"
              onPress={() => {
                void safePushToEarnRoute(navigation, ETabEarnRoutes.EarnHome);
              }}
            >
              <SizableText size="$bodyLgMedium">
                {intl.formatMessage({
                  id: ETranslations.wallet_defi_portfolio_empty_cta,
                })}
              </SizableText>
              <Icon name="ArrowRightOutline" size="$5" color="$iconSubdued" />
            </XStack>
            <SizableText size="$bodyMd" color="$textSubdued" textAlign="left">
              {intl.formatMessage({
                id: ETranslations.wallet_positions_empty_desc,
              })}
            </SizableText>
          </YStack>
        </XStack>
      </Stack>
    );
  }

  return (
    <Empty
      h={platformEnv.isNativeAndroid ? 300 : undefined}
      testID="Wallet-DeFi-Empty"
      icon="CoinsOutline"
      iconProps={{
        size: '$14',
        mb: '$4',
      }}
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
      descriptionProps={{
        mt: '$1',
      }}
    />
  );
}

export { EmptyDeFi };
