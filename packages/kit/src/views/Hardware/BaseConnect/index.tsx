import React, { FC, useEffect, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { Animated, Platform } from 'react-native';

import {
  Box,
  Icon,
  Image,
  Modal,
  Typography,
  ZStack,
} from '@onekeyhq/components';
import Button, { ButtonType } from '@onekeyhq/components/src/Button';
import iconHardwareConnecting from '@onekeyhq/kit/assets/ic_pair_hardware_connecting.png';
import iconHardwareConnectComplete from '@onekeyhq/kit/assets/ic_pair_hardware_operation_complete.png';
import iconNFCScanHint from '@onekeyhq/kit/assets/ic_pair_hint_scan_lite.png';
import iconNFCConnecting from '@onekeyhq/kit/assets/ic_pair_nfc.png';
import iconNFCConnectComplete from '@onekeyhq/kit/assets/ic_pair_nfc_operation_successful.png';
import iconNFCTransferData from '@onekeyhq/kit/assets/ic_pair_nfc_transfer.png';

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
  const [operateIcon, setOperateIcon] = useState(iconNFCConnecting);
  const [connectingIcon, setConnectingIcon] = useState(iconHardwareConnecting);

  const hardwareConnectAnimValue = useRef(new Animated.Value(0)).current;
  const hardwareConnectAnim = useRef(
    Animated.loop(
      Animated.timing(hardwareConnectAnimValue, {
        useNativeDriver: false,
        toValue: 1,
        duration: 2000,
      }),
    ),
  ).current;
  const [hardwareConnectAnimRunning, setHardwareConnectAnimRunning] =
    useState(true);

  useEffect(() => {
    if (hardwareConnectAnimRunning) {
      hardwareConnectAnim.start();
    } else {
      hardwareConnectAnim.stop();
      hardwareConnectAnimValue.setValue(0);
    }

    return () => hardwareConnectAnim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hardwareConnectAnimRunning, hardwareConnectAnim]);

  useEffect(() => {
    if (operateType === 'guide') {
      setOperateIcon(iconNFCConnecting);
      setConnectingIcon(iconHardwareConnecting);
      setHardwareConnectAnimRunning(true);
      if (Platform.OS === 'ios') {
        setVisibleIosHint(false);
      }
    }
    if (operateType === 'connect') {
      setOperateIcon(iconNFCConnecting);
      setConnectingIcon(iconHardwareConnecting);
      setHardwareConnectAnimRunning(true);
      if (Platform.OS === 'ios') {
        setVisibleIosHint(true);
      }
    }
    if (operateType === 'transfer') {
      setOperateIcon(iconNFCTransferData);
      setConnectingIcon(iconHardwareConnecting);
      setHardwareConnectAnimRunning(true);
      if (Platform.OS === 'ios') {
        setVisibleIosHint(false);
      }
    }
    if (operateType === 'complete') {
      setOperateIcon(iconNFCConnectComplete);
      setConnectingIcon(iconHardwareConnectComplete);
      setHardwareConnectAnimRunning(false);
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

              <ZStack w="100%" mt={9} h="460px" alignItems="center">
                <ZStack h="300px" alignItems="center" justifyContent="center">
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: hardwareConnectAnimValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg'],
                          }),
                        },
                      ],
                    }}
                  >
                    <Box>
                      <Image source={connectingIcon} />
                    </Box>
                  </Animated.View>
                  <Box pt="30px">
                    <Image source={operateIcon} />
                  </Box>
                </ZStack>
                <Box mt="165px">
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
