import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  ConfirmHighlighter,
  Heading,
  Page,
  QRCode,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
      <>
        <Stack
          borderRadius="$3"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          p="$4"
        >
          <QRCode
            value={paymentRequest}
            logo={{
              uri: network.logoURI,
            }}
            logoSize={40}
            size={240}
          />
        </Stack>
        <ConfirmHighlighter
          maxWidth="$96"
          highlight={false}
          mt="$5"
          px="$3"
          borderRadius="$3"
          borderCurve="continuous"
        >
          <SizableText
            numberOfLines={3}
            textAlign="center"
            size="$bodyLg"
            style={{
              wordBreak: 'break-all',
            }}
          >
            {paymentRequest}
          </SizableText>
        </ConfirmHighlighter>
        <Button mt="$5" icon="Copy1Outline" onPress={handleCopyInvoice}>
          {intl.formatMessage({ id: ETranslations.global_copy })}
        </Button>
      </>
    );
  }, [account, handleCopyInvoice, intl, network, paymentRequest]);
  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.lighting_invoice })}
      />
      <Page.Body
        flex={1}
        justifyContent="center"
        alignItems="center"
        px="$5"
        pb="$5"
      >
        {renderReceiveInvoice()}
      </Page.Body>
    </Page>
  );
}
export default ReceiveInvoice;
