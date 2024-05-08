import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SizableText, useForm } from '@onekeyhq/components';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';

import { DAppAccountListStandAloneItem } from '../../../DAppConnection/components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import LNSendPaymentForm from '../../components/LNSendPaymentForm';

import type { ISendPaymentFormValues } from '../../components/LNSendPaymentForm';
import type { RouteProp } from '@react-navigation/core';

function LnurlPayRequestModal() {
  const intl = useIntl();
  const content = useMemo(() => 'Hello World', []);
  const route =
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.LnurlPayRequest>
    >();

  const { accountId, networkId, lnurlDetails } = route.params;
  const origin = new URL(lnurlDetails.url).origin;

  const {
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin });

  const amountMin = Math.floor(Number(lnurlDetails?.minSendable ?? 0) / 1000);
  const amountMax = Math.floor(Number(lnurlDetails?.maxSendable ?? 0) / 1000);
  const useFormReturn = useForm<ISendPaymentFormValues>({
    defaultValues: {
      amount: amountMin > 0 && amountMin === amountMax ? `${amountMin}` : '',
      comment: '',
    },
  });

  const commentAllowedLength = useMemo(() => {
    if (
      lnurlDetails &&
      typeof lnurlDetails.commentAllowed === 'number' &&
      lnurlDetails.commentAllowed > 0
    ) {
      return lnurlDetails.commentAllowed;
    }
    return 0;
  }, [lnurlDetails]);

  const onConfirm = useCallback(
    (close: () => void) => {
      const formValue = useFormReturn.getValues();
      console.log('formValue: ', formValue);
    },
    [useFormReturn],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title={intl.formatMessage({ id: 'title__lnurl_pay' })}
          subtitleShown={false}
          origin={origin}
          urlSecurityInfo={urlSecurityInfo}
        >
          {/* <DAppAccountListStandAloneItem readonly /> */}
          <LNSendPaymentForm
            accountId={accountId}
            networkId={networkId}
            useFormReturn={useFormReturn}
            amount={amountMin === amountMax ? amountMin : undefined}
            amountReadOnly={amountMin === amountMax}
            minimumAmount={amountMin}
            maximumAmount={amountMax}
            commentAllowedLength={commentAllowedLength}
            metadata={lnurlDetails.metadata}
          />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(checked) => {
            setContinueOperate(!!checked);
          }}
          onConfirm={onConfirm}
          // onCancel={() => dappApprove.reject()}
          onCancel={() => {}}
          confirmButtonProps={{
            disabled: !canContinueOperate,
          }}
          showContinueOperateCheckbox={riskLevel !== 'security'}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default LnurlPayRequestModal;
