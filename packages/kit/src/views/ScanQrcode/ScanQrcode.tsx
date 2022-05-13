import React, { FC, useCallback, useEffect, useState } from 'react';

import {
  NavigationProp,
  RouteProp,
  useIsFocused,
  useRoute,
} from '@react-navigation/core';
import * as Application from 'expo-application';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { PermissionStatus } from 'expo-modules-core';
import { Button } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  Modal,
  Typography,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { UserCreateInputCategory } from '@onekeyhq/engine/src/types/credential';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useNavigation from '../../hooks/useNavigation';

import { scanFromURLAsync } from './scanFromURLAsync';
import SvgScanArea from './SvgScanArea';
import { ScanQrcodeRoutes, ScanQrcodeRoutesParams, ScanResult } from './types';

const { isWeb, isNative: isApp, isIOS } = platformEnv;

type ScanQrcodeRouteProp = RouteProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcode
>;
type ScanQrcodeNavProp = NavigationProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcodeResult
>;
const ScanQrcode: FC = () => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const [currentPermission, setCurrentPermission] = useState<PermissionStatus>(
    PermissionStatus.UNDETERMINED,
  );
  const [scanned, setScanned] = useState(false);
  const isFocused = useIsFocused();

  const navigation = useNavigation<ScanQrcodeNavProp>();
  const route = useRoute<ScanQrcodeRouteProp>();
  const onScanCompleted = route.params?.onScanCompleted;

  const handleBarCodeScanned = useCallback(
    async (data: string | null) => {
      if (!data) {
        return;
      }
      setScanned(true);
      if (onScanCompleted) {
        onScanCompleted(data);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        navigation.goBack();
        return;
      }
      const scanResult: ScanResult = { type: 'other', data };
      if (data.startsWith('https://') || data.startsWith('http://')) {
        scanResult.type = 'url';
      } else {
        const { category, possibleNetworks } =
          await backgroundApiProxy.validator.validateCreateInput(data);
        if (category === UserCreateInputCategory.ADDRESS) {
          scanResult.type = 'address';
          scanResult.possibleNetworks = possibleNetworks;
        }
      }
      navigation.navigate(ScanQrcodeRoutes.ScanQrcodeResult, scanResult);
    },
    [navigation, onScanCompleted],
  );

  const pickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: isWeb,
      allowsMultipleSelection: false,
    });

    if (!result.cancelled) {
      const scanResult = await scanFromURLAsync(result.uri);
      if (scanResult) {
        handleBarCodeScanned(scanResult);
      }
    }
  }, [handleBarCodeScanned]);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setCurrentPermission(status);
    })();
  }, []);

  useEffect(() => {
    if (isFocused) {
      // 页面返回时重新激活扫码功能
      setScanned(false);
    }
  }, [isFocused]);

  const ChooseImageText = isApp ? Typography.Button1 : Typography.Button2;
  if (currentPermission === PermissionStatus.GRANTED) {
    return (
      <Modal
        hidePrimaryAction
        hideSecondaryAction
        header={intl.formatMessage({ id: 'title__scan_qr_code' })}
        footer={
          <Button
            style={{ marginBottom: bottom }}
            onPress={pickImage}
            h={isApp ? '55px' : '45px'}
            variant="unstyled"
            leftIcon={<Icon name="PhotographSolid" size={isApp ? 19 : 15} />}
          >
            <ChooseImageText>
              {intl.formatMessage({ id: 'action__choose_an_image' })}
            </ChooseImageText>
          </Button>
        }
        staticChildrenProps={
          isApp ? { flex: 1 } : { width: '100%', height: 209 }
        }
      >
        {isFocused && (
          <Camera
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onBarCodeScanned={
              scanned ? undefined : ({ data }) => handleBarCodeScanned(data)
            }
            barCodeScannerSettings={{
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              barCodeTypes: [BarCodeScanner.Constants.BarCodeType.qr],
            }}
          >
            <SvgScanArea
              style={{ position: 'absolute' }}
              width={144}
              height={144}
            />
          </Camera>
        )}
      </Modal>
    );
  }
  if (currentPermission === PermissionStatus.DENIED) {
    return (
      <Dialog
        visible
        onClose={() => {
          navigation.getParent()?.goBack();
        }}
        contentProps={{
          icon: <Icon name="ExclamationOutline" size={48} />,
          title: intl.formatMessage({
            id: 'modal__camera_access_not_granted',
          }),
          content: intl.formatMessage({
            id: 'modal__camera_access_not_granted_desc',
          }),
        }}
        footerButtonProps={
          isWeb
            ? { hidePrimaryAction: true }
            : {
                primaryActionProps: {
                  children: intl.formatMessage({ id: 'action__go_to_setting' }),
                },
                onPrimaryActionPress: ({ onClose }) => {
                  onClose?.();
                  if (isIOS) {
                    Linking.openURL('app-settings:');
                  } else {
                    IntentLauncher.startActivityAsync(
                      IntentLauncher.ActivityAction
                        .APPLICATION_DETAILS_SETTINGS,
                      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                      { data: `package:${Application.applicationId!}` },
                    );
                  }
                },
              }
        }
      />
    );
  }
  return null;
};
ScanQrcode.displayName = 'ScanQrcode';

export default ScanQrcode;
