import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

import { Animated } from 'react-native';

import {
  Box,
  Dialog,
  Icon,
  Image,
  Modal,
  Typography,
  ZStack,
} from '@onekeyhq/components';
import iconHardwareConnecting from '@onekeyhq/kit/assets/ic_pair_hardware_connecting.png';
import iconHardwareConnectComplete from '@onekeyhq/kit/assets/ic_pair_hardware_operation_complete.png';
import iconNFCScanHint from '@onekeyhq/kit/assets/ic_pair_hint_scan_lite.png';
import iconNFCConnecting from '@onekeyhq/kit/assets/ic_pair_nfc.png';
import iconNFCConnectComplete from '@onekeyhq/kit/assets/ic_pair_nfc_operation_successful.png';
import iconNFCTransferData from '@onekeyhq/kit/assets/ic_pair_nfc_transfer.png';

import { HardwareConnectViewProps, OperateType } from './types';

const HardwareConnect: FC<HardwareConnectViewProps> = () => {
  // const { title, connectType } = route.params.defaultValue;
  // console.log('connectType', connectType);

  // const route = useRoute<HardwareConnectRouteProp>();
  // const { defaultValues } = route.params;
  // console.log('route', defaultValues);

  const title = 'Onekey Lite';
  const actionState = 'Searching...';
  const actionDescription =
    'Please keep Lite placed with the phone until the device is found';

  const [visibleDialog, setVisibleDialog] = useState(false);
  const [visibleIosHint, setVisibleIosHint] = useState(false);
  const [operateIcon, setOperateIcon] = useState(iconNFCConnecting);

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
  const operateType: OperateType = 'connect';

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

  useCallback(() => {
    if (operateType === 'connect') {
      setOperateIcon(iconNFCConnecting);
      setHardwareConnectAnimRunning(true);
    } else if (operateType === 'transfer') {
      setOperateIcon(iconNFCTransferData);
      setHardwareConnectAnimRunning(true);
    } else {
      setOperateIcon(iconNFCConnectComplete);
      setHardwareConnectAnimRunning(false);
    }
  }, [operateType]);

  const scanHardwareSpin = hardwareConnectAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const viewDialog = () => (
    <Dialog
      visible={visibleDialog}
      onClose={() => setVisibleDialog(false)}
      contentProps={{
        iconType: 'danger',
        title: 'This Device Contains Backup',
        content:
          'If you continue, your previous backup will be fully overwritten and will be lost forever.',
      }}
      footerButtonProps={{
        primaryActionProps: { type: 'destructive' },
        onPrimaryActionPress: () => setVisibleIosHint(true),
        onSecondaryActionPress: () => setVisibleIosHint(false),
      }}
    />
  );

  return (
    <>
      <Modal
        hideSecondaryAction
        header={title}
        onPrimaryActionPress={() => setVisibleDialog(true)}
        scrollViewProps={{
          pt: 4,
          children: (
            <Box alignItems="center">
              <Typography.DisplayXLarge mt={8} mx={9} color="text-default">
                {actionState}
              </Typography.DisplayXLarge>
              <Typography.Body1 mt={2} mx={9} color="text-subdued">
                {actionDescription}
              </Typography.Body1>

              <ZStack w="100%" mt={9} h="460px" alignItems="center">
                <ZStack h="300px" alignItems="center" justifyContent="center">
                  <Animated.View
                    style={{ transform: [{ rotate: scanHardwareSpin }] }}
                  >
                    <Box>
                      <Image
                        source={
                          // @ts-expect-error
                          operateType === 'complete'
                            ? iconHardwareConnectComplete
                            : iconHardwareConnecting
                        }
                      />
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
                    Place Your Onekey Lite Close to the Back of Here
                  </Typography.DisplayMedium>
                </Box>
              )}
            </Box>
          ),
        }}
      />
      {viewDialog()}
    </>
  );
};
export default HardwareConnect;
