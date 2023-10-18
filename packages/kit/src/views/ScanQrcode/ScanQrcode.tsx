import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useIsFocused, useRoute } from '@react-navigation/core';
import { requestPermissionsAsync as requestCameraPermissionsAsync } from 'expo-barcode-scanner';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { PermissionStatus } from 'expo-modules-core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  HStack,
  Modal,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { getClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import PermissionDialog from '../../components/PermissionDialog/PermissionDialog';
import useNavigation from '../../hooks/useNavigation';
import { handleScanResult } from '../../utils/gotoScanQrcode';
import { showMigrateDataModal } from '../Onboarding/screens/Migration/ConnectServer/MigrateDataModal';
import { OneKeyMigrateQRCodePrefix } from '../Onboarding/screens/Migration/util';

import { PermitDeniedDialog } from './PermitDeniedDialog';
import ScanCamera from './ScanCamera';
import { scanFromURLAsync } from './scanFromURLAsync';
import { ScanQrcodeRoutes, ScanSubResultCategory } from './types';

import type { ScanQrcodeRoutesParams } from './types';
import type { NavigationProp, RouteProp } from '@react-navigation/core';

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
  const scanned = useRef(false);
  const isFocused = useIsFocused();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<ScanQrcodeNavProp>();

  const route = useRoute<ScanQrcodeRouteProp>();
  const onScanCompleted = route.params?.onScanCompleted;

  const handleBarCodeScanned = useCallback(
    (data?: string | null) => {
      if (scanned.current || !data) {
        return;
      }
      scanned.current = true;
      if (onScanCompleted) {
        onScanCompleted(data);
        navigation.goBack();
        return;
      }
      const scanResult = handleScanResult(data);
      if (scanResult) {
        if (scanResult.type === ScanSubResultCategory.MIGRATE) {
          navigation.goBack();
          setTimeout(() => {
            showMigrateDataModal({
              serverAddress: data.replace(OneKeyMigrateQRCodePrefix, ''),
            });
          }, 150);
          return;
        }
        // @ts-expect-error type missing
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        navigation.replace(ScanQrcodeRoutes.ScanQrcodeResult, scanResult);
      } else {
        navigation.goBack();
      }
    },
    [navigation, onScanCompleted],
  );

  const pickImage = useCallback(async () => {
    const result = await launchImageLibraryAsync({
      base64: !platformEnv.isNative,
      allowsMultipleSelection: false,
    });

    if (!result.canceled) {
      const data = await scanFromURLAsync(result.assets[0].uri);
      if (data) handleBarCodeScanned(data);
    }
  }, [handleBarCodeScanned]);

  const pasteData = useCallback(async () => {
    handleBarCodeScanned(await getClipboard());
  }, [handleBarCodeScanned]);

  useEffect(() => {
    requestCameraPermissionsAsync().then(({ status }) =>
      setCurrentPermission(status),
    );
  }, []);

  useEffect(() => {
    if (isFocused) {
      // reactivate scanning when return to this page
      scanned.current = false;
    }
  }, [isFocused]);

  if (currentPermission === PermissionStatus.GRANTED) {
    return (
      <Modal
        hidePrimaryAction
        hideSecondaryAction
        header={intl.formatMessage({ id: 'title__scan_qr_code' })}
        headerDescription={
          platformEnv.isNativeIOSPhone ? <Box h="8px" /> : undefined
        }
        height="535px"
        footer={
          <HStack
            mb={bottom}
            py="16px"
            px={isVerticalLayout ? '16px' : '24px'}
            space="12px"
            justifyContent="center"
          >
            <Button
              flexGrow={isVerticalLayout ? 1 : undefined}
              size={isVerticalLayout ? 'xl' : 'base'}
              onPress={pickImage}
              leftIconName="PhotoMini"
            >
              {intl.formatMessage({ id: 'action__choose_an_image' })}
            </Button>
            {platformEnv.canGetClipboard ? (
              <Button
                flexGrow={isVerticalLayout ? 1 : undefined}
                size={isVerticalLayout ? 'xl' : 'base'}
                leftIconName="ClipboardMini"
                onPress={pasteData}
              >
                {intl.formatMessage({ id: 'action__paste' })}
              </Button>
            ) : null}
          </HStack>
        }
        staticChildrenProps={{ flex: 1 }}
      >
        <ScanCamera
          style={{
            flex: 1,
          }}
          isActive={isFocused}
          onQrcodeScanned={handleBarCodeScanned}
        >
          <Center
            position="absolute"
            top={0}
            right={0}
            bottom={0}
            left={0}
            overflow="hidden"
          >
            <Box
              borderWidth={400}
              borderColor="rgba(0,0,0,.5)"
              borderRadius="425px"
            >
              <Box
                size="256px"
                borderWidth={4}
                borderColor="white"
                borderRadius="24px"
              />
            </Box>
          </Center>
        </ScanCamera>
      </Modal>
    );
  }
  if (currentPermission === PermissionStatus.DENIED) {
    if (platformEnv.isExtension) {
      return <PermitDeniedDialog />;
    }
    return <PermissionDialog type="camera" />;
  }
  return null;
};
ScanQrcode.displayName = 'ScanQrcode';

export default ScanQrcode;
