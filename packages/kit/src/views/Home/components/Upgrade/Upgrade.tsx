import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  LinearGradient,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { usePrimeAvailable } from '../../../Prime/hooks/usePrimeAvailable';
import { RichBlock } from '../RichBlock';

function Upgrade() {
  const intl = useIntl();

  const appNavigation = useAppNavigation();

  const themeVariant = useThemeVariant();

  const { isPrimeAvailable } = usePrimeAvailable();
  const { user } = useOneKeyAuth();

  const isPrimeUser = useMemo(() => {
    return user?.primeSubscription?.isActive && user?.onekeyUserId;
  }, [user]);

  const renderContent = useCallback(() => {
    return (
      <XStack alignItems="center" jc="space-between" gap="$3">
        <XStack flex={1} alignItems="center" gap="$3">
          <LinearGradient
            colors={['rgba(58, 222, 0, 0.45)', 'rgba(0, 225, 157, 0.45)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            borderRadius="$2.5"
            borderCurve="continuous"
            p={1}
            position="relative"
            overflow="hidden"
          >
            <Stack
              bg="$bgSubdued"
              width="$9"
              height="$9"
              borderRadius="$2.5"
              borderCurve="continuous"
            />
            <LinearGradient
              colors={['rgba(58, 222, 0, 0.09)', 'rgba(0, 225, 157, 0.09)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              px="$1.5"
              py="$1.5"
              borderRadius="$2.5"
              borderCurve="continuous"
              alignItems="center"
              justifyContent="center"
              zIndex={1}
              position="absolute"
              top={1}
              left={1}
            >
              <Icon
                name={
                  themeVariant === 'light'
                    ? 'OnekeyPrimeLightColored'
                    : 'OnekeyPrimeDarkColored'
                }
                size="$6"
              />
            </LinearGradient>
          </LinearGradient>
          <YStack flex={1}>
            <SizableText size="$headingMd">
              {intl.formatMessage({ id: ETranslations.global_prime })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued" numberOfLines={2}>
              {intl.formatMessage({
                id: ETranslations.settings_cloud_sync_bulk_tools_and_more,
              })}
            </SizableText>
          </YStack>
        </XStack>
        <Button
          size="small"
          variant="primary"
          onPress={() => {
            appNavigation.pushFullModal(EModalRoutes.PrimeModal, {
              screen: EPrimePages.PrimeDashboard,
            });
          }}
        >
          {intl.formatMessage({ id: ETranslations.prime_get_prime })}
        </Button>
      </XStack>
    );
  }, [intl, appNavigation, themeVariant]);

  if (!isPrimeAvailable) {
    return null;
  }

  if (isPrimeUser) {
    return null;
  }

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.global_upgrade })}
      content={renderContent()}
      contentContainerProps={{
        px: '$4',
        py: '$2',
        $gtMd: {
          py: '$4',
        },
        bg: '$bgSubdued',
      }}
    />
  );
}

export { Upgrade };
