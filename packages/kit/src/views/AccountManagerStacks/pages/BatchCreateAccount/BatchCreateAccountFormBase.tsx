import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Form,
  IconButton,
  Input,
  SizableText,
  Stack,
  XStack,
  useForm,
  useMedia,
} from '@onekeyhq/components';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import type { UseFormReturn } from 'react-hook-form';

export type IBatchCreateAccountFormValues = {
  networkId?: string;
  deriveType?: IAccountDeriveTypes;
  from: string;
  count: string;
};

export const BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT = 15;
export const BATCH_CREATE_ACCONT_SINGLE_NETWORK_MAX_COUNT = 100;
export const BATCH_CREATE_ACCONT_MAX_COUNT = 2 ** 31;
export const BATCH_CREATE_ACCONT_MAX_FROM =
  BATCH_CREATE_ACCONT_MAX_COUNT + 1 - 15;

function AdvancedSettingsFormField({
  form,
  isAllNetwork,
  alwaysShowAdvancedSettings,
}: {
  form: UseFormReturn<IBatchCreateAccountFormValues, any, undefined>;
  isAllNetwork: boolean | undefined;
  alwaysShowAdvancedSettings?: boolean;
}) {
  const intl = useIntl();
  const media = useMedia();
  const [collapse, setCollapse] = useState(!alwaysShowAdvancedSettings);

  const toggle = useCallback(() => {
    setCollapse((v) => !v);
  }, []);

  const fromValue = form.watch('from');
  const countValue = form.watch('count');

  const fromError = form.formState.errors.from;

  const calculateAddressRange = useMemo(() => {
    if (!fromValue || !countValue) {
      return '';
    }
    const from = parseInt(fromValue, 10);
    const count = parseInt(countValue, 10);
    const to = from + count - 1;
    const text = intl.formatMessage(
      {
        id: ETranslations.global_serial_number_start_desc,
      },
      {
        from,
        to,
      },
    );
    return `${text}`;
  }, [countValue, fromValue, intl]);

  return (
    <Stack>
      {!alwaysShowAdvancedSettings ? (
        <XStack gap="$3" py="$2" ai="center" onPress={toggle}>
          <Stack>
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_advantage_settings,
              })}
            </SizableText>
          </Stack>
          <IconButton
            icon={
              collapse ? 'ChevronDownSmallOutline' : 'ChevronTopSmallOutline'
            }
            variant="tertiary"
            onPress={toggle}
          />
        </XStack>
      ) : null}

      <Stack
        width={collapse ? 0 : undefined}
        height={collapse ? 0 : undefined}
        opacity={collapse ? 0 : undefined}
        overflow={collapse ? 'hidden' : undefined}
      >
        <Stack mt={!alwaysShowAdvancedSettings ? '$4' : undefined}>
          <Form.Field
            label={intl.formatMessage({
              id: ETranslations.global_serial_number_start,
            })}
            name="from"
            rules={{
              required: true,
              validate: (value: string) => {
                const valueNum = new BigNumber(value);
                if (!value || valueNum.isNaN()) {
                  return intl.formatMessage({
                    id: ETranslations.global_bulk_accounts_page_number_error,
                  });
                }
                if (valueNum.isLessThan(1)) {
                  return 'The minimum number of accounts is 1';
                }
                return true;
              },
              onChange: (e: { target: { name: string; value: string } }) => {
                const value = (e?.target?.value || '').replace(/\D/g, '');
                const valueNum = new BigNumber(parseInt(value, 10));
                if (!value || valueNum.isNaN()) {
                  form.setValue('from', '');
                  return;
                }
                if (valueNum.isLessThan(1)) {
                  form.setValue('from', '1');
                  return;
                }
                if (
                  valueNum.isGreaterThanOrEqualTo(BATCH_CREATE_ACCONT_MAX_FROM)
                ) {
                  form.setValue(
                    'from',
                    BATCH_CREATE_ACCONT_MAX_FROM.toString(),
                  );
                  return;
                }
                form.setValue('from', valueNum.toFixed());
              },
            }}
          >
            <Input
              secureTextEntry={false}
              placeholder={intl.formatMessage({
                id: ETranslations.global_serial_number_start,
              })}
              size={media.gtMd ? 'medium' : 'large'}
            />
            {!fromError ? (
              <Form.FieldDescription>
                {calculateAddressRange}
              </Form.FieldDescription>
            ) : null}
          </Form.Field>
        </Stack>
      </Stack>
    </Stack>
  );
}

