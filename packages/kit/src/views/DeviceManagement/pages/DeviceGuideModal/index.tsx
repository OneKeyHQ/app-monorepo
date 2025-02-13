import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Image, Page, SizableText, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

import { useBuyOneKeyHeaderRightButton } from '../../hooks/useBuyOneKeyHeaderRightButton';

function DeviceGuideModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { headerRight } = useBuyOneKeyHeaderRightButton();

  const handleStartConnect = useCallback(() => {
    navigation.push(EOnboardingPages.ConnectYourDevice);
  }, [navigation]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_device_management,
        })}
        headerRight={headerRight}
      />
      <Page.Body>
        <YStack px="$5" alignItems="center" mt={56} mb="$12">
          <Image
            source={require('@onekeyhq/kit/assets/device-management-guide.png')}
            alt="OneKey devices"
            w="100%"
            h={200}
            resizeMode="contain"
          />
        </YStack>

        <YStack alignItems="center" gap="$2" maxWidth="$96" mx="auto">
          <SizableText size="$heading2xl" color="$text" textAlign="center">
            {intl.formatMessage({
              id: ETranslations.global_no_device_connected,
            })}
          </SizableText>
          <SizableText
            size="$bodyLg"
            color="$textSubdued"
            textAlign="center"
            px="$10"
          >
            {intl.formatMessage({
              id: ETranslations.global_no_device_connected_desc,
            })}
          </SizableText>
        </YStack>
        <YStack alignItems="center" mt="$6">
          <Button variant="primary" size="medium" onPress={handleStartConnect}>
            {intl.formatMessage({
              id: ETranslations.global_start_connection,
            })}
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default DeviceGuideModal;
