import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import { useFirmwareVerifyDialog } from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';

import { WalletOptionItem } from './WalletOptionItem';

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
