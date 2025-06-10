import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import { Badge, Icon, Stack, Toast, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';

import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';

function PrimeBenefitsItem({
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
    <ListItem drillIn={!isComingSoon} onPress={onPress}>
      <YStack borderRadius="$3" borderCurve="continuous" bg="$brand4" p="$2">
        <Icon name={icon} size="$6" color="$brand9" />
      </YStack>
      <ListItem.Text
        userSelect="none"
        flex={1}
        primary={title}
        secondary={subtitle}
      />
      {isComingSoon ? (
        <Badge badgeSize="sm">
          <Badge.Text>
            {intl.formatMessage({
              id: ETranslations.id_prime_soon,
            })}
          </Badge.Text>
        </Badge>
      ) : null}
    </ListItem>
  );
}

export function PrimeBenefitsList() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const { ensureOneKeyIDLoggedIn } = usePrimeRequirements();

  return (
    <Stack py="$2">
      <PrimeBenefitsItem
        icon="CloudSyncOutline"
        title={intl.formatMessage({
          id: ETranslations.global_onekey_cloud,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.prime_onekey_cloud_desc,
        })}
        onPress={() => {
          navigation.navigate(EPrimePages.PrimeCloudSync);
        }}
      />
      <PrimeBenefitsItem
        icon="PhoneOutline"
        title={intl.formatMessage({
          id: ETranslations.global_device_management,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.prime_device_management_desc,
        })}
        onPress={async () => {
          await ensureOneKeyIDLoggedIn();
          navigation.pushFullModal(EModalRoutes.PrimeModal, {
            screen: EPrimePages.PrimeDeviceLimit,
          });
        }}
      />
      <PrimeBenefitsItem
        isComingSoon
        icon="Copy3Outline"
        title={intl.formatMessage({
          id: ETranslations.global_bulk_copy_addresses,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.prime_bulk_copy_addresses_desc,
        })}
        onPress={() => {
          if (process.env.NODE_ENV !== 'production') {
            Toast.success({
              title: 'Bulk Copy Addresses',
            });
          }
        }}
      />
      <PrimeBenefitsItem
        isComingSoon
        icon="UndoOutline"
        title={intl.formatMessage({
          id: ETranslations.global_bulk_revoke,
        })}
        subtitle={intl.formatMessage({
          id: ETranslations.global_bulk_revoke_desc,
        })}
        onPress={() => {
          if (process.env.NODE_ENV !== 'production') {
            Toast.success({
              title: 'Bulk Revoke',
            });
          }
        }}
      />

      {platformEnv.isDev ? (
        <>
          <PrimeBenefitsItem
            isComingSoon
            icon="BezierNodesOutline"
            title="Premium RPC"
            subtitle="Enjoy rapid and secure blockchain access."
            onPress={() => {
              if (process.env.NODE_ENV !== 'production') {
                Toast.success({
                  title: 'Premium RPC',
                });
              }
            }}
          />
          <PrimeBenefitsItem
            isComingSoon
            icon="BellOutline"
            title="Account Activity"
            subtitle="Subscribe to activities from up to 100 accounts."
            onPress={() => {
              if (process.env.NODE_ENV !== 'production') {
                Toast.success({
                  title: 'Account Activity',
                });
              }
            }}
          />
          <PrimeBenefitsItem
            isComingSoon
            icon="FileTextOutline"
            title="Analytics"
            subtitle="sint occaecat cupidatat non proident"
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
