import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  ConfirmHighlighter,
  Page,
  QRCode,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';

import { useAccountData } from '../../../hooks/useAccountData';

import type { RouteProp } from '@react-navigation/core';

function ReceiveInvoice() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalReceiveParamList, EModalReceiveRoutes.ReceiveInvoice>
    >();

  const { networkId, accountId, paymentRequest, paymentHash } = route.params;
  const { account, network } = useAccountData({
    accountId,
    networkId,
  });

  // TODO: check invoices state
  // // polling check for invoice status
  // const timerRef = useRef<ReturnType<typeof setInterval>>();
  // useEffect(() => {
  //   if (!paymentHash || !networkId || !accountId) return;
  //   const { serviceLightningNetwork } = backgroundApiProxy;
  //   timerRef.current = setInterval(() => {
  //     serviceLightningNetwork
  //       .fetchSpecialInvoice({
  //         paymentHash,
  //         networkId,
  //         accountId,
  //       })
  //       .then((res) => {
  //         if (res.is_paid) {
  //           ToastManager.show({
  //             title: intl.formatMessage({ id: 'msg__payment_received' }),
  //           });
  //           clearInterval(timerRef.current);
  //           setTimeout(() => {
  //             navigation?.goBack();
  //             navigation?.goBack();
  //           }, 500);
  //         }
  //       })
  //       .catch((e) => {
  //         // ignore because it's normal to fail when invoice is not paid
  //         console.error(e);
  //       });
  //   }, getTimeDurationMs({ seconds: 5 }));

  //   return () => {
  //     if (timerRef.current) {
  //       clearInterval(timerRef.current);
  //     }
  //   };
  // }, [paymentHash, networkId, accountId, intl, navigation]);

  const { copyText } = useClipboard();
  const handleCopyInvoice = useCallback(() => {
    copyText(paymentRequest);
  }, [copyText, paymentRequest]);

  const renderReceiveInvoice = useCallback(() => {
    if (!account || !network || !paymentRequest) return null;
    return (
      <YStack px="$5" justifyContent="center" alignItems="center">
        <Stack
          p="$4"
          alignItems="center"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderRadius="$6"
          overflow="hidden"
          borderCurve="continuous"
        >
          <QRCode
            value={paymentRequest}
            logo={{
              uri: network.logoURI,
            }}
            size={240}
          />
        </Stack>
        <XStack p="$2" alignItems="center" justifyContent="center">
          <SizableText size="$headingLg">Invoice</SizableText>
        </XStack>
        <Stack alignItems="center" px="$5" mb="$2">
          <ConfirmHighlighter
            highlight
            my="$2.5"
            py="$1.5"
            px="$3"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            borderRadius="$3"
            borderCurve="continuous"
          >
            <SizableText
              textAlign="center"
              size="$bodyLg"
              style={{
                wordBreak: 'break-all',
              }}
            >
              {paymentRequest}
            </SizableText>
          </ConfirmHighlighter>
        </Stack>
        <Button icon="Copy1Outline" onPress={handleCopyInvoice}>
          Copy
        </Button>
      </YStack>
    );
  }, [account, handleCopyInvoice, network, paymentRequest]);
  return (
    <Page>
      <Page.Header title="Lightning Invoice" />
      <Page.Body>{renderReceiveInvoice()}</Page.Body>
    </Page>
  );
}
export default ReceiveInvoice;
