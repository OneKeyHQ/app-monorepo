import { useState } from 'react';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Dialog,
  SizableText,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';

import { WalletOptionItem } from './WalletOptionItem';

function Content() {
  <Stack space="$5">
    <Stack borderRadius="$3" bg="$bgSubdued" borderCurve="continuous">
      <Spinner size="large" />
    </Stack>
  </Stack>;
}

export function Verification() {
  const [verified, setVerified] = useState(false);
  // const [unUnofficial, setUnofficial] = useState(false);
  const [unUnofficial] = useState(false);
  const returnVerified = () => {
    setVerified(true);
    Toast.success({
      title: 'Verified',
      message: 'You are good to go',
    });
  };

  // const returnUnofficial = () => {
  //   setUnofficial(true);
  //   Toast.error({
  //     title: 'Unofficial',
  //     message: 'Please contact support',
  //   });
  // };

  const getIconNameAndIconColor = (): {
    iconName: IKeyOfIcons;
    iconColor: IIconProps['color'];
  } => {
    if (verified) {
      return {
        iconName: 'BadgeVerifiedSolid',
        iconColor: '$iconSuccess',
      };
    }

    if (unUnofficial) {
      return {
        iconName: 'ErrorSolid',
        iconColor: '$iconCritical',
      };
    }

    return {
      iconName: 'DocumentSearch2Outline',
      iconColor: '$iconSubdued',
    };
  };

  const { iconColor, iconName } = getIconNameAndIconColor();

  return (
    <WalletOptionItem
      icon={iconName}
      iconColor={iconColor}
      label="Device Authentication"
      onPress={() => {
        const dialog = Dialog.show({
          tone: 'success',
          icon: 'DocumentSearch2Outline',
          title: 'Device Authentication',
          description:
            'Confirm on your device to verify its authenticity and secure your connection.',
          renderContent: (
            <Stack borderRadius="$3" bg="$bgSubdued" p="$5">
              <Spinner size="large" />
              <SizableText textAlign="center" mb="$2" mt="$5">
                Confirming if the firmware is officially released by OneKey
              </SizableText>
            </Stack>
          ),
          showFooter: false,
        });

        // setTimeout(async () => {
        //   // TODO: dialog.close().then(() => doDomeThing())
        //   await dialog.close();

        //   // if official
        //   returnVerified();

        //   // if unofficial
        //   // returnUnofficial();
        // }, 1500);
      }}
    />
  );
}
