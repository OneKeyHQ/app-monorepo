import React, { FC, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { Platform } from 'react-native';

import {
  Box,
  Icon,
  Image,
  LottieView,
  Modal,
  Typography,
  ZStack,
} from '@onekeyhq/components';
import Button, { ButtonType } from '@onekeyhq/components/src/Button';
import iconNFCScanHint from '@onekeyhq/kit/assets/hardware/ic_pair_hint_scan_lite.png';
import lottieNFCConnectComplete from '@onekeyhq/kit/assets/hardware/lottie_onekey_lite_nfc_complete.json';
import lottieNFCConnecting from '@onekeyhq/kit/assets/hardware/lottie_onekey_lite_nfc_connect.json';
import lottieNFCTransferData from '@onekeyhq/kit/assets/hardware/lottie_onekey_lite_nfc_transfer.json';
import lottieNFCTransmittingData from '@onekeyhq/kit/assets/hardware/lottie_onekey_lite_nfc_transmitting.json';

export type ConnectType = 'ble' | 'nfc';
export type OperateType = 'guide' | 'connect' | 'transfer' | 'complete';

export type HardwareConnectViewProps = {
  title: string;
  actionState: string;
  actionDescription: string;
  connectType: ConnectType;
  operateType?: OperateType;
  onReadyConnect?: () => void | undefined;
  onCloseConnect?: () => void | undefined;
  onActionPress?: () => void | undefined;
  actionPressStyle?: ButtonType;
  actionPressContent?: string;
};

const HardwareConnect: FC<HardwareConnectViewProps> = ({
  title,
  actionState,
  actionDescription,
  operateType,
  onCloseConnect,
  onActionPress,
  actionPressStyle,
  actionPressContent,
}) => {
  const intl = useIntl();
  const [visibleIosHint, setVisibleIosHint] = useState(false);
  const [lottieConnectingIcon, setLottieConnectingIcon] =
    useState<any>(lottieNFCConnecting);

  useEffect(() => {
    if (operateType === 'guide') {
      setLottieConnectingIcon(lottieNFCConnecting);
      if (Platform.OS === 'ios') {
        setVisibleIosHint(false);
      }
    }
    if (operateType === 'connect') {
      setLottieConnectingIcon(lottieNFCConnecting);
      if (Platform.OS === 'ios') {
        setVisibleIosHint(true);
      }
    }
    if (operateType === 'transfer') {
      setLottieConnectingIcon(lottieNFCTransferData);
      setTimeout(() => {
        setLottieConnectingIcon(lottieNFCTransmittingData);
      }, 1000);
      if (Platform.OS === 'ios') {
        setVisibleIosHint(false);
      }
    }
    if (operateType === 'complete') {
      setLottieConnectingIcon(lottieNFCConnectComplete);
      if (Platform.OS === 'ios') {
        setVisibleIosHint(false);
      }
    }
  }, [operateType]);

  return (
    <>
      <Modal
        hideSecondaryAction
        header={title}
        onClose={() => {
          console.log('HardwareConnect: onClose');

          onCloseConnect?.();
        }}
        footer={
          <Button
            size="xl"
            mx={4}
            mb={Platform.OS === 'ios' ? 12 : 4}
            onPress={() => onActionPress?.()}
            type={actionPressStyle}
          >
            {actionPressContent}
          </Button>
        }
        scrollViewProps={{
          pt: 4,
          children: (
            <Box alignItems="center">
              <Typography.DisplayXLarge
                textAlign="center"
                mt={8}
                mx={9}
                color="text-default"
              >
                {actionState}
              </Typography.DisplayXLarge>
              <Typography.Body1
                textAlign="center"
                mt={2}
                mx={9}
                color="text-subdued"
              >
                {actionDescription}
              </Typography.Body1>

              <ZStack w="100%" h="560px" alignItems="center">
                <ZStack
                  h="360px"
                  w="100%"
                  alignItems="center"
                  justifyContent="center"
                >
                  <LottieView
                    source={lottieConnectingIcon}
                    autoPlay={operateType !== 'guide'}
                    loop={operateType !== 'complete'}
                  />
                </ZStack>
                <Box mt="202px">
                  <Image source={iconNFCScanHint} />
                </Box>
              </ZStack>
            </Box>
          ),
        }}
      />
      {!!visibleIosHint && (
        <Box
          w="100%"
          h="212px"
          bg="action-secondary-default"
          display="none"
          style={{ position: 'absolute' }}
          borderColor="border-hovered"
          borderWidth="1px"
          borderRadius={36}
          borderStyle="dashed"
          alignItems="center"
          justifyContent="center"
        >
          <Icon name="CursorClickOutline" size={48} />
          <Typography.DisplayMedium px={12} mt={5}>
            {intl.formatMessage({
              id: 'content__place_your_onekey_lite_close_to_the_back_of_here',
            })}
          </Typography.DisplayMedium>
        </Box>
      )}
    </>
  );
};
export default HardwareConnect;
