import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import axios from 'axios';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Modal,
  Spinner,
  Text,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import { Device } from '@onekeyhq/engine/src/types/device';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import { CERTIFICATE_URL } from '@onekeyhq/kit/src/config';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { getTimeStamp, hexlify } from '@onekeyhq/kit/src/utils/helper';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareVerifyModal
>;

type HardwareVerifyDetail = {
  walletId: string;
};

const ErrorMessage: FC<{ messageKey: string }> = ({ messageKey }) => {
  const intl = useIntl();
  let message = intl.formatMessage({ id: 'action__verify_request_failed' });
  if (messageKey === 'SN_MISMATCH') {
    message = intl.formatMessage({ id: 'action__verify_sn_mismatch' });
  }

  if (messageKey === 'PARAMS_INVALID') {
    message = intl.formatMessage({ id: 'action__verify_params_invalid' });
  }

  if (messageKey === 'SIGNATURE_INVALID') {
    message = intl.formatMessage({ id: 'action__verify_sig_invalid' });
  }

  if (messageKey === 'REQUEST_FAILED') {
    message = intl.formatMessage({ id: 'action__verify_request_failed' });
  }

  if (messageKey === 'SERVER_FAILED') {
    message = intl.formatMessage({ id: 'action__verify_server_failed' });
  }

  if (messageKey === 'CERT_INVALID') {
    message = intl.formatMessage({ id: 'action__verify_cert_invalid' });
  }

  return (
    <Typography.Body2Underline px={8} textAlign="center" color="text-subdued">
      {message}
    </Typography.Body2Underline>
  );
};

const OnekeyHardwareVerifyDetail: FC<HardwareVerifyDetail> = ({ walletId }) => {
  const intl = useIntl();
  const navigation = useNavigation();

  const { engine, serviceHardware } = backgroundApiProxy;

  const [device, setDevice] = useState<Device>();

  const [requestState, setRequestState] = useState<{
    isLoading: boolean;
    errorKey: string;
    success: boolean;
  }>({ isLoading: true, errorKey: '', success: false });

  const handleGetDeviceSigResponse = useCallback(async () => {
    const deviceConnectId = device?.mac;
    const deviceType = device?.deviceType;
    const deviceSN = device?.uuid;
    if (!deviceConnectId || !deviceType) return;
    setRequestState({
      isLoading: true,
      errorKey: '',
      success: false,
    });

    const ts = getTimeStamp();
    const dataHex = hexlify(ts).replace(/^0x/, '');
    const sigResponse = await serviceHardware.getDeviceCertWithSig(
      deviceConnectId,
      dataHex,
    );
    try {
      const { data } = await axios.post<{
        success: boolean;
        sn?: string;
        code?: string;
      }>(CERTIFICATE_URL, {
        model: deviceType,
        data: dataHex,
        ...sigResponse,
      });
      if (data.sn !== deviceSN || !data.success) {
        setRequestState({
          isLoading: false,
          errorKey: data.code || 'SN_MISMATCH',
          success: false,
        });
        return;
      }

      setRequestState({
        isLoading: false,
        errorKey: '',
        success: true,
      });
    } catch (e) {
      setRequestState({
        isLoading: false,
        errorKey: 'SERVER_FAILED',
        success: false,
      });
    }
  }, [serviceHardware, device?.mac, device?.deviceType, device?.uuid]);

  useEffect(() => {
    handleGetDeviceSigResponse();
  }, [handleGetDeviceSigResponse]);

  useEffect(() => {
    (async () => {
      try {
        const d = await engine.getHWDeviceByWalletId(walletId);
        if (!d?.mac) throw new Error();
        setDevice(d);
      } catch (err: any) {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }

        const { className, key } = err || {};
        if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
          ToastManager.show({
            title: intl.formatMessage({ id: key }),
          });
        } else {
          ToastManager.show({
            title: intl.formatMessage({
              id: 'action__connection_timeout',
            }),
          });
        }
      }
    })();
  }, [engine, intl, navigation, serviceHardware, walletId]);

  const verifyChildren = useMemo(() => {
    if (requestState?.isLoading) {
      return (
        <Center
          flex="1"
          minHeight={240}
          justifyContent="center"
          alignItems="center"
          alignSelf="center"
        >
          <Box alignItems="center">
            <Text fontSize={56}>🔍</Text>
            <Box
              alignItems="center"
              flexDirection="row"
              justifyContent="center"
              mt="2"
            >
              <Spinner />
              <Typography.Heading ml="2">
                {intl.formatMessage({ id: 'action__verify_loading' })}
              </Typography.Heading>
            </Box>
          </Box>
        </Center>
      );
    }

    if (requestState?.success) {
      return (
        <Center
          flex="1"
          minHeight={240}
          justifyContent="center"
          alignItems="center"
          alignSelf="center"
        >
          <Box alignItems="center">
            <Text fontSize={56}>🎉</Text>
            <Box
              alignItems="center"
              flexDirection="row"
              justifyContent="center"
              mt="2"
            >
              <Typography.Heading ml="2">
                {intl.formatMessage({ id: 'action__verify_success' })}
              </Typography.Heading>
            </Box>
          </Box>
        </Center>
      );
    }

    if (requestState?.errorKey) {
      return (
        <Center
          flex="1"
          minHeight={240}
          justifyContent="center"
          alignItems="center"
          alignSelf="center"
        >
          <Box alignItems="center">
            <Text fontSize={56}>🙁</Text>
            <Box
              alignItems="center"
              flexDirection="row"
              justifyContent="center"
              my="2"
            >
              <Typography.Heading ml="2">
                {intl.formatMessage({ id: 'action__verify_failed' })}
              </Typography.Heading>
            </Box>
            <ErrorMessage messageKey={requestState.errorKey} />
            <Button type="primary" onPress={handleGetDeviceSigResponse} mt="4">
              {intl.formatMessage({ id: 'action_retry' })}
            </Button>
          </Box>
        </Center>
      );
    }
  }, [requestState, intl, handleGetDeviceSigResponse]);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      h="100%"
      justifyContent="space-between"
    >
      {verifyChildren}
    </Box>
  );
};

const OneKeyHardwareVerify: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId } = route?.params;

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__verify' })}
      headerDescription=""
      footer={null}
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 24,
        },
        children: (
          <Protected walletId={walletId}>
            {() => <OnekeyHardwareVerifyDetail walletId={walletId} />}
          </Protected>
        ),
      }}
    />
  );
};

export default React.memo(OneKeyHardwareVerify);
