import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { VerifyMessageArgs } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/webln';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { LNModalDescription } from '../components/LNModalDescription';
import LNSignMessageForm from '../components/LNSignMessageForm';

import type { ISignMessageFormValues } from '../components/LNSignMessageForm';

const WeblnSignMessage = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const { sourceInfo, networkId, accountId } = useDappParams();
  const { message, signature } = sourceInfo?.data.params as VerifyMessageArgs;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const useFormReturn = useForm<ISignMessageFormValues>();

  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = useCallback(
    async ({ close }) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const result =
          await backgroundApiProxy.serviceLightningNetwork.weblnVerifyMessage({
            accountId: accountId ?? '',
            networkId: networkId ?? '',
            message,
            signature,
          });

        ToastManager.show({
          title: intl.formatMessage({
            id: !result
              ? 'msg__verification_error_invalid_signature'
              : 'msg__message_verification_successful',
          }),
        });
        setTimeout(() => {
          if (!result) {
            dappApprove.reject();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            close?.();
            return;
          }
          dappApprove.resolve({
            close,
            result,
          });
        }, 300);
      } catch (e: any) {
        const { key, info } = e;
        if (key && key !== 'onekey_error') {
          ToastManager.show(
            {
              title: intl.formatMessage(
                {
                  id: key,
                },
                info ?? {},
              ),
            },
            { type: 'error' },
          );
          dappApprove.reject();
          return false;
        }
        ToastManager.show(
          { title: (e as Error)?.message || e },
          { type: 'error' },
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [intl, isLoading, accountId, networkId, dappApprove, message, signature],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__verify_message' })}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__verify__webln"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={({ close }) => {
        onSubmit({ close });
      }}
      secondaryActionTranslationId="action__cancel"
      onModalClose={dappApprove.reject}
      onSecondaryActionPress={({ close }) => {
        dappApprove.reject();
        close();
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <LNSignMessageForm
            accountId={accountId ?? ''}
            networkId={networkId ?? ''}
            useFormReturn={useFormReturn}
            origin={sourceInfo?.origin ?? ''}
            message={message}
            signature={signature}
          />
        ),
      }}
    />
  );
};

export default WeblnSignMessage;
