import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import DappOpenModalPage from '@onekeyhq/kit/src/views/DAppConnection/pages/DappOpenModalPage';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

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
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: origin ?? '' });

  const { result: textMap } = usePromiseResult(async () => {
    if (lnurlDetails.action === 'reigster') {
      return {
        allowText: intl.formatMessage(
          {
            id: ETranslations.dapp_connect_allow_to_access_your_chain_register,
          },
          {
            chain: 'Lightning Network',
          },
        ),
        title: intl.formatMessage({
          id: ETranslations.dapp_connect_lnurl_register_request,
        }),
        successText: intl.formatMessage({
          id: ETranslations.dapp_connect_registration_successful,
        }),
      };
    }
    if (lnurlDetails.action === 'link') {
      return {
        allowText: intl.formatMessage(
          {
            id: ETranslations.dapp_connect_allow_to_access_your_chain_link,
          },
          {
            chain: 'Lightning Network',
          },
        ),
        title: intl.formatMessage({
          id: ETranslations.dapp_connect_lnurl_connect_request,
        }),
        successText: intl.formatMessage({
          id: ETranslations.dapp_connect_link_successful,
        }),
      };
    }
    if (lnurlDetails.action === 'auth') {
      return {
        allowText: intl.formatMessage(
          {
            id: ETranslations.dapp_connect_allow_to_access_your_chain_auth,
          },
          {
            chain: 'Lightning Network',
          },
        ),
        title: intl.formatMessage({
          id: ETranslations.dapp_connect_lnurl_approve_request,
        }),
        successText: intl.formatMessage({
          id: ETranslations.dapp_connect_authorization_successful,
        }),
      };
    }
    return {
      allowText: intl.formatMessage(
        {
          id: ETranslations.dapp_connect_allow_to_access_your_chain_login,
        },
        {
          chain: 'Lightning Network',
        },
      ),
      title: intl.formatMessage({
        id: ETranslations.dapp_connect_lnurl_login_request,
      }),
      successText: intl.formatMessage({
        id: ETranslations.dapp_connect_login_successful,
      }),
    };
  }, [lnurlDetails?.action, intl]);

  const renderRequestPermissions = useCallback(() => {
    let permissions = [
      intl.formatMessage({
        id: ETranslations.dapp_connect_request_for_lnurl_linking_key,
      }),
    ];
    if (lnurlDetails.action === 'auth') {
      permissions = [
        intl.formatMessage({
          id: ETranslations.dapp_connect_watch_your_account_balance_and_activity,
        }),
        intl.formatMessage({
          id: ETranslations.dapp_connect_request_for_lnurl_linking_key,
        }),
        intl.formatMessage({
          id: ETranslations.dapp_connect_request_invoices_and_lightning_information,
        }),
      ];
    }
    return <DAppRequestedPermissionContent requestPermissions={permissions} />;
  }, [lnurlDetails?.action, intl]);

  const onConfirm = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
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
              close: () => {
                close?.({ flag: EDAppModalPageStatus.Confirmed });
              },
            });
          }
        }, 300);
      } catch (e) {
        const message = (e as Error)?.message;
        if (!isSendFlow) {
          // show error message for 1.5s
          setTimeout(() => {
            void dappApprove.resolve({
              close: () => {
                close?.({ flag: EDAppModalPageStatus.Confirmed });
              },
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
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
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
              disabled: !continueOperate,
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default LnurlAuthModal;
