import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  Form,
  Input,
  Radio,
  Select,
  SizableText,
  Skeleton,
  Switch,
  TextAreaInput,
  XStack,
} from '@onekeyhq/components';
import type { ISelectSection, UseFormReturn } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISignAccount } from '@onekeyhq/shared/types/signAndVerify';

type ISignFormData = {
  message: string;
  address: string;
  format: string;
  signature: string;
  hexFormat: boolean;
};

interface ISignFormProps {
  form: UseFormReturn<ISignFormData>;
  networkId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  isOthersWallet: boolean | undefined;
  onCurrentSignAccountChange: (account: ISignAccount | undefined) => void;
  onCopySignature: () => void;
}

export const SignForm = ({
  form,
  networkId,
  accountId,
  indexedAccountId,
  isOthersWallet,
  onCurrentSignAccountChange,
  onCopySignature,
}: ISignFormProps) => {
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

    const network = await backgroundApiProxy.serviceNetwork.getNetwork({
      networkId,
    });
    if (
      networkId === getNetworkIdsMap().eth ||
      network.impl === IMPL_EVM ||
      networkId === getNetworkIdsMap().sol
    ) {
      const defaultAccount = signAccountsRef.current.find(
        (i) => i.network.id === networkId || i.network.impl === network.impl,
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
    const isHwAccount = accountUtils.isHwAccount({
      accountId: currentSignAccount?.account.id ?? '',
    });
    if (!networkUtils.isBTCNetwork(currentSignAccount?.network.id)) {
      return [];
    }
    if (currentSignAccount?.deriveType === 'BIP86') {
      return [
        { label: 'Electrum', value: 'electrum', disabled: true },
        { label: 'BIP137', value: 'bip137', disabled: true },
        { label: 'BIP322', value: 'bip322', disabled: false },
      ];
    }

    if (currentSignAccount?.deriveType === 'BIP84') {
      return [
        { label: 'Electrum', value: 'electrum', disabled: false },
        { label: 'BIP137', value: 'bip137', disabled: false },
        { label: 'BIP322', value: 'bip322', disabled: isHwAccount },
      ];
    }

    return [
      { label: 'Electrum', value: 'electrum', disabled: false },
      { label: 'BIP137', value: 'bip137', disabled: false },
      { label: 'BIP322', value: 'bip322', disabled: true },
    ];
  }, [
    currentSignAccount?.network.id,
    currentSignAccount?.deriveType,
    currentSignAccount?.account.id,
  ]);

  const networkAvatarContent = useMemo(
    () => (
      <XStack alignItems="center" px="$1" mr="$-3">
        {currentSignAccount?.network.id ? (
          <NetworkAvatar networkId={currentSignAccount.network.id} size="$6" />
        ) : (
          <Skeleton w="$6" h="$6" borderRadius="$full" />
        )}
      </XStack>
    ),
    [currentSignAccount?.network.id],
  );

  const selectTriggerInputProps = useMemo(
    () => ({
      leftAddOnProps: {
        size: 'large' as const,
        renderContent: networkAvatarContent,
      },
    }),
    [networkAvatarContent],
  );

  const currentFormat = form.watch('format');
  const currentMessage = form.watch('message');
  const currentSignature = form.watch('signature');
  const accountKey = `${currentSignAccount?.network.id ?? ''}-${
    currentSignAccount?.deriveType ?? ''
  }`;
  const messageAccountKey = `${currentMessage ?? ''}-${selectedAddress ?? ''}`;
  const previousAccountKey = usePrevious(accountKey);
  const previousMessageAccountKey = usePrevious(messageAccountKey);

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

  useEffect(() => {
    // Clear signature when message or account changes
    if (
      previousMessageAccountKey !== undefined &&
      previousMessageAccountKey !== messageAccountKey
    ) {
      form.setValue('signature', '');
    }
  }, [form, messageAccountKey, previousMessageAccountKey]);

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
          defaultTriggerInputProps={selectTriggerInputProps}
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
            currentSignature
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

export type { ISignFormData };
