import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';

import {
  DAppAccountListStandAloneItem,
  DAppAccountListStandAloneItemForHomeScene,
} from '../../../DAppConnection/components/DAppAccountList';
import { DAppRequestedPermissionContent } from '../../../DAppConnection/components/DAppRequestContent';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';

import type { RouteProp } from '@react-navigation/core';

function LnurlAuthModal() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.LnurlAuth>>();

  const { accountId, networkId, lnurlDetails, isSendFlow } = route.params;
  const origin = new URL(lnurlDetails.url).origin;

  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [isLoading, setIsLoading] = useState(false);

  const {
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin });

  const { result: textMap } = usePromiseResult(async () => {
    if (lnurlDetails.action === 'reigster') {
      return {
        allowText: intl.formatMessage({
          id: 'content__allow_dapp_to_register_with_onekey',
        }),
        title: intl.formatMessage({
          id: 'title__lnurl_register',
        }),
        successText: intl.formatMessage({
          id: 'msg__lnurl_register_successful',
        }),
      };
    }
    if (lnurlDetails.action === 'link') {
      return {
        allowText: intl.formatMessage({
          id: 'content__allow_dapp_to_link_with_onekey',
        }),
        title: intl.formatMessage({
          id: 'title__lnurl_link',
        }),
        successText: intl.formatMessage({
          id: 'msg__lnurl_link_successful',
        }),
      };
    }
    if (lnurlDetails.action === 'auth') {
      return {
        allowText: intl.formatMessage({
          id: 'content__allow_dapp_to_connect_with_onekey',
        }),
        title: intl.formatMessage({
          id: 'title__lnurl_authentication',
        }),
        successText: intl.formatMessage({
          id: 'msg__lnurl_authorization_successful',
        }),
      };
    }
  }, [lnurlDetails, intl]);

  const renderRequestPermissions = useCallback(() => {
    let permissions = [
      intl.formatMessage({
        id: 'content__request_lnurl_linkingkey',
      }),
    ];
    if (lnurlDetails.action === 'auth') {
      permissions = [
        intl.formatMessage({
          id: 'content__watch_your_account_balance_and_activity',
        }),
        intl.formatMessage({
          id: 'content__allow_dapp_to_register_with_onekey',
        }),
        intl.formatMessage({
          id: 'content__request_invoices_and_send_transaction',
        }),
      ];
    }
    return <DAppRequestedPermissionContent requestPermissions={permissions} />;
  }, [lnurlDetails, intl]);

  const onConfirm = useCallback(
    async (close: () => void) => {
      if (!lnurlDetails) return;
      if (isLoading) return;
      setIsLoading(true);

      const { serviceLightning } = backgroundApiProxy;
      try {
        await serviceLightning.lnurlAuth({
          accountId,
          networkId,
          lnurlDetail: lnurlDetails,
        });
        Toast.success({
          title: textMap?.successText ?? '',
        });
        setTimeout(() => {
          if (isSendFlow) {
            close?.();
          } else {
            void dappApprove.resolve();
          }
        }, 300);
      } catch (e) {
        const message = (e as Error)?.message;
        if (!isSendFlow) {
          // show error message for 1.5s
          setTimeout(() => {
            void dappApprove.resolve({
              result: {
                status: 'ERROR',
                reason: message,
              },
            });
          }, 1500);
        }
        throw new OneKeyError({
          info: message,
          autoToast: true,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      lnurlDetails,
      isLoading,
      accountId,
      networkId,
      textMap,
      isSendFlow,
      dappApprove,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title={intl.formatMessage({ id: 'title__lnurl_withdraw' })}
          subtitleShown={false}
          origin={origin}
          urlSecurityInfo={urlSecurityInfo}
        >
          {isSendFlow ? (
            <DAppAccountListStandAloneItemForHomeScene />
          ) : (
            <DAppAccountListStandAloneItem readonly />
          )}
          {renderRequestPermissions()}
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(checked) => {
            setContinueOperate(!!checked);
          }}
          onConfirm={onConfirm}
          onCancel={() => {
            if (!isSendFlow) {
              dappApprove.reject();
            }
          }}
          confirmButtonProps={{
            loading: isLoading,
            disabled: !canContinueOperate,
          }}
          showContinueOperateCheckbox={riskLevel !== 'security'}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default LnurlAuthModal;
