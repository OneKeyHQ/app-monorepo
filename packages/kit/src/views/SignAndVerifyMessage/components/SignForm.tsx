import { useCallback, useEffect, useMemo, useRef } from 'react';

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Divider,
  Form,
  Icon,
  Popover,
  Radio,
  Select,
  SizableText,
  Skeleton,
  Switch,
  TextAreaInput,
  XStack,
  YStack,
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
  walletId: string;
  networkId: string;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  isOthersWallet: boolean | undefined;
  onCurrentSignAccountChange: (account: ISignAccount | undefined) => void;
  onCopySignature: () => void;
  onDisabledChange: (disabled: boolean) => void;
}

export const SignForm = ({
  form,
  walletId,
  networkId,
  accountId,
  indexedAccountId,
  isOthersWallet,
  onCurrentSignAccountChange,
  onCopySignature,
  onDisabledChange,
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
        {
          label: intl.formatMessage({ id: ETranslations.global_standard }),
          value: 'electrum',
          disabled: true,
        },
        { label: 'BIP137', value: 'bip137', disabled: true },
        { label: 'BIP322', value: 'bip322', disabled: false },
      ];
    }

    if (currentSignAccount?.deriveType === 'BIP84') {
      return [
        {
          label: intl.formatMessage({ id: ETranslations.global_standard }),
          value: 'electrum',
          disabled: false,
        },
        { label: 'BIP137', value: 'bip137', disabled: false },
        { label: 'BIP322', value: 'bip322', disabled: isHwAccount },
      ];
    }

    return [
      {
        label: intl.formatMessage({ id: ETranslations.global_standard }),
        value: 'electrum',
        disabled: false,
      },
      { label: 'BIP137', value: 'bip137', disabled: false },
      { label: 'BIP322', value: 'bip322', disabled: true },
    ];
  }, [
    currentSignAccount?.account.id,
    currentSignAccount?.network.id,
    currentSignAccount?.deriveType,
    intl,
  ]);

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

  const getAddressDescription = useCallback(() => {
    if (currentSignAccount?.network.id === getNetworkIdsMap().eth) {
      return intl.formatMessage({
        id: ETranslations.message_signing_address_desc,
      });
    }
  }, [currentSignAccount?.network.id, intl]);

  const { result: isClassicOrMiniDevice } = usePromiseResult(
    async () => {
      if (!accountUtils.isHwWallet({ walletId })) {
        return false;
      }
      const wallet = await backgroundApiProxy.serviceAccount.getWalletSafe({
        walletId: walletId ?? '',
      });
      const deviceType = wallet?.associatedDeviceInfo?.deviceType;
      console.log('wallet?.associatedDevice: ', wallet?.associatedDevice);
      if (
        deviceType &&
        (deviceType === EDeviceType.Classic || deviceType === EDeviceType.Mini)
      ) {
        return true;
      }
      return false;
    },
    [walletId],
    {
      initResult: false,
    },
  );

  const previousSignDisabled = usePrevious(
    isClassicOrMiniDevice && currentFormat === 'bip322',
  );
  useEffect(() => {
    const signDisabled = isClassicOrMiniDevice && currentFormat === 'bip322';
    if (previousSignDisabled !== signDisabled) {
      onDisabledChange(signDisabled);
    }
  }, [
    isClassicOrMiniDevice,
    onDisabledChange,
    currentFormat,
    previousSignDisabled,
  ]);

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
            message: intl.formatMessage(
              { id: ETranslations.send_memo_up_to_length },
              { number: '1024' },
            ),
          },
          validate: (value: string) => {
            const hexFormat = form.getValues('hexFormat');
            if (hexFormat && value) {
              if (!hexUtils.isHexString(value)) {
                return intl.formatMessage({
                  id: ETranslations.message_signing_message_invalid_hex,
                });
              }
            }
            return true;
          },
        }}
        labelAddon={
          <XStack alignItems="center" gap="$2">
            <Popover
              title={intl.formatMessage({
                id: ETranslations.message_signing_address_hex_format,
              })}
              renderTrigger={
                <Button
                  size="small"
                  variant="tertiary"
                  iconAfter="QuestionmarkOutline"
                  px="$1.5"
                  mx="$-1.5"
                  gap="$-1"
                >
                  {intl.formatMessage({
                    id: ETranslations.message_signing_address_hex_format,
                  })}
                </Button>
              }
              renderContent={() => (
                <YStack
                  p="$5"
                  pt="$0"
                  $gtMd={{
                    px: '$4',
                    py: '$3',
                  }}
                  gap="$4"
                >
                  <SizableText>
                    {intl.formatMessage({
                      id: ETranslations.sign_message_hex_format_description,
                    })}
                  </SizableText>

                  <YStack>
                    <SizableText size="$headingXs" color="$textSubdued">
                      {intl.formatMessage({
                        id: ETranslations.sign_message_hex_format_example_title,
                      })}
                    </SizableText>
                    <SizableText size="$headingSm">
                      {intl.formatMessage({
                        id: ETranslations.sign_message_hex_format_example_input,
                      })}
                    </SizableText>
                    <XStack>
                      <SizableText pr="$2">-</SizableText>
                      <SizableText>
                        {intl.formatMessage({
                          id: ETranslations.sign_message_hex_format_example_off,
                        })}
                      </SizableText>
                    </XStack>
                    <XStack>
                      <SizableText pr="$2">-</SizableText>
                      <SizableText>
                        {intl.formatMessage({
                          id: ETranslations.sign_message_hex_format_example_on,
                        })}
                      </SizableText>
                    </XStack>
                  </YStack>
                </YStack>
              )}
            />
            <Form.Field name="hexFormat">
              <Switch size="small" />
            </Form.Field>
          </XStack>
        }
      >
        <TextAreaInput
        // placeholder={intl.formatMessage({
        //   id: ETranslations.message_signing_address_placeholder,
        // })}
        />
      </Form.Field>

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.global_address,
        })}
        name="address"
        description={getAddressDescription()}
        rules={{
          required: intl.formatMessage({
            id: ETranslations.address_book_add_address_name_required,
          }),
        }}
      >
        <Select
          usingPercentSnapPoints
          title={intl.formatMessage({
            id: ETranslations.global_address,
          })}
          placeholder={intl.formatMessage({
            id: ETranslations.global_address,
          })}
          sections={selectOptions}
          offset={8}
          floatingPanelProps={{
            width: '$72',
            maxHeight: '$80',
          }}
          renderTrigger={({ label }) => {
            return (
              <XStack
                alignItems="center"
                gap="$3"
                py="$1.5"
                px="$3"
                borderWidth="$px"
                borderColor="$borderStrong"
                borderRadius="$2"
                borderCurve="continuous"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                focusable
                focusVisibleStyle={{
                  outlineColor: '$focusRing',
                  outlineWidth: 2,
                  outlineOffset: 0,
                  outlineStyle: 'solid',
                }}
                userSelect="none"
                onPress={() => {}}
              >
                <>
                  {currentSignAccount?.network.id ? (
                    <NetworkAvatar
                      networkId={currentSignAccount.network.id}
                      size="$6"
                    />
                  ) : (
                    <Skeleton w="$6" h="$6" radius="round" />
                  )}
                </>
                <SizableText color="$text" size="$bodyLg" flex={1}>
                  {label}
                </SizableText>
                <Icon name="ChevronDownSmallOutline" color="$iconSubdued" />
              </XStack>
            );
          }}
        />
      </Form.Field>

      {displayFormatForm ? (
        <YStack gap="$2">
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.signature_format_title,
            })}
            labelAddon={
              <Popover
                title={intl.formatMessage({
                  id: ETranslations.signature_format_title,
                })}
                renderTrigger={
                  <Button
                    iconAfter="QuestionmarkOutline"
                    size="small"
                    variant="tertiary"
                  >
                    {intl.formatMessage({
                      id: ETranslations.global_learn_more,
                    })}
                  </Button>
                }
                renderContent={() => (
                  <YStack
                    p="$5"
                    pt="$0"
                    $gtMd={{
                      px: '$4',
                      py: '$3',
                    }}
                    gap="$4"
                  >
                    <SizableText>
                      {intl.formatMessage({
                        id: ETranslations.signature_format_description,
                      })}
                    </SizableText>

                    <YStack>
                      <XStack>
                        <SizableText pr="$2">-</SizableText>
                        <SizableText>
                          {intl.formatMessage({
                            id: ETranslations.signature_format_standard,
                          })}
                        </SizableText>
                      </XStack>
                      <XStack>
                        <SizableText pr="$2">-</SizableText>
                        <SizableText>
                          {intl.formatMessage({
                            id: ETranslations.signature_format_bip137,
                          })}
                        </SizableText>
                      </XStack>
                      <XStack>
                        <SizableText pr="$2">-</SizableText>
                        <SizableText>
                          {intl.formatMessage({
                            id: ETranslations.signature_format_322,
                          })}
                        </SizableText>
                      </XStack>
                    </YStack>
                  </YStack>
                )}
              />
            }
            name="format"
          >
            <Radio
              orientation="horizontal"
              gap="$5"
              options={formatRadioOptions}
            />
          </Form.Field>
          {isClassicOrMiniDevice && currentFormat === 'bip322' ? (
            <Alert
              title={intl.formatMessage(
                {
                  id: ETranslations.signature_type_not_supported_on_model,
                },
                {
                  sigType: 'BIP322',
                  deviceModel: 'Classic, Mini',
                },
              )}
              type="warning"
            />
          ) : null}
        </YStack>
      ) : null}
      <Divider />

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.message_signing_signature_label,
        })}
        name="signature"
        {...(currentSignature && {
          labelAddon: (
            <Button onPress={onCopySignature} size="small" variant="tertiary">
              {intl.formatMessage({ id: ETranslations.global_copy })}
            </Button>
          ),
        })}
      >
        <TextAreaInput
          placeholder={intl.formatMessage({
            id: ETranslations.message_signing_signature_desc,
          })}
          editable={false}
          containerProps={{
            borderStyle: 'dashed',
          }}
        />
      </Form.Field>
    </Form>
  );
};

export type { ISignFormData };
