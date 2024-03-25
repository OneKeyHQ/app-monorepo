import { useState } from 'react';

import { StyleSheet } from 'react-native';

import type {
  IButtonProps,
  IIconProps,
  IKeyOfIcons,
} from '@onekeyhq/components';
import { Button, SizableText, Spinner, Stack } from '@onekeyhq/components';
import { useFirmwareVerifyDialog } from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { WalletOptionItem } from './WalletOptionItem';

function DeviceVerificationDialogContent({ loading }: { loading?: boolean }) {
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
            $md={
              {
                size: 'large',
              } as IButtonProps
            }
            variant="primary"
          >
            Continue (or Contact us)
          </Button>
          {!isShowingRiskWarning ? (
            <Button
              key="continue-anyway"
              $md={
                {
                  size: 'large',
                } as IButtonProps
              }
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
                $md={
                  {
                    size: 'large',
                  } as IButtonProps
                }
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

export function Verification({ device }: { device?: IDBDevice | undefined }) {
  // const returnVerified = () => {
  //   setVerified(true);
  //   Toast.success({
  //     title: 'Verified',
  //     message: 'You are good to go',
  //   });
  // };

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
    if (device?.verifiedAtVersion) {
      return {
        iconName: 'BadgeVerifiedSolid',
        iconColor: '$iconSuccess',
      };
    }

    if (device?.verifiedAtVersion === '') {
      // unUnofficial device cannot create a wallet
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

  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog({
    noContinue: true,
  });

  return (
    <WalletOptionItem
      icon={iconName}
      iconColor={iconColor}
      // icon="BadgeVerifiedSolid"
      // iconColor="$iconSuccess"
      label="Device Authentication"
      onPress={async () => {
        if (!device) {
          return;
        }
        await showFirmwareVerifyDialog({
          device,
          onContinue: async ({ checked }) => {
            console.log(checked);
          },
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
