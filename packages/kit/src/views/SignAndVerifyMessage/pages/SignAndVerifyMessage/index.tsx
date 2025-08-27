import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Divider,
  Form,
  Input,
  Page,
  Radio,
  SegmentControl,
  Select,
  SizableText,
  Switch,
  TextAreaInput,
  Toast,
  XStack,
  YStack,
  useClipboard,
  useForm,
} from '@onekeyhq/components';
import type { ISelectSection, UseFormReturn } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignAndVerifyRoutes,
  IModalSignAndVerifyParamList,
} from '@onekeyhq/shared/src/routes/signAndVerify';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISignAccount } from '@onekeyhq/shared/types/signAndVerify';
import { ESignAndVerifyAction } from '@onekeyhq/shared/types/signAndVerify';

import type { RouteProp } from '@react-navigation/core';

type ISignFormData = {
  message: string;
  address: string;
  format: string;
  signature: string;
  hexFormat: boolean;
};

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

const SignForm = ({
  form,
  networkId,
  accountId,
  indexedAccountId,
  isOthersWallet,
  onCurrentSignAccountChange,
  onCopySignature,
}: {
  form: UseFormReturn<ISignFormData>;
  networkId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  isOthersWallet: boolean | undefined;
  onCurrentSignAccountChange: (account: ISignAccount | undefined) => void;
  onCopySignature: () => void;
}) => {
  const intl = useIntl();
  const signAccountsRef = useRef<ISignAccount[]>([]);

  const selectedAddress = form.watch('address');
  const currentSignAccount = useMemo(() => {
    if (!selectedAddress) {
      return undefined;
    }
    return signAccountsRef.current.find(
      (account) => account.account.address === selectedAddress,
    );
  }, [selectedAddress]);

  useEffect(() => {
    onCurrentSignAccountChange?.(currentSignAccount);
  }, [currentSignAccount, onCurrentSignAccountChange]);

  const setDefaultAccount = useCallback(async () => {
    if (selectedAddress) {
      return;
    }

    if (
      !Array.isArray(signAccountsRef.current) ||
      !signAccountsRef.current.length
    ) {
      return;
    }

    if (
      networkId === getNetworkIdsMap().eth ||
      networkId === getNetworkIdsMap().sol
    ) {
      const defaultAccount = signAccountsRef.current.find(
        (i) => i.network.id === networkId,
      );
      if (defaultAccount) {
        form.setValue('address', defaultAccount.account.address);
        return;
      }
    }
    if (networkId === getNetworkIdsMap().btc) {
      const globalDeriveType =
        await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId,
        });
      const btcAccounts = signAccountsRef.current.filter(
        (i) => i.network.id === getNetworkIdsMap().btc,
      );
      if (btcAccounts.length > 0) {
        const defaultAccount =
          btcAccounts.find((i) => i.deriveType === globalDeriveType) ||
          btcAccounts[0];
        if (defaultAccount) {
          form.setValue('address', defaultAccount.account.address);
          return;
        }
      }
    }
    form.setValue('address', signAccountsRef.current[0].account.address);
  }, [form, networkId, selectedAddress, signAccountsRef]);

  // const currentSignAccount = useState<ISignAccount | undefined>(undefined);
  const { result: selectOptions } = usePromiseResult<ISelectSection[]>(
    async () => {
      const signAccounts =
        await backgroundApiProxy.serviceInternalSignAndVerify.getSignAccounts({
          networkId,
          accountId,
          indexedAccountId,
          isOthersWallet,
        });
      signAccountsRef.current = signAccounts;
      const result: ISelectSection[] = [];
      const ethereumAccount = signAccounts.find(
        (account) => account.network.id === getNetworkIdsMap().eth,
      );
      if (ethereumAccount) {
        result.push({
          title: ethereumAccount.network.name,
          data: [
            {
              label: accountUtils.shortenAddress({
                address: ethereumAccount.account.address,
              }),
              value: ethereumAccount.account.address,
            },
          ],
        });
      }

      const solanaAccount = signAccounts.find(
        (account) => account.network.id === getNetworkIdsMap().sol,
      );
      if (solanaAccount) {
        result.push({
          title: solanaAccount.network.name,
          data: [
            {
              label: accountUtils.shortenAddress({
                address: solanaAccount.account.address,
              }),
              value: solanaAccount.account.address,
            },
          ],
        });
      }

      const btcAccounts = signAccounts.filter(
        (account) => account.network.id === getNetworkIdsMap().btc,
      );
      if (btcAccounts.length > 0) {
        result.push({
          title: 'BTC',
          data: btcAccounts.map((account) => ({
            label: accountUtils.shortenAddress({
              address: account.account.address,
            }),
            value: account.account.address,
            description: account.deriveLabel,
          })),
        });
      }
      void setDefaultAccount();
      return result;
    },
    [accountId, indexedAccountId, isOthersWallet, networkId, setDefaultAccount],
    {
      initResult: [],
    },
  );

  const displayFormatForm = useMemo(() => {
    return networkUtils.isBTCNetwork(currentSignAccount?.network.id);
  }, [currentSignAccount?.network.id]);

  const formatRadioOptions = useMemo(() => {
    if (networkUtils.isBTCNetwork(currentSignAccount?.network.id)) {
      if (currentSignAccount?.deriveType === 'BIP86') {
        return [
          { label: 'Electrum', value: 'electrum', disabled: true },
          { label: 'BIP137', value: 'bip137', disabled: true },
          { label: 'BIP322', value: 'bip322', disabled: false },
        ];
      }

      return [
        { label: 'Electrum', value: 'electrum' },
        { label: 'BIP137', value: 'bip137' },
        { label: 'BIP322', value: 'bip322' },
      ];
    }
    return [];
  }, [currentSignAccount?.network.id, currentSignAccount?.deriveType]);

  const currentFormat = form.watch('format');
  const accountKey = `${currentSignAccount?.network.id ?? ''}-${
    currentSignAccount?.deriveType ?? ''
  }`;
  const previousAccountKey = usePrevious(accountKey);

  useEffect(() => {
    // only update default value when account info changed
    if (previousAccountKey !== undefined && previousAccountKey === accountKey) {
      return;
    }

    if (networkUtils.isBTCNetwork(currentSignAccount?.network.id)) {
      if (currentSignAccount?.deriveType === 'BIP86') {
        form.setValue('format', 'bip322');
      } else {
        form.setValue('format', 'electrum');
      }
    } else {
      form.setValue('format', '');
    }
  }, [
    form,
    currentSignAccount?.network.id,
    currentSignAccount?.deriveType,
    currentFormat,
    accountKey,
    previousAccountKey,
  ]);

  const signature = form.watch('signature');

  return (
    <Form form={form}>
      <Form.Field
        name="message"
        label={intl.formatMessage({
          id: ETranslations.global_hex_data,
        })}
        rules={{
          required: intl.formatMessage({
            id: ETranslations.address_book_add_address_name_required,
          }),
          maxLength: {
            value: 1024,
            message: `Maximum length is 1024 characters`,
          },
          validate: (value: string) => {
            const hexFormat = form.getValues('hexFormat');
            if (hexFormat && value) {
              if (!hexUtils.isHexString(value)) {
                return 'Not a valid hex';
              }
            }
            return true;
          },
        }}
        labelAddon={
          <XStack alignItems="center" gap="$2">
            <SizableText color="$text" size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.message_signing_address_hex_format,
              })}
            </SizableText>
            <Form.Field name="hexFormat">
              <Switch size="small" />
            </Form.Field>
          </XStack>
        }
      >
        <TextAreaInput
          size="large"
          placeholder={intl.formatMessage({
            id: ETranslations.message_signing_address_placeholder,
          })}
        />
      </Form.Field>

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.global_address,
        })}
        name="address"
        description={intl.formatMessage({
          id: ETranslations.message_signing_address_desc,
        })}
        rules={{
          required: intl.formatMessage({
            id: ETranslations.address_book_add_address_name_required,
          }),
        }}
      >
        <Select
          title={intl.formatMessage({
            id: ETranslations.global_address,
          })}
          placeholder={intl.formatMessage({
            id: ETranslations.global_address,
          })}
          sections={selectOptions}
          defaultTriggerInputProps={{
            leftAddOnProps: {
              size: 'large',
              renderContent: (
                <XStack alignItems="center" px="$1" mr="$-3">
                  <NetworkAvatar
                    networkId={currentSignAccount?.network.id}
                    size="$6"
                  />
                </XStack>
              ),
            },
          }}
        />
      </Form.Field>

      <Divider />

      {displayFormatForm ? (
        <Form.Field label="Format" name="format">
          <Radio
            orientation="horizontal"
            gap="$5"
            options={formatRadioOptions}
          />
        </Form.Field>
      ) : null}

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.message_signing_signature_label,
        })}
        name="signature"
      >
        <Input
          placeholder={intl.formatMessage({
            id: ETranslations.message_signing_signature_desc,
          })}
          editable={false}
          addOns={
            signature
              ? [
                  {
                    iconName: 'Copy3Outline',
                    onPress: onCopySignature,
                  },
                ]
              : []
          }
        />
      </Form.Field>
    </Form>
  );
};

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
          network: currentSignAccount.network.name,
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

  const renderContent = useCallback(() => {
    if (action === ESignAndVerifyAction.Sign) {
      return (
        <SignForm
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
    return <SizableText>Verify message</SizableText>;
  }, [
    action,
    signForm,
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
        <YStack p="$5" gap="$5">
          <SegmentControl
            value={action}
            fullWidth
            onChange={(v) => {
              setAction(v as ESignAndVerifyAction);
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
          id: ETranslations.global_sign,
        })}
        confirmButtonProps={{
          disabled: action !== ESignAndVerifyAction.Sign,
          loading: isSigning,
        }}
        onConfirm={
          action === ESignAndVerifyAction.Sign ? handleSign : undefined
        }
      />
    </Page>
  );
}

export default SignAndVerifyMessage;
