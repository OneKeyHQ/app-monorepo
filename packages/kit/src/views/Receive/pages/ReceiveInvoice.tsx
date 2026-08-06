import { useCallback, useEffect, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Button,
  Page,
  QRCode,
  SizableText,
  Toast,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalReceiveRoutes,
  IModalReceiveParamList,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../../hooks/useAccountData';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { ReceiveCard, ReceiveCardCell } from '../components/ReceiveCard';
import { ReceiveTestIDs } from '../testIDs';

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
  const navigation = useAppNavigation();

  // polling check for invoice status
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => {
    if (!paymentHash || !networkId || !accountId) return;
    const { serviceLightning } = backgroundApiProxy;
    timerRef.current = setInterval(
      () => {
        serviceLightning
          .fetchSpecialInvoice({
            paymentHash,
            accountId,
            networkId,
          })
          .then((res) => {
            if (res.is_paid) {
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.ln_payment_received_label,
                }),
              });
              clearInterval(timerRef.current);
              setTimeout(() => {
                navigation.popStack();
                navigation.popStack();
              }, 500);
            }
          })
          .catch((e) => {
            // ignore because it's normal to fail when invoice is not paid
            console.error(e);
          });
      },
      timerUtils.getTimeDurationMs({ seconds: 5 }),
    );

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [paymentHash, networkId, accountId, intl, navigation]);

  const { copyText } = useClipboard();
  const handleCopyInvoice = useCallback(() => {
    copyText(paymentRequest);
  }, [copyText, paymentRequest]);

  const renderReceiveInvoice = useCallback(() => {
    if (!account || !network || !paymentRequest) return null;
    return (
      <YStack width="100%" maxWidth={384} alignSelf="center" gap="$5">
        <ReceiveCard>
          <ReceiveCardCell
            testID={ReceiveTestIDs.InvoiceQRCode}
            alignItems="center"
            justifyContent="center"
            py="$8"
            px="$4"
          >
            <QRCode
              value={paymentRequest}
              logo={{
                uri: network.logoURI,
              }}
              logoSize={40}
              size={platformEnv.isNative ? 208 : 176}
            />
          </ReceiveCardCell>
          <ReceiveCardCell px="$4" py="$3">
            <SizableText
              testID={ReceiveTestIDs.InvoiceText}
              numberOfLines={3}
              textAlign="center"
              size="$bodyMd"
              style={{
                wordBreak: 'break-all',
              }}
            >
              {paymentRequest}
            </SizableText>
          </ReceiveCardCell>
        </ReceiveCard>
        <Button
          testID={ReceiveTestIDs.CopyInvoiceButton}
          alignSelf="center"
          icon="Copy3Outline"
          onPress={handleCopyInvoice}
        >
          {intl.formatMessage({ id: ETranslations.global_copy })}
        </Button>
      </YStack>
    );
  }, [account, handleCopyInvoice, intl, network, paymentRequest]);
  return (
    <Page testID={ReceiveTestIDs.ReceiveInvoicePage} scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.lightning_invoice })}
      />
      <Page.Body px="$5" py="$5" $md={{ py: '$0' }}>
        {renderReceiveInvoice()}
      </Page.Body>
    </Page>
  );
}
export default ReceiveInvoice;
