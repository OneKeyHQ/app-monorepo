import {
  Anchor,
  Button,
  Heading,
  HeightTransition,
  Icon,
  Image,
  ListItem,
  LottieView,
  Page,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ConnectByBluetoothAnim from '../../../../../assets/animations/connect_by_bluetooth.json';
import ConnectByUSBAnim from '../../../../../assets/animations/connect_by_usb.json';
import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../../router/type';

const DevicesData = [
  {
    name: 'OneKey Classic',
    avatar: require('../../../../../assets/wallet/avatar/Classic.png'),
  },
  {
    name: 'OneKey Mini',
    avatar: require('../../../../../assets/wallet/avatar/Mini.png'),
  },
  {
    name: 'OneKey Touch',
    avatar: require('../../../../../assets/wallet/avatar/Touch.png'),
  },
];

const headerRight = (onPress: () => void) => (
  <HeaderIconButton icon="QuestionmarkOutline" onPress={onPress} />
);

export function LookingForDevices() {
  const navigation = useAppNavigation();
  const handleHeaderRightPress = () => {
    navigation.push(EOnboardingPages.OneKeyHardwareWallet);
  };

  return (
    <Page>
      <Page.Header
        title={
          platformEnv.isNative ? 'Looking for Devices' : 'Connect your device'
        }
        headerRight={() => headerRight(handleHeaderRightPress)}
      />
      <Page.Body>
        <Stack p="$5" pt="$0" mb="$4" alignItems="center" bg="$bgSubdued">
          <LottieView
            source={
              platformEnv.isNative ? ConnectByBluetoothAnim : ConnectByUSBAnim
            }
          />

          <SizableText textAlign="center" color="$textSubdued" mt="$1.5">
            {platformEnv.isNative
              ? 'Please make sure your Bluetooth is enabled'
              : 'Connect your device via USB'}
          </SizableText>
        </Stack>
        <HeightTransition>
          <Stack>
            {DevicesData.map((item, index) => (
              <ListItem
                key={index}
                drillIn
                onPress={() => console.log('clicked')}
                focusable={false}
              >
                <Image
                  width={40}
                  height={40}
                  style={{
                    width: 40,
                    height: 40,
                  }}
                  source={item.avatar}
                />
                <ListItem.Text flex={1} primary={item.name} />
              </ListItem>
            ))}
          </Stack>
        </HeightTransition>
        <XStack
          px="$5"
          py="$0.5"
          mt="auto"
          justifyContent="center"
          alignItems="center"
        >
          <SizableText size="$bodyMd" color="$textSubdued">
            Don't have OneKey yet?
          </SizableText>
          <Anchor
            display="flex"
            href="https://shop.onekey.so/"
            target="_blank"
            size="$bodyMdMedium"
            p="$2"
          >
            Buy One
          </Anchor>
        </XStack>
      </Page.Body>
    </Page>
  );
}
