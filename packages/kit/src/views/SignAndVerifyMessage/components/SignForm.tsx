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
  useClipboard,
} from '@onekeyhq/components';
import type { ISelectSection, UseFormReturn } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import { usePrevious } from '@onekeyhq/kit/src/hooks/usePrevious';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  captureSignAndVerifyError,
  logSignAndVerifyCrashProbe,
  logSignAndVerifyTextProbe,
} from '@onekeyhq/kit/src/views/SignAndVerifyMessage/utils/crashProbe';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ISignAccount } from '@onekeyhq/shared/types/signAndVerify';

import { SignAndVerifyMessageTestIDs } from '../testIDs';

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
  const { copyText } = useClipboard();

  const handleCopyWithStopPropagation = useCallback(
    (text: string) => (e?: { stopPropagation?: () => void }) => {
      if (e?.stopPropagation) {
        e.stopPropagation();
      }
      copyText(text);
    },
    [copyText],
  );

  const signature = form.watch('signature');
  const rawMessage = form.watch('message');
  const selectedAddress = form.watch('address');
  const currentSignAccount = useMemo(() => {
    return captureSignAndVerifyError('currentSignAccount useMemo crash', () => {
      logSignAndVerifyCrashProbe('currentSignAccount useMemo enter', [
        { name: 'selectedAddress', value: selectedAddress },
        {
          name: 'signAccountsRef.current',
          value: signAccountsRef.current,
        },
      ]);
      if (!selectedAddress) {
        return undefined;
      }
      const matched = signAccountsRef.current.find(
        (account) => account.account.address === selectedAddress,
      );
      logSignAndVerifyCrashProbe('currentSignAccount useMemo exit', [
        { name: 'matched', value: matched },
      ]);
      return matched;
    });
  }, [selectedAddress]);

  const logSignAccountDeepProbe = useCallback(
    (stage: string, signAccount: ISignAccount | undefined) => {
      const accountFields = signAccount?.account as
        | Record<string, unknown>
        | undefined;
      logSignAndVerifyCrashProbe(stage, [
        {
          name: 'signAccount',
          value: signAccount,
          maxDepth: 2,
          maxArrayItems: 4,
          maxKeys: 24,
        },
        {
          name: 'signAccount.account',
          value: signAccount?.account,
          maxDepth: 2,
          maxArrayItems: 6,
          maxKeys: 24,
        },
        {
          name: 'signAccount.account.connectedAddresses',
          value: accountFields?.connectedAddresses,
          maxDepth: 2,
          maxArrayItems: 6,
          maxKeys: 24,
        },
        {
          name: 'signAccount.account.selectedAddress',
          value: accountFields?.selectedAddress,
          maxDepth: 2,
          maxArrayItems: 6,
          maxKeys: 24,
        },
        {
          name: 'signAccount.account.addressDetail',
          value: signAccount?.account?.addressDetail,
          maxDepth: 2,
          maxArrayItems: 6,
          maxKeys: 24,
        },
        {
          name: 'signAccount.network',
          value: signAccount?.network,
          maxDepth: 2,
          maxArrayItems: 6,
          maxKeys: 24,
        },
      ]);
    },
    [],
  );

  useEffect(() => {
    logSignAndVerifyCrashProbe('sign form selected account effect', [
      { name: 'currentSignAccount', value: currentSignAccount },
      {
        name: 'currentSignAccount.network',
        value: currentSignAccount?.network,
      },
      {
        name: 'currentSignAccount.account',
        value: currentSignAccount?.account,
      },
    ]);
    if (currentSignAccount) {
      logSignAccountDeepProbe(
        'sign form selected account deep effect',
        currentSignAccount,
      );
    }
    captureSignAndVerifyError(
      'onCurrentSignAccountChange callback crash',
      () => {
        logSignAndVerifyCrashProbe(
          'onCurrentSignAccountChange callback before',
          [
            {
              name: 'currentSignAccount',
              value: currentSignAccount,
            },
            {
              name: 'typeof onCurrentSignAccountChange',
              value: typeof onCurrentSignAccountChange,
            },
          ],
        );
        onCurrentSignAccountChange?.(currentSignAccount);
        logSignAndVerifyCrashProbe(
          'onCurrentSignAccountChange callback after',
          [
            {
              name: 'currentSignAccount',
              value: currentSignAccount,
            },
          ],
        );
      },
    );
  }, [currentSignAccount, logSignAccountDeepProbe, onCurrentSignAccountChange]);

  const setDefaultAccount = useCallback(async () => {
    logSignAndVerifyCrashProbe('sign form set default account start', [
      { name: 'selectedAddress', value: selectedAddress },
      { name: 'networkId', value: networkId },
      { name: 'signAccountsRef.current', value: signAccountsRef.current },
    ]);
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
    logSignAndVerifyCrashProbe('sign form set default account network result', [
      { name: 'network', value: network },
      { name: 'signAccountsRef.current', value: signAccountsRef.current },
    ]);
    if (
      networkId === getNetworkIdsMap().eth ||
      network.impl === IMPL_EVM ||
      networkId === getNetworkIdsMap().sol
    ) {
      const defaultAccount = signAccountsRef.current.find(
        (i) => i.network.id === networkId || i.network.impl === network.impl,
      );
      if (defaultAccount) {
        logSignAccountDeepProbe(
          'sign form set default account before address set',
          defaultAccount,
        );
        form.setValue('address', defaultAccount.account.address);
        logSignAccountDeepProbe(
          'sign form set default account after address set',
          defaultAccount,
        );
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
          logSignAccountDeepProbe(
            'sign form set default btc account before address set',
            defaultAccount,
          );
          form.setValue('address', defaultAccount.account.address);
          logSignAccountDeepProbe(
            'sign form set default btc account after address set',
            defaultAccount,
          );
          return;
        }
      }
    }
    logSignAccountDeepProbe(
      'sign form set default fallback account before address set',
      signAccountsRef.current[0],
    );
    form.setValue('address', signAccountsRef.current[0].account.address);
    logSignAccountDeepProbe(
      'sign form set default fallback account after address set',
      signAccountsRef.current[0],
    );
  }, [
    form,
    logSignAccountDeepProbe,
    networkId,
    selectedAddress,
    signAccountsRef,
  ]);

  const { result: selectOptions } = usePromiseResult<ISelectSection[]>(
    async () => {
      logSignAndVerifyCrashProbe('sign form accounts request start', [
        { name: 'networkId', value: networkId },
        { name: 'accountId', value: accountId },
        { name: 'indexedAccountId', value: indexedAccountId },
        { name: 'isOthersWallet', value: isOthersWallet },
      ]);
      const signAccounts =
        await backgroundApiProxy.serviceInternalSignAndVerify.getSignAccounts({
          networkId,
          accountId,
          indexedAccountId,
          isOthersWallet,
        });
      const signAccountProbeValues = signAccounts
        .slice(0, 8)
        .flatMap((signAccount, index) => [
          { name: `signAccounts[${index}]`, value: signAccount },
          {
            name: `signAccounts[${index}].network`,
            value: signAccount.network,
          },
          {
            name: `signAccounts[${index}].account`,
            value: signAccount.account,
          },
        ]);
      logSignAndVerifyCrashProbe('sign form accounts request result', [
        { name: 'signAccounts', value: signAccounts },
        ...signAccountProbeValues,
      ]);
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
      setDefaultAccount().catch((error: unknown) => {
        const errorObj = error as Error | null;
        logSignAndVerifyTextProbe(
          'setDefaultAccount rejection',
          `error.name=${String(errorObj?.name)} | error.message=${String(
            errorObj?.message,
          )} | error.stack=${String(errorObj?.stack)
            .replace(/\r?\n/g, ' <- ')
            .replace(/\s+/g, ' ')}`,
        );
      });
      return result;
    },
    [accountId, indexedAccountId, isOthersWallet, networkId, setDefaultAccount],
    {
      initResult: [],
    },
  );

  const displayFormatForm = useMemo(() => {
    return captureSignAndVerifyError('displayFormatForm useMemo crash', () => {
      logSignAndVerifyCrashProbe('displayFormatForm useMemo enter', [
        {
          name: 'currentSignAccount.network.id',
          value: currentSignAccount?.network.id,
        },
      ]);
      return networkUtils.isBTCNetwork(currentSignAccount?.network.id);
    });
  }, [currentSignAccount?.network.id]);

  const formatRadioOptions = useMemo(() => {
    return captureSignAndVerifyError('formatRadioOptions useMemo crash', () => {
      logSignAndVerifyCrashProbe('formatRadioOptions useMemo enter', [
        {
          name: 'currentSignAccount.account.id',
          value: currentSignAccount?.account.id,
        },
        {
          name: 'currentSignAccount.network.id',
          value: currentSignAccount?.network.id,
        },
        {
          name: 'currentSignAccount.deriveType',
          value: currentSignAccount?.deriveType,
        },
      ]);
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
    });
  }, [
    currentSignAccount?.account.id,
    currentSignAccount?.network.id,
    currentSignAccount?.deriveType,
    intl,
  ]);

  const currentFormat = form.watch('format');
  const currentMessage = form.watch('message');
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
      logSignAndVerifyCrashProbe('sign form wallet lookup start', [
        { name: 'walletId', value: walletId },
      ]);
      const wallet = await backgroundApiProxy.serviceAccount.getWalletSafe({
        walletId: walletId ?? '',
      });
      const deviceType = wallet?.associatedDeviceInfo?.deviceType;
      logSignAndVerifyCrashProbe('sign form wallet lookup result', [
        { name: 'wallet', value: wallet },
        {
          name: 'wallet.associatedDeviceInfo',
          value: wallet?.associatedDeviceInfo,
        },
        { name: 'wallet.associatedDevice', value: wallet?.associatedDevice },
      ]);
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
                  testID="sign-and-verify-message-hex-format-btn"
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
              <Switch
                testID={SignAndVerifyMessageTestIDs.signHexFormatSwitch}
                size="small"
              />
            </Form.Field>
          </XStack>
        }
      >
        <TextAreaInput
          testID={SignAndVerifyMessageTestIDs.signMessageInput}
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
          testID={SignAndVerifyMessageTestIDs.signAddressSelect}
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
                    testID="sign-and-verify-message-btn"
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
              testID={SignAndVerifyMessageTestIDs.signFormatRadio}
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

      {!signature ? (
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.message_signing_signature_label,
          })}
          name="signature"
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
      ) : (
        <YStack gap="$3">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({
              id: ETranslations.message_signing_signature_label,
            })}
          </SizableText>

          <YStack
            borderRadius="$2"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderCurve="continuous"
          >
            {/* Message Section */}
            <YStack gap="$1" p="$3">
              <SizableText size="$bodyMd">
                {intl.formatMessage({ id: ETranslations.global_hex_data })}
              </SizableText>
              <XStack gap="$4" pr="$1" alignItems="flex-start">
                <SizableText
                  flex={1}
                  color="$textSubdued"
                  wordWrap="break-word"
                  style={{ overflowWrap: 'break-word' }}
                  numberOfLines={2}
                >
                  {rawMessage}
                </SizableText>
                <Button
                  testID={SignAndVerifyMessageTestIDs.signCopyMessageBtn}
                  size="small"
                  variant="tertiary"
                  onPress={handleCopyWithStopPropagation(rawMessage)}
                >
                  {intl.formatMessage({ id: ETranslations.global_copy })}
                </Button>
              </XStack>
            </YStack>

            {/* Address Section */}
            <YStack gap="$1" p="$3">
              <SizableText size="$bodyMd">
                {intl.formatMessage({ id: ETranslations.global_address })}
              </SizableText>
              <XStack gap="$4" pr="$1" alignItems="flex-start">
                <SizableText
                  flex={1}
                  color="$textSubdued"
                  wordWrap="break-word"
                  style={{
                    overflowWrap: 'break-word',
                    wordBreak: 'break-all',
                  }}
                >
                  {selectedAddress}
                </SizableText>
                <Button
                  testID={SignAndVerifyMessageTestIDs.signCopyAddressBtn}
                  size="small"
                  variant="tertiary"
                  flexShrink={0}
                  onPress={handleCopyWithStopPropagation(selectedAddress)}
                >
                  {intl.formatMessage({ id: ETranslations.global_copy })}
                </Button>
              </XStack>
            </YStack>

            {/* Signature Section */}

            <YStack gap="$1" p="$3">
              <SizableText size="$bodyMd">
                {intl.formatMessage({
                  id: ETranslations.message_signing_signature_label,
                })}
              </SizableText>
              <XStack gap="$4" pr="$1" alignItems="flex-start">
                <SizableText
                  flex={1}
                  color="$textSubdued"
                  wordWrap="break-word"
                  style={{
                    overflowWrap: 'break-word',
                    wordBreak: 'break-all',
                  }}
                >
                  {signature}
                </SizableText>
                <Button
                  testID={SignAndVerifyMessageTestIDs.signCopySignatureBtn}
                  size="small"
                  variant="tertiary"
                  onPress={handleCopyWithStopPropagation(signature)}
                >
                  {intl.formatMessage({ id: ETranslations.global_copy })}
                </Button>
              </XStack>
            </YStack>

            <Divider />

            <YStack py="$2" px="$3">
              <Button
                testID={SignAndVerifyMessageTestIDs.signCopyAllBtn}
                onPress={onCopySignature}
                size="small"
                variant="tertiary"
              >
                {intl.formatMessage({ id: ETranslations.global_copy_all })}
              </Button>
            </YStack>
          </YStack>
        </YStack>
      )}
    </Form>
  );
};

export type { ISignFormData };