export function BatchCreateAccountFormBase({
  alwaysShowAdvancedSettings,
  networkReadyOnly,
  defaultCount,
  defaultDeriveType,
  defaultFrom,
  defaultNetworkId,
  onNetworkChanged,
  formRef,
}: {
  alwaysShowAdvancedSettings?: boolean;
  networkReadyOnly?: boolean;
  defaultNetworkId: string;
  defaultDeriveType: IAccountDeriveTypes | undefined;
  defaultFrom: string; // 1
  defaultCount: string; // 1
  onNetworkChanged?: (params: {
    networkId: string | undefined;
    isAllNetwork: boolean;
  }) => void;
  formRef?: React.MutableRefObject<
    UseFormReturn<IBatchCreateAccountFormValues, any, undefined> | undefined
  >;
}) {
  const intl = useIntl();
  const media = useMedia();

  const form = useForm<IBatchCreateAccountFormValues>({
    values: {
      // networkId: activeAccount?.network?.id ?? getNetworkIdsMap().all,
      networkId: defaultNetworkId,
      deriveType: defaultDeriveType,
      from: defaultFrom,
      count: defaultCount,
    },
    mode: 'onChange',
    reValidateMode: 'onChange',
  });
  if (formRef) {
    formRef.current = form;
  }

  const networkIdValue = form.watch('networkId');

  const isAllNetwork = useMemo(
    () => networkUtils.isAllNetwork({ networkId: networkIdValue }),
    [networkIdValue],
  );

  useEffect(() => {
    onNetworkChanged?.({
      networkId: networkIdValue,
      isAllNetwork,
    });
  }, [isAllNetwork, networkIdValue, onNetworkChanged]);

  return (
    <Form form={form}>
      {/* <Form.Field
        label={intl.formatMessage({ id: ETranslations.global_network })}
        name="networkId"
        disabled={networkReadyOnly}
      >
        <ControlledNetworkSelectorTrigger
          forceDisabled={networkReadyOnly}
          disabled={networkReadyOnly}
          editable={!networkReadyOnly}
        />
        {networkIdValue === getNetworkIdsMap().onekeyall ? (
          <Form.FieldDescription>
            {intl.formatMessage({
              id: ETranslations.global_networks_information,
            })}
          </Form.FieldDescription>
        ) : null}
      </Form.Field> */}

      <Form.Field
        label={intl.formatMessage({
          id: ETranslations.global_generate_amount,
        })}
        name="count"
        rules={{
          required: true,
          validate: (value: string, values) => {
            const valueNum = new BigNumber(value);
            if (!value || valueNum.isNaN()) {
              return intl.formatMessage({
                id: ETranslations.global_bulk_accounts_page_number_error,
              });
            }
            let max = isAllNetwork
              ? BATCH_CREATE_ACCONT_ALL_NETWORK_MAX_COUNT
              : BATCH_CREATE_ACCONT_SINGLE_NETWORK_MAX_COUNT;

            if (values.from) {
              const fromNum = new BigNumber(values.from);
              if (!fromNum.isNaN()) {
                const maxByFrom =
                  BATCH_CREATE_ACCONT_MAX_COUNT + 1 - fromNum.toNumber();
                max = Math.min(max, maxByFrom);
              }
            }

            if (valueNum.isGreaterThan(max)) {
              return intl.formatMessage(
                {
                  id: ETranslations.global_generate_amount_information,
                },
                {
                  max,
                },
              );
            }
            if (valueNum.isLessThan(1)) {
              return 'The minimum number of accounts is 1';
            }
            return true;
          },
          onChange: (e: { target: { name: string; value: string } }) => {
            const value = (e?.target?.value || '').replace(/\D/g, '');
            const valueNum = new BigNumber(parseInt(value, 10));
            if (!value || valueNum.isNaN()) {
              form.setValue('count', '');
              return;
            }
            if (valueNum.isLessThan(1)) {
              form.setValue('count', '1');
              return;
            }
            form.setValue('count', valueNum.toFixed());
          },
        }}
      >
        <Input
          secureTextEntry={false}
          testID="account-generate-amount-input"
          placeholder={intl.formatMessage({
            id: ETranslations.global_generate_amount,
          })}
          size={media.gtMd ? 'medium' : 'large'}
        />
      </Form.Field>

      <AdvancedSettingsFormField
        form={form}
        alwaysShowAdvancedSettings={alwaysShowAdvancedSettings}
        isAllNetwork={isAllNetwork}
      />

      {/* <DeriveTypeSelectorFormField
        fieldName="deriveType"
        networkId={networkIdValue}
      /> */}
    </Form>
  );
}
