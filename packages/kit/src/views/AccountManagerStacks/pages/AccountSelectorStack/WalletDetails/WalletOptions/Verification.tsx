import { useState } from 'react';

import { StyleSheet } from 'react-native';

import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  HeightTransition,
  SizableText,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';

import { WalletOptionItem } from './WalletOptionItem';

function Content({ loading }: { loading?: boolean }) {
  const [isShowingRiskWarning, setIsShowingRiskWarning] = useState(false);

  return (
    <Stack space="$5">
      {loading ? (
        <Stack
          p="$5"
          bg="$bgSubdued"
          borderRadius="$3"
          borderCurve="continuous"
        >
          <Spinner size="large" />
        </Stack>
      ) : (
        <Stack space="$4">
          <Button
            $md={{
              size: 'large',
            }}
            variant="primary"
          >
            Continue (or Contact us)
          </Button>
          {!isShowingRiskWarning ? (
            <Button
              key="continue-anyway"
              $md={{
                size: 'large',
              }}
              variant="tertiary"
              mx="$0"
              onPress={() => setIsShowingRiskWarning(true)}
            >
              Continue Anyway
            </Button>
          ) : (
            <Stack
              key="risk-warning"
              p="$5"
              space="$5"
              bg="$bgCautionSubdued"
              borderRadius="$3"
              borderCurve="continuous"
              borderWidth={StyleSheet.hairlineWidth}
              borderColor="$borderCautionSubdued"
            >
              <SizableText>
                We're currently unable to verify your device. Continuing may
                pose security risks.
              </SizableText>
              <Button
                $md={{
                  size: 'large',
                }}
              >
                I Understand
              </Button>
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );
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
          renderContent: <Content />,
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
