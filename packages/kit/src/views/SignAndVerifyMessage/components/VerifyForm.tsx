import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';
import { useThrottledCallback } from 'use-debounce';

import {
  Divider,
  Form,
  Input,
  SizableText,
  Switch,
  TextAreaInput,
  XStack,
} from '@onekeyhq/components';
import type { UseFormReturn } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

type IVerifyFormData = {
  message: string;
  address: string;
  signature: string;
  hexFormat: boolean;
  format: string;
};

interface IVerifyFormProps {
  form: UseFormReturn<IVerifyFormData>;
  onVerifyResult?: (isValid: boolean) => void;
  onNetworkDetected?: (networkId: string | null) => void;
}

export const VerifyForm = ({
  form,
  onVerifyResult,
  onNetworkDetected,
}: IVerifyFormProps) => {
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
            message: 'Maximum length is 1024 characters',
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
        description="Supports: Bitcoin, Ethereum, Solana"
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
                return 'Invalid address or unsupported network';
              }

              return true;
            },
            [detectNetworkByAddress, onNetworkDetected],
          ),
        }}
      >
        <Input placeholder="Enter Address" />
      </Form.Field>

      <Divider />

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
        <Input placeholder="Enter Signature" />
      </Form.Field>
    </Form>
  );
};

export type { IVerifyFormData };
