import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Page,
  SegmentControl,
  Toast,
  YStack,
  useClipboard,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignAndVerifyRoutes,
  IModalSignAndVerifyParamList,
} from '@onekeyhq/shared/src/routes/signAndVerify';
import type { ISignAccount } from '@onekeyhq/shared/types/signAndVerify';
import { ESignAndVerifyAction } from '@onekeyhq/shared/types/signAndVerify';

import { SignForm } from '../../components/SignForm';
import { VerifyForm } from '../../components/VerifyForm';

import type { ISignFormData } from '../../components/SignForm';
import type { IVerifyFormData } from '../../components/VerifyForm';
import type { RouteProp } from '@react-navigation/core';

const formatSignedMessage = ({
  message,
  address,
  signature,
  network,
}: {
  message: string;
  address: string;
  signature: string;
  network: string;
}) => `-----BEGIN ${network} SIGNED MESSAGE-----
${message}
-----BEGIN SIGNATURE-----
${address}
${signature}
-----END ${network} SIGNED MESSAGE-----`;

function SignAndVerifyMessage() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalSignAndVerifyParamList,
        EModalSignAndVerifyRoutes.SignAndVerifyMessage
      >
    >();
  const {
    networkId,
    accountId,
    walletId,
    indexedAccountId,
    deriveInfoItems,
    deriveType,
    isOthersWallet,
  } = route.params;

  useEffect(() => {
    console.log('route.params: ', {
      networkId,
      accountId,
      walletId,
      indexedAccountId,
      deriveInfoItems,
      deriveType,
      isOthersWallet,
    });
  }, [
    accountId,
    deriveInfoItems,
    deriveType,
    indexedAccountId,
    isOthersWallet,
    networkId,
    walletId,
  ]);

  const [isSigning, setIsSigning] = useState(false);
  const [action, setAction] = useState(ESignAndVerifyAction.Sign);
  const [currentSignAccount, setCurrentSignAccount] = useState<
    ISignAccount | undefined
  >();
  const [verifyDetectedNetworkId, setVerifyDetectedNetworkId] = useState<
    string | null
  >(null);

  const signedMessageRef = useRef<{
    message: string;
    address: string;
    signature: string;
    network: string;
  } | null>(null);

  const signForm = useForm<ISignFormData>({
    defaultValues: {
      message: '',
      address: '',
      format: '',
      signature: '',
      hexFormat: false,
    },
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });

  const verifyForm = useForm<IVerifyFormData>({
    defaultValues: {
      message: '',
      address: '',
      signature: '',
      hexFormat: false,
      format: '',
    },
    mode: 'onSubmit',
    reValidateMode: 'onBlur',
  });

  const handleSign = useCallback(async () => {
    const isValid = await signForm.trigger();
    if (isValid) {
      console.log('Sign form values:', signForm.getValues());
      console.log('Current sign account:', currentSignAccount);
      const { message, format, hexFormat } = signForm.getValues();

      if (!currentSignAccount) {
        console.error('No sign account selected');
        return;
      }

      try {
        setIsSigning(true);
        signForm.setValue('signature', '');
        const signedMessage =
          await backgroundApiProxy.serviceInternalSignAndVerify.signInternalMessage(
            {
              message,
              isHexString: hexFormat,
              format,
              networkId: currentSignAccount.network.id,
              accountId: currentSignAccount.account.id,
            },
          );
        signedMessageRef.current = {
          message,
          address: currentSignAccount.account.address,
          signature: signedMessage,
          network: currentSignAccount.network.name.toUpperCase(),
        };
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.feedback_sign_success,
          }),
        });
        signForm.setValue('signature', signedMessage);
      } catch (error) {
        console.error('Sign error:', error);
      } finally {
        setIsSigning(false);
      }
    }
  }, [signForm, currentSignAccount, intl]);

  const { copyText } = useClipboard();
  const handleCopySignature = useCallback(() => {
    if (!signedMessageRef.current) {
      return;
    }
    const { message, address, signature, network } = signedMessageRef.current;
    const willCopyText = formatSignedMessage({
      message,
      address,
      signature,
      network,
    });
    copyText(willCopyText);
  }, [copyText]);

  const handleVerify = useCallback(async () => {
    const isValid = await verifyForm.trigger();
    if (isValid) {
      const { message, address, signature, hexFormat, format } =
        verifyForm.getValues();
      if (!verifyDetectedNetworkId) {
        console.error('No network detected for address:', address);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.message_signing_verification_failed,
          }),
        });
        return;
      }

      try {
        setIsSigning(true);
        // Note: Need to implement verifyInternalMessage method in serviceInternalSignAndVerify
        // For now, using a placeholder that always returns false
        const result =
          await backgroundApiProxy.serviceInternalSignAndVerify.verifyMessage({
            networkId: verifyDetectedNetworkId,
            message,
            address,
            signature,
            format,
            hexFormat,
          });

        if (result) {
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.message_signing_verification_success,
            }),
          });
        } else {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.message_signing_verification_failed,
            }),
          });
        }
      } catch (error) {
        console.error('Verify error:', error);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.message_signing_verification_failed,
          }),
        });
      } finally {
        setIsSigning(false);
      }
    }
  }, [intl, verifyDetectedNetworkId, verifyForm]);

  const renderContent = useCallback(() => {
    if (action === ESignAndVerifyAction.Sign) {
      return (
        <SignForm
          key="sign-form"
          form={signForm}
          networkId={networkId}
          accountId={accountId}
          indexedAccountId={indexedAccountId}
          isOthersWallet={isOthersWallet}
          onCurrentSignAccountChange={setCurrentSignAccount}
          onCopySignature={handleCopySignature}
        />
      );
    }
    return (
      <VerifyForm
        key="verify-form"
        form={verifyForm}
        onNetworkDetected={setVerifyDetectedNetworkId}
      />
    );
  }, [
    action,
    signForm,
    verifyForm,
    networkId,
    accountId,
    indexedAccountId,
    isOthersWallet,
    handleCopySignature,
  ]);

  return (
    <Page scrollEnabled onClose={() => {}} safeAreaEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.message_signing_main_title,
        })}
      />
      <Page.Body>
        <YStack p="$5" pt="$2" gap="$5">
          <SegmentControl
            value={action}
            fullWidth
            onChange={(v) => {
              const newAction = v as ESignAndVerifyAction;
              setAction(newAction);

              // Reset form states when switching tabs
              if (newAction === ESignAndVerifyAction.Sign) {
                signForm.reset({
                  message: '',
                  address: '',
                  format: '',
                  signature: '',
                  hexFormat: false,
                });
                setCurrentSignAccount(undefined);
                signedMessageRef.current = null;
              } else {
                verifyForm.reset({
                  message: '',
                  address: '',
                  signature: '',
                  hexFormat: false,
                  format: '',
                });
                setVerifyDetectedNetworkId(null);
              }
            }}
            options={[
              {
                label: intl.formatMessage({
                  id: ETranslations.message_signing_sign_action,
                }),
                value: ESignAndVerifyAction.Sign,
              },
              {
                label: intl.formatMessage({
                  id: ETranslations.message_signing_verify_action,
                }),
                value: ESignAndVerifyAction.Verify,
              },
            ]}
          />
          {renderContent()}
        </YStack>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id:
            action === ESignAndVerifyAction.Sign
              ? ETranslations.global_sign
              : ETranslations.message_signing_verify_action,
        })}
        confirmButtonProps={{
          loading: isSigning,
        }}
        onConfirm={
          action === ESignAndVerifyAction.Sign ? handleSign : handleVerify
        }
      />
    </Page>
  );
}

export default SignAndVerifyMessage;
