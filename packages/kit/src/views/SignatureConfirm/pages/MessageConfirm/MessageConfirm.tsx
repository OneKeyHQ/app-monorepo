import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { promiseAllSettledEnhanced } from '@onekeyhq/shared/src/utils/promiseUtils';
import {
  convertAddressToSignatureConfirmAddress,
  convertNetworkToSignatureConfirmNetwork,
} from '@onekeyhq/shared/src/utils/txActionUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EParseTxComponentType,
  type IParseMessageResp,
  type ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';

import { MessageConfirmAlert } from '../../components/SignatureConfirmAlert';
import { MessageDataViewer } from '../../components/SignatureConfirmDataViewer';
import { MessageConfirmDetails } from '../../components/SignatureConfirmDetails';
import { SignatureConfirmItem } from '../../components/SignatureConfirmItem';
import { SignatureConfirmLoading } from '../../components/SignatureConfirmLoading';
import SourceInfo from '../../components/SourceInfo/SourceInfo';

export function useDappCloseHandler(
  dappApprove: ReturnType<typeof useDappApproveAction>,
  onClose?: (extra?: { flag?: string }) => void,
) {
  const handleOnClose = (extra?: { flag?: string }) => {
    if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
      dappApprove.reject();
    }
    if (typeof onClose === 'function') {
      onClose(extra);
    }
  };

  return handleOnClose;
}

function MessageConfirm() {
  const { $sourceInfo, unsignedMessage, accountId, networkId } = useDappQuery<{
    unsignedMessage: IUnsignedMessage;
    accountId: string;
    networkId: string;
    indexedAccountId: string;
  }>();

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const isSignTypedDataV3orV4Method =
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
    unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;

  const { result: parsedMessage, isLoading } = usePromiseResult(
    async () => {
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          networkId,
          accountId,
        });

      const requests:
        | [Promise<IParseMessageResp>, Promise<void>]
        | [Promise<IParseMessageResp>] = isSignTypedDataV3orV4Method
        ? [
            backgroundApiProxy.serviceSignatureConfirm.parseMessage({
              networkId,
              accountId,
              accountAddress,
              unsignedMessage,
            }),
            backgroundApiProxy.serviceDiscovery.postSignTypedDataMessage({
              networkId,
              accountId,
              origin: $sourceInfo?.origin ?? '',
              typedData: JSON.stringify(unsignedMessage),
            }),
          ]
        : [
            backgroundApiProxy.serviceSignatureConfirm.parseMessage({
              networkId,
              accountId,
              accountAddress,
              unsignedMessage,
            }),
          ];

      // @ts-expect-error
      const [m] = await promiseAllSettledEnhanced(requests, {
        continueOnError: true,
      });

      let p: ISignatureConfirmDisplay;

      if (m && m.display) {
        p = m.display;
      } else {
        p = {
          title: '',
          components: [
            convertNetworkToSignatureConfirmNetwork({
              networkId,
            }),
            convertAddressToSignatureConfirmAddress({
              address: accountAddress,
            }),
            {
              type: EParseTxComponentType.Divider,
            },
          ],
          alerts: [],
        };
      }

      if (
        p.components[p.components.length - 1].type !==
        EParseTxComponentType.Divider
      ) {
        p.components.push({
          type: EParseTxComponentType.Divider,
        });
      }

      return p;
    },
    [
      networkId,
      accountId,
      unsignedMessage,
      $sourceInfo?.origin,
      isSignTypedDataV3orV4Method,
    ],
    {
      watchLoading: true,
    },
  );

  const renderMessageConfirmContent = useCallback(() => {
    if (isLoading) {
      return <SignatureConfirmLoading />;
    }

    if (!parsedMessage) {
      return null;
    }

    return (
      <SignatureConfirmItem gap="$5">
        <MessageConfirmAlert />
        <SourceInfo sourceInfo={$sourceInfo} />
        <MessageConfirmDetails
          accountId={accountId}
          networkId={networkId}
          displayComponents={parsedMessage.components}
        />
        <MessageDataViewer unsignedMessage={unsignedMessage} />
      </SignatureConfirmItem>
    );
  }, [
    isLoading,
    parsedMessage,
    $sourceInfo,
    accountId,
    networkId,
    unsignedMessage,
  ]);

  const handleOnClose = useCallback(
    (extra?: { flag?: string }) => {
      if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
        dappApprove.reject();
      }
    },
    [dappApprove],
  );

  return (
    <Page scrollEnabled onClose={handleOnClose} safeAreaEnabled>
      <Page.Header title={parsedMessage?.title} />
      <Page.Body>{renderMessageConfirmContent()}</Page.Body>
    </Page>
  );
}

export default MessageConfirm;
