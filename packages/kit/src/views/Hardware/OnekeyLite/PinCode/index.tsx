import React, { FC } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Box, Modal, PinCode, Typography } from '@onekeyhq/components';

import {
  BackupWalletModalRoutes,
  BackupWalletRoutesParams,
} from '../../../BackupWallet/types';

import {
  HardwarePinCodeModalRoutes,
  HardwarePinCodeRoutesParams,
} from './types';

export type OnekeyLitePinCodeViewProp = {
  title?: string;
  description?: string;
  securityReminder?: string;
  onComplete?: (pinCode: string) => Promise<boolean | void>;
};

type NavigationProps = NativeStackNavigationProp<
  BackupWalletRoutesParams,
  BackupWalletModalRoutes
>;

const defaultProps = {
  title: 'Enter Current PIN',
  description: 'Enter current  OneKey Lite PIN before resetting it',
  securityReminder:
    "We don't store any of your information, so if you forget your PIN, wecan't help you get it back.",
} as const;

const OnekeyLitePinCode: FC<OnekeyLitePinCodeViewProp> = ({
  title,
  description,
  securityReminder,
  onComplete,
}) => {
  const route =
    useRoute<
      RouteProp<
        HardwarePinCodeRoutesParams,
        HardwarePinCodeModalRoutes.HardwarePinCodeModal
      >
    >();

  const navigation = useNavigation<NavigationProps>();

  console.log('route', route);
  return (
    <Modal header="PIN" footer={null}>
      <Box alignItems="center" flex={1}>
        <Typography.DisplayXLarge
          mt={8}
          mx={9}
          color="text-default"
          textAlign="center"
        >
          {title}
        </Typography.DisplayXLarge>
        <Typography.Body1 mt={2} mx={9} color="text-subdued" textAlign="center">
          {description}
        </Typography.Body1>

        <Box mt={8}>
          <PinCode
            onCodeCompleted={(pinCode) => {
              console.log('pinCode:', pinCode);
              navigation.navigate(BackupWalletModalRoutes.BackupSeedHintModal);
              return onComplete?.(pinCode) ?? Promise.resolve(false);
            }}
          />
        </Box>
      </Box>
      <Typography.Body2 mb={3} px={8} textAlign="center">
        {securityReminder}
      </Typography.Body2>
    </Modal>
  );
};

OnekeyLitePinCode.defaultProps = defaultProps;
export default OnekeyLitePinCode;
