import { memo, useCallback, useMemo, useState } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import { Checkbox, Page, Toast } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  validateSignMessageData,
  validateTypedSignMessageDataV1,
  validateTypedSignMessageDataV3V4,
} from '@onekeyhq/shared/src/utils/messageUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import type { ISignatureConfirmDisplay } from '@onekeyhq/shared/types/signatureConfirm';

type IProps = {
  accountId: string;
  networkId: string;
  unsignedMessage: IUnsignedMessage;
  messageDisplay: ISignatureConfirmDisplay | undefined;
  continueOperate: boolean;
  setContinueOperate: React.Dispatch<React.SetStateAction<boolean>>;
  showContinueOperate?: boolean;
  urlSecurityInfo?: IHostSecurity;
};

function MessageConfirmActions(props: IProps) {
  const {
    accountId,
    networkId,
    unsignedMessage,
    messageDisplay,
    continueOperate: continueOperateLocal,
    setContinueOperate: setContinueOperateLocal,
    showContinueOperate: showContinueOperateLocal,
    urlSecurityInfo,
  } = props;

  const intl = useIntl();
  const { $sourceInfo, walletInternalSign } = useDappQuery<{
    walletInternalSign?: boolean;
  }>();
  const { network } = useAccountData({
    networkId,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [continueOperate, setContinueOperate] = useState(false);

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const handleSignMessage = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      setIsLoading(true);

      try {
        if (
          unsignedMessage.type === EMessageTypesEth.ETH_SIGN ||
          unsignedMessage.type === EMessageTypesEth.PERSONAL_SIGN
        ) {
          validateSignMessageData(unsignedMessage, network?.impl);
        }
        if (unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V1) {
          validateTypedSignMessageDataV1(unsignedMessage, network?.impl);
        }
        if (
          unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
          unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4
        ) {
          validateTypedSignMessageDataV3V4(
            unsignedMessage,
            networkUtils.getNetworkChainId({ networkId }),
            network?.impl,
          );
        }
      } catch (e: any) {
        setIsLoading(false);
        dappApprove?.reject({ error: e });
        close?.();
        return;
      }

      try {
        const result = await backgroundApiProxy.serviceSend.signMessage({
          unsignedMessage,
          networkId,
          accountId,
        });
        void dappApprove.resolve({
          result,
        });
        try {
          await backgroundApiProxy.serviceSignature.addItemFromSignMessage({
            networkId,
            accountId,
            message: unsignedMessage.message,
            sourceInfo: $sourceInfo,
          });
        } catch {
          // noop
        }
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.feedback_sign_success,
          }),
        });
        close?.({ flag: EDAppModalPageStatus.Confirmed });
      } finally {
        setIsLoading(false);
      }
    },
    [
      unsignedMessage,
      network?.impl,
      networkId,
      dappApprove,
      accountId,
      intl,
      $sourceInfo,
    ],
  );

  const showTakeRiskAlert = useMemo(() => {
    if (walletInternalSign) {
      return false;
    }

    if (urlSecurityInfo?.level === EHostSecurityLevel.Security) {
      return false;
    }

    if (!isEmpty(messageDisplay?.alerts)) {
      return true;
    }

    if (showContinueOperateLocal) {
      return true;
    }

    return false;
  }, [
    messageDisplay?.alerts,
    showContinueOperateLocal,
    urlSecurityInfo?.level,
    walletInternalSign,
  ]);

  return (
    <Page.Footer disableKeyboardAnimation>
      <Page.FooterActions
        onConfirmText={intl.formatMessage({
          id: ETranslations.dapp_connect_confirm,
        })}
        onConfirm={(params) => handleSignMessage(params)}
        onCancel={() => dappApprove.reject()}
        confirmButtonProps={{
          loading: isLoading,
          disabled:
            showTakeRiskAlert && (!continueOperate || !continueOperateLocal),
          variant: showTakeRiskAlert ? 'destructive' : 'primary',
        }}
      >
        {showTakeRiskAlert ? (
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.dapp_connect_proceed_at_my_own_risk,
            })}
            value={continueOperate}
            onChange={(checked) => {
              setContinueOperate(!!checked);
              setContinueOperateLocal(!!checked);
            }}
          />
        ) : null}
      </Page.FooterActions>
    </Page.Footer>
  );
}

export default memo(MessageConfirmActions);
