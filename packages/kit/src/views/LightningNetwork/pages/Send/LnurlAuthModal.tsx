import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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
  const navigation = useAppNavigation();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.LnurlAuth>>();
  const routeParams = route.params;
  const { isSendFlow } = routeParams;
  const dAppQuery =
    useDappQuery<IModalSendParamList[EModalSendRoutes.LnurlAuth]>();
  const { $sourceInfo } = dAppQuery;
  const { accountId, networkId, lnurlDetails } = isSendFlow
    ? routeParams
    : dAppQuery;

  const origin = useMemo(() => {
    if (lnurlDetails?.url) {
      return new URL(lnurlDetails.url).origin;
    }
    return undefined;
  }, [lnurlDetails?.url]);

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
  } = useRiskDetection({ origin: origin ?? '' });

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
    return {
      allowText: intl.formatMessage({
        id: 'content__allow_dapp_to_login_with_onekey',
      }),
      title: intl.formatMessage({
        id: 'title__lnurl_login',
      }),
      successText: intl.formatMessage({
        id: 'msg__lnurl_login_successful',
      }),
    };
  }, [lnurlDetails?.action, intl]);

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
  }, [lnurlDetails?.action, intl]);

  const onConfirm = useCallback(
    async (close?: () => void) => {
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
            navigation.popStack();
          } else {
            void dappApprove.resolve({
              close,
            });
          }
        }, 300);
      } catch (e) {
        const message = (e as Error)?.message;
        if (!isSendFlow) {
          // show error message for 1.5s
          setTimeout(() => {
            void dappApprove.resolve({
              close,
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
      navigation,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title={textMap?.title ?? ''}
          subtitle={textMap?.allowText ?? ''}
          origin={origin ?? ''}
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
