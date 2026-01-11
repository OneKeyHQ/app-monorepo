import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Icon,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  formatEndpointForDisplay,
  getDistributorInfo,
  isKnownDistributor,
  PUSH_PROVIDER_PRIVACY_INFO,
} from '@onekeyhq/shared/src/utils/unifiedPushUtils';

interface IUnifiedPushDistributor {
  packageName: string;
  name: string;
}

interface IUnifiedPushStatus {
  isAvailable: boolean;
  isRegistered: boolean;
  endpoint: string | null;
  distributor: string | null;
  distributors: IUnifiedPushDistributor[];
}

/**
 * UnifiedPush Settings Component
 *
 * Allows users to:
 * - See if UnifiedPush is available on their device
 * - Select a UnifiedPush distributor
 * - Register/unregister for push notifications
 * - View current endpoint status
 */
export function UnifiedPushSettings() {
  const [status, setStatus] = useState<IUnifiedPushStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!platformEnv.isNative) {
      setStatus({
        isAvailable: false,
        isRegistered: false,
        endpoint: null,
        distributor: null,
        distributors: [],
      });
      setIsLoading(false);
      return;
    }

    try {
      const provider =
        await backgroundApiProxy.serviceNotification.getUnifiedPushProvider();

      if (!provider) {
        setStatus({
          isAvailable: false,
          isRegistered: false,
          endpoint: null,
          distributor: null,
          distributors: [],
        });
        setIsLoading(false);
        return;
      }

      const [isRegistered, distributors, distributor, endpoint] =
        await Promise.all([
          provider.isRegistered(),
          provider.getDistributors(),
          provider.getCurrentDistributor(),
          Promise.resolve(provider.getEndpoint()),
        ]);

      setStatus({
        isAvailable: provider.isAvailable(),
        isRegistered,
        endpoint,
        distributor,
        distributors,
      });
    } catch (error) {
      console.error('Failed to get UnifiedPush status:', error);
      setStatus({
        isAvailable: false,
        isRegistered: false,
        endpoint: null,
        distributor: null,
        distributors: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleSelectDistributor = useCallback(
    async (packageName: string) => {
      setIsLoading(true);
      try {
        const provider =
          await backgroundApiProxy.serviceNotification.getUnifiedPushProvider();
        if (provider) {
          await provider.selectDistributor(packageName);
          await refreshStatus();
        }
      } catch (error) {
        console.error('Failed to select distributor:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [refreshStatus],
  );

  const handleRegister = useCallback(async () => {
    setIsRegistering(true);
    try {
      const provider =
        await backgroundApiProxy.serviceNotification.getUnifiedPushProvider();
      if (provider) {
        await provider.register();
        // Wait a bit for the registration to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await refreshStatus();
      }
    } catch (error) {
      console.error('Failed to register:', error);
    } finally {
      setIsRegistering(false);
    }
  }, [refreshStatus]);

  const handleUnregister = useCallback(async () => {
    setIsRegistering(true);
    try {
      const provider =
        await backgroundApiProxy.serviceNotification.getUnifiedPushProvider();
      if (provider) {
        await provider.unregister();
        await refreshStatus();
      }
    } catch (error) {
      console.error('Failed to unregister:', error);
    } finally {
      setIsRegistering(false);
    }
  }, [refreshStatus]);

  if (isLoading) {
    return (
      <Stack padding="$4" alignItems="center">
        <Spinner size="large" />
        <SizableText marginTop="$2">Loading UnifiedPush status...</SizableText>
      </Stack>
    );
  }

  if (!platformEnv.isNative) {
    return (
      <Stack padding="$4">
        <SizableText color="$textSubdued">
          UnifiedPush is only available on mobile devices.
        </SizableText>
      </Stack>
    );
  }

  if (!status?.isAvailable) {
    return (
      <YStack padding="$4" gap="$3">
        <XStack alignItems="center" gap="$2">
          <Icon name="ShieldCheckSolid" color="$iconSubdued" size="$5" />
          <SizableText size="$headingMd" fontWeight="600">
            UnifiedPush
          </SizableText>
        </XStack>

        <SizableText color="$textSubdued">
          UnifiedPush is a privacy-friendly push notification system that
          doesn&apos;t require Google Play Services.
        </SizableText>

        <Stack
          backgroundColor="$bgInfoSubdued"
          padding="$3"
          borderRadius="$3"
        >
          <SizableText size="$bodySm">
            To use UnifiedPush, you need to install a distributor app:
          </SizableText>
          <SizableText size="$bodySm" marginTop="$2">
            • <SizableText fontWeight="600">ntfy</SizableText> - Simple and
            self-hostable
          </SizableText>
          <SizableText size="$bodySm">
            • <SizableText fontWeight="600">NextPush</SizableText> - For
            Nextcloud users
          </SizableText>
          <SizableText size="$bodySm">
            • <SizableText fontWeight="600">UP-FCM</SizableText> - Uses Google
            FCM (less private)
          </SizableText>
        </Stack>

        <SizableText size="$bodySm" color="$textSubdued">
          Learn more at unifiedpush.org
        </SizableText>
      </YStack>
    );
  }

  const distributorInfo = status.distributor
    ? getDistributorInfo(status.distributor)
    : null;

  return (
    <YStack gap="$2">
      <XStack alignItems="center" gap="$2" padding="$4" paddingBottom="$2">
        <Icon name="ShieldCheckSolid" color="$iconSuccess" size="$5" />
        <SizableText size="$headingMd" fontWeight="600">
          UnifiedPush
        </SizableText>
        <Stack
          backgroundColor="$bgSuccess"
          paddingHorizontal="$2"
          paddingVertical="$0.5"
          borderRadius="$1"
        >
          <SizableText size="$bodyXs" color="$textSuccess">
            Available
          </SizableText>
        </Stack>
      </XStack>

      <Stack paddingHorizontal="$4" paddingBottom="$2">
        <SizableText size="$bodySm" color="$textSubdued">
          Privacy-friendly push notifications without Google Play Services
        </SizableText>
      </Stack>

      {/* Current Distributor */}
      <ListItem
        title="Distributor"
        subtitle={
          distributorInfo?.displayName ||
          status.distributor ||
          'Not selected'
        }
        subtitleProps={{
          color: status.distributor ? '$text' : '$textSubdued',
        }}
      >
        {status.distributor && isKnownDistributor(status.distributor) && (
          <Icon name="CheckCircleSolid" color="$iconSuccess" size="$5" />
        )}
      </ListItem>

      {/* Distributor Selection */}
      {status.distributors.length > 1 && (
        <YStack paddingHorizontal="$4" gap="$2">
          <SizableText size="$bodySmMedium">
            Available Distributors
          </SizableText>
          {status.distributors.map((dist: IUnifiedPushDistributor) => {
            const info = getDistributorInfo(dist.packageName);
            const isSelected = dist.packageName === status.distributor;
            return (
              <Stack
                key={dist.packageName}
                padding="$3"
                borderRadius="$2"
                borderWidth={1}
                borderColor={isSelected ? '$borderSuccess' : '$borderSubdued'}
                backgroundColor={isSelected ? '$bgSuccessSubdued' : '$bg'}
                pressStyle={{ opacity: 0.7 }}
                onPress={() => handleSelectDistributor(dist.packageName)}
              >
                <XStack justifyContent="space-between" alignItems="center">
                  <YStack flex={1}>
                    <SizableText fontWeight="600">
                      {info?.displayName || dist.name}
                    </SizableText>
                    {info?.description && (
                      <SizableText size="$bodySm" color="$textSubdued">
                        {info.description}
                      </SizableText>
                    )}
                  </YStack>
                  {isSelected && (
                    <Icon
                      name="CheckCircleSolid"
                      color="$iconSuccess"
                      size="$5"
                    />
                  )}
                </XStack>
              </Stack>
            );
          })}
        </YStack>
      )}

      {/* Registration Status */}
      <ListItem
        title="Status"
        subtitle={status.isRegistered ? 'Registered' : 'Not registered'}
        subtitleProps={{
          color: status.isRegistered ? '$textSuccess' : '$textSubdued',
        }}
      >
        <Stack
          width={10}
          height={10}
          borderRadius={5}
          backgroundColor={status.isRegistered ? '$bgSuccess' : '$bgSubdued'}
        />
      </ListItem>

      {/* Endpoint */}
      {status.endpoint && (
        <ListItem
          title="Endpoint"
          subtitle={formatEndpointForDisplay(status.endpoint)}
          subtitleProps={{
            size: '$bodySm',
            color: '$textSubdued',
          }}
        />
      )}

      {/* Register/Unregister Button */}
      <Stack padding="$4">
        {status.isRegistered ? (
          <Button
            variant="secondary"
            onPress={handleUnregister}
            disabled={isRegistering}
          >
            {isRegistering ? <Spinner size="small" /> : 'Unregister'}
          </Button>
        ) : (
          <Button
            variant="primary"
            onPress={handleRegister}
            disabled={isRegistering || !status.distributor}
          >
            {isRegistering ? <Spinner size="small" /> : 'Register'}
          </Button>
        )}
      </Stack>

      {/* Privacy Info */}
      <Stack
        marginHorizontal="$4"
        padding="$3"
        backgroundColor="$bgSuccessSubdued"
        borderRadius="$3"
      >
        <XStack alignItems="center" gap="$2" marginBottom="$2">
          <Icon name="LockKeyholeSolid" color="$iconSuccess" size="$4" />
          <SizableText size="$bodySmMedium" color="$textSuccess">
            Privacy Benefits
          </SizableText>
        </XStack>
        <SizableText size="$bodySm" color="$text">
          {PUSH_PROVIDER_PRIVACY_INFO.unifiedpush.description}
        </SizableText>
      </Stack>
    </YStack>
  );
}

export default UnifiedPushSettings;
