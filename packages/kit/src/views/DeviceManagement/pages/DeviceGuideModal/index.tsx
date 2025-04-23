import { useCallback } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IImageProps, IXStackProps } from '@onekeyhq/components';
import {
  Empty,
  Image,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import ClassicHomescreenDark from '@onekeyhq/kit/assets/device_management/classic-homescreen-dark.png';
import ClassicHomescreenLight from '@onekeyhq/kit/assets/device_management/classic-homescreen-light.png';
import ProHomescreenDark from '@onekeyhq/kit/assets/device_management/pro-homescreen-dark.png';
import ProHomescreenLight from '@onekeyhq/kit/assets/device_management/pro-homescreen-light.png';
import TouchHomescreenDark from '@onekeyhq/kit/assets/device_management/touch-homescreen-dark.png';
import TouchHomescreenLight from '@onekeyhq/kit/assets/device_management/touch-homescreen-light.png';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import type { IAllWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';

import { useBuyOneKeyHeaderRightButton } from '../../hooks/useBuyOneKeyHeaderRightButton';

function DeviceItem({
  img,
  name,
  bg,
  ...rest
}: IXStackProps & {
  img: IAllWalletAvatarImageNames;
  name: string;
  bg?: IImageProps['source'];
}) {
  return (
    <XStack
      alignItems="center"
      gap="$3"
      w={360}
      px="$5"
      py="$4"
      borderRadius="$4"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderCurve="continuous"
      overflow="hidden"
      {...rest}
    >
      <Image
        source={bg}
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        w={360}
        h={72}
        resizeMode="cover"
      />
      <WalletAvatar wallet={undefined} img={img} />
      <SizableText size="$bodyLgMedium" zIndex={2}>
        {name}
      </SizableText>
    </XStack>
  );
}

function DeviceGuideModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { headerRight } = useBuyOneKeyHeaderRightButton();
  const themeVariant = useThemeVariant();

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
      <Page.Body flex={1} justifyContent="center" gap="$5">
        <YStack alignItems="center">
          <DeviceItem
            img={EDeviceType.Pro}
            name="OneKey Pro"
            elevation={10}
            zIndex={3}
            bg={
              themeVariant === 'light' ? ProHomescreenLight : ProHomescreenDark
            }
          />
          <DeviceItem
            img={EDeviceType.Touch}
            name="OneKey Touch"
            scale={0.9}
            mt={-24}
            elevation={0.5}
            zIndex={2}
            bg={
              themeVariant === 'light'
                ? TouchHomescreenLight
                : TouchHomescreenDark
            }
          />
          <DeviceItem
            img={EDeviceType.Classic}
            name="OneKey Classic"
            scale={0.8}
            mt={-28}
            bg={
              themeVariant === 'light'
                ? ClassicHomescreenLight
                : ClassicHomescreenDark
            }
          />
        </YStack>

        <Empty
          alignSelf="stretch"
          title={intl.formatMessage({
            id: ETranslations.global_no_device_connected,
          })}
          description={intl.formatMessage({
            id: ETranslations.global_no_device_connected_desc,
          })}
          buttonProps={{
            onPress: handleStartConnect,
            children: intl.formatMessage({
              id: ETranslations.global_connect,
            }),
          }}
        />
      </Page.Body>
    </Page>
  );
}

export default DeviceGuideModal;
