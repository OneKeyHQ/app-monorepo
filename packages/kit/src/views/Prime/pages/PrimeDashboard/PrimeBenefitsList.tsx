import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Badge,
  Icon,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { showPrimeFeatureIntroDialog } from '../PrimeFeatures/PrimeFeatureIntroContent';
import { PRIME_FEATURE_INTROS } from '../PrimeFeatures/primeFeatureIntroUtils';

import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';
import type { IPrimeFeatureIntro } from '../PrimeFeatures/primeFeatureIntroUtils';

function PrimeBenefitsBaseItem({
  icon,
  title,
  subtitle,
  onPress,
  isComingSoon,
}: {
  icon: IKeyOfIcons;
  title: string;
  subtitle: string;
  onPress: () => void;
  isComingSoon?: boolean;
}) {
  const intl = useIntl();

  return (
    <ListItem drillIn onPress={onPress}>
      <YStack borderRadius="$3" borderCurve="continuous" bg="$brand4" p="$2">
        <Icon name={icon} size="$6" color="$brand9" />
      </YStack>
      <ListItem.Text
        userSelect="none"
        flex={1}
        primary={
          <XStack alignItems="center">
            <SizableText
              textAlign="left"
              size="$bodyLgMedium"
              flexShrink={1}
              numberOfLines={1}
            >
              {title}
            </SizableText>
            {isComingSoon ? (
              <Badge ml="$2" badgeSize="sm" flexShrink={0}>
                <Badge.Text>
                  {intl.formatMessage({
                    id: ETranslations.id_prime_soon,
                  })}
                </Badge.Text>
              </Badge>
            ) : null}
          </XStack>
        }
        secondary={subtitle}
      />
    </ListItem>
  );
}

function PrimeBenefitsItem({
  feature,
  onPress,
}: {
  feature: IPrimeFeatureIntro;
  onPress: () => void;
}) {
  const intl = useIntl();

  return (
    <PrimeBenefitsBaseItem
      icon={feature.listIcon}
      title={intl.formatMessage({
        id: feature.title,
      })}
      subtitle={intl.formatMessage(
        {
          id: feature.description,
        },
        feature.descriptionValues,
      )}
      isComingSoon={feature.isComingSoon}
      onPress={onPress}
    />
  );
}

export function PrimeBenefitsList({
  selectedSubscriptionPeriod,
  networkId,
}: {
  selectedSubscriptionPeriod: ISubscriptionPeriod;
  networkId?: string;
}) {
  const navigation = useAppNavigation();
  const { isPrimeActive } = useOneKeyAuth();
  const isMobile = platformEnv.isNative || platformEnv.isWebMobile;

  const openFeatureIntro = useCallback(
    (featureName: EPrimeFeatures) => {
      defaultLogger.prime.subscription.primeEntryClick({
        featureName,
        entryPoint: 'primePage',
        isPrimeActive,
      });

      const params = {
        selectedFeature: featureName,
        selectedSubscriptionPeriod,
        networkId,
      };

      if (isMobile) {
        showPrimeFeatureIntroDialog(params);
        return;
      }

      navigation.push(EPrimePages.PrimeFeatures, params);
    },
    [
      isMobile,
      isPrimeActive,
      networkId,
      navigation,
      selectedSubscriptionPeriod,
    ],
  );

  return (
    <Stack py="$2">
      {/* OneKey Cloud removed — keyless sync is free, no longer a Prime benefit */}
      {PRIME_FEATURE_INTROS.map((feature) => (
        <PrimeBenefitsItem
          key={feature.id}
          feature={feature}
          onPress={() => openFeatureIntro(feature.id)}
        />
      ))}

      {platformEnv.isDev ? (
        <>
          <PrimeBenefitsBaseItem
            icon="BezierNodesOutline"
            title="Premium RPC"
            subtitle="Enjoy rapid and secure blockchain access."
            isComingSoon
            onPress={() => {
              if (process.env.NODE_ENV !== 'production') {
                Toast.success({
                  title: 'Premium RPC',
                });
              }
            }}
          />
          <PrimeBenefitsBaseItem
            icon="FileTextOutline"
            title="Analytics"
            subtitle="sint occaecat cupidatat non proident"
            isComingSoon
            onPress={() => {
              if (process.env.NODE_ENV !== 'production') {
                Toast.success({
                  title: 'Analytics',
                });
              }
            }}
          />
        </>
      ) : null}
    </Stack>
  );
}
