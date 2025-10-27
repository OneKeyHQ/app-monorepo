import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  Button,
  Divider,
  Form,
  Input,
  Popover,
  Radio,
  SizableText,
  Switch,
  TextAreaInput,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { UseFormReturn } from '@onekeyhq/components';
import { isTaprootAddress } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

type IVerifyFormData = {
  message: string;
  address: string;
  signature: string;
  hexFormat: boolean;
  format: string;
};

interface IVerifyFormProps {
  form: UseFormReturn<IVerifyFormData>;
  onNetworkDetected?: (networkId: string | null) => void;
}

export const VerifyForm = ({ form, onNetworkDetected }: IVerifyFormProps) => {
  const intl = useIntl();
  const [detectedNetworkId, setDetectedNetworkId] = useState<string | null>(
    null,
  );

  // sorted by the priority of BTC, ETH, SOL (sorted by predefined networkIds map)
  const detectNetworkByAddress = useCallback(
    async (address: string): Promise<string | null> => {
      if (!address) return null;

      const networksToCheck = [
        getNetworkIdsMap().btc,
        getNetworkIdsMap().eth,
        getNetworkIdsMap().sol,
      ];

      for (const checkNetworkId of networksToCheck) {
        try {
          const validation =
            await backgroundApiProxy.serviceValidator.localValidateAddress({
              networkId: checkNetworkId,
              address,
            });

          if (validation.isValid) {
            return checkNetworkId;
          }
        } catch (error) {
          // eslint-disable-next-line no-continue
          continue;
        }
      }

      return null;
    },
    [],
  );

  const throttledAddressValidation = useThrottledCallback(
    async (address: string) => {
      if (!address || address.length < 8) {
        setDetectedNetworkId(null);
        onNetworkDetected?.(null);
        return;
      }
      const detectedNetwork = await detectNetworkByAddress(address);
      setDetectedNetworkId(detectedNetwork);
      onNetworkDetected?.(detectedNetwork);
    },
    500,
    { leading: false, trailing: true },
  );

  const watchedAddress = form.watch('address');
  useEffect(() => {
    void throttledAddressValidation(watchedAddress || '');
  }, [watchedAddress, throttledAddressValidation]);

  const displayFormatForm = useMemo(() => {
    return networkUtils.isBTCNetwork(detectedNetworkId ?? undefined);
  }, [detectedNetworkId]);

  const formatRadioOptions = useMemo(() => {
    if (!networkUtils.isBTCNetwork(detectedNetworkId ?? undefined)) {
      return [];
    }
    return [
      {
        label: intl.formatMessage({ id: ETranslations.standard_or_BIP137 }),
        value: 'bip137',
        disabled: isTaprootAddress(watchedAddress),
      },
      { label: 'BIP322', value: 'bip322', disabled: false },
    ];
  }, [detectedNetworkId, intl, watchedAddress]);

  // Set default format when displayFormatForm changes
  useEffect(() => {
    if (displayFormatForm) {
      const currentFormat = form.getValues('format');
      if (!currentFormat) {
        form.setValue(
          'format',
          isTaprootAddress(watchedAddress) ? 'bip322' : 'bip137',
        );
      }
    } else {
      form.setValue('format', '');
    }
  }, [displayFormatForm, form, watchedAddress]);

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
        // size="large"
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
        description={intl.formatMessage(
          {
            id: ETranslations.verify_message_address_form_description,
          },
          {
            networks: 'Bitcoin, Ethereum, Solana',
          },
        )}
        rules={{
          required: intl.formatMessage({
            id: ETranslations.address_book_add_address_name_required,
          }),
          validate: useCallback(
            async (value: string) => {
              if (!value) return true;

              const detectedNetwork = await detectNetworkByAddress(value);
              setDetectedNetworkId(detectedNetwork);
              onNetworkDetected?.(detectedNetwork);

              if (!detectedNetwork) {
                return intl.formatMessage({
                  id: ETranslations.message_signing_address_invalid_text,
                });
              }

              return true;
            },
            [detectNetworkByAddress, intl, onNetworkDetected],
          ),
        }}
      >
        <Input />
      </Form.Field>

      {displayFormatForm ? (
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
                  {intl.formatMessage({ id: ETranslations.global_learn_more })}
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
      ) : null}

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.message_signing_signature_label,
        })}
        name="signature"
        rules={{
          required: intl.formatMessage({
            id: ETranslations.address_book_add_address_name_required,
          }),
        }}
      >
        <TextAreaInput />
      </Form.Field>
    </Form>
  );
};

export type { IVerifyFormData };
