/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { memo, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { isNil } from 'lodash';

import {
  Button,
  Collapse,
  Form,
  Icon,
  Text,
  useForm,
} from '@onekeyhq/components';

import { useNetworkSimple } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';
import { isHexString } from '../../../utils/helper';

import CoinControlAdvancedSetting from './CoinControlAdvancedSetting';
import { LabelWithTooltip } from './LableWithTooltip';

import type { SendConfirmAdvancedSettings as AdvancedSettings } from '../types';

type Props = {
  accountId: string;
  networkId: string;
  encodedTx: any;
  advancedSettings: AdvancedSettings | undefined;
  setAdvancedSettings: React.Dispatch<React.SetStateAction<AdvancedSettings>>;
  isLoadingAdvancedSettings: boolean;
};

type AdvancedSettingsForm = {
  nonce: string;
  hexData: string;
};

function SendConfirmAdvancedSettingsMemo(props: Props) {
  const {
    accountId,
    networkId,
    encodedTx,
    advancedSettings,
    setAdvancedSettings,
    isLoadingAdvancedSettings,
  } = props;

  const originalNonce = String(
    encodedTx.nonce ?? advancedSettings?.originalNonce,
  );
  const originalHexData = encodedTx.data;

  const network = useNetworkSimple(networkId);

  const nonceEditable = network?.settings?.nonceEditable;
  const isBtcForkChain = network?.settings?.isBtcForkChain;
  const hexDataEditable = network?.settings?.hexDataEditable;

  const intl = useIntl();

  const useFormReturn = useForm<AdvancedSettingsForm>({
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const { control, setValue, register } = useFormReturn;

  const { formValues } = useFormOnChangeDebounced<AdvancedSettingsForm>({
    useFormReturn,
  });

  const currentNonce = formValues?.nonce;
  const currentHexData = formValues?.hexData;

  const isLessNonce = new BigNumber(currentNonce ?? 0).isLessThan(
    new BigNumber(originalNonce),
  );

  const { onBlur } = register('nonce', {
    onBlur: () => {
      if (!currentNonce) {
        setValue('nonce', originalNonce);
      }
    },
  });

  const isCoinControlChecked = useMemo(
    () => !!advancedSettings?.isCoinControlChecked,
    [advancedSettings?.isCoinControlChecked],
  );

  const advanceSettings = useMemo(() => {
    const settings = [];

    if (nonceEditable && originalNonce !== '') {
      const isEditNonceDisabled = originalNonce === currentNonce;
      settings.push(
        <Form.Item
          name="nonce"
          label={
            <LabelWithTooltip
              labelId="form__nonce"
              tooltipId="content__what_is_nonce_desc"
            />
          }
          rules={{
            min: 0,
          }}
          control={control}
          helpText={intl.formatMessage(
            {
              id: 'form__current_str',
            },
            {
              '0': originalNonce,
            },
          )}
        >
          <Form.NumberInput
            borderColor={
              isLessNonce ? 'border-warning-default' : 'border-default'
            }
            isDisabled={isLoadingAdvancedSettings}
            decimal={0}
            size="xl"
            onBlur={onBlur}
            rightCustomElement={
              <Button
                isLoading={isLoadingAdvancedSettings}
                type="plain"
                isDisabled={isEditNonceDisabled || isLoadingAdvancedSettings}
                onPress={() => setValue('nonce', originalNonce)}
              >
                <Text
                  color={isEditNonceDisabled ? 'text-subdued' : 'text-default'}
                >
                  {intl.formatMessage({ id: 'action__reset' })}
                </Text>
              </Button>
            }
          />
        </Form.Item>,
      );
    }

    if (hexDataEditable) {
      const isEditHexDataDisabled =
        originalHexData && originalHexData !== '' && originalHexData !== '0x';
      settings.push(
        <Form.Item
          name="hexData"
          label={
            <LabelWithTooltip
              labelId="form__hex_data"
              tooltipId="form__hex_data_question_mark"
            />
          }
          control={control}
          rules={{
            validate: (value) => {
              if (!value) return true;

              if (!isHexString(value)) {
                return intl.formatMessage({
                  id: 'msg__invalid_hex_data',
                });
              }
            },
          }}
        >
          <Form.Textarea
            bgColor="action-secondary-default"
            isDisabled={isEditHexDataDisabled}
            marginBottom="1px"
          />
        </Form.Item>,
      );
    }

    if (isBtcForkChain) {
      settings.push(
        <CoinControlAdvancedSetting
          network={network}
          accountId={accountId}
          encodedTx={encodedTx}
          isChecked={isCoinControlChecked}
          onToggleCoinControl={() => {
            setAdvancedSettings((prev) => ({
              ...prev,
              isCoinControlChecked: !prev.isCoinControlChecked,
              selectedUtxos: [],
            }));
          }}
          onSelectedUtxos={(selectedUtxos) => {
            setAdvancedSettings((prev) => ({
              ...prev,
              selectedUtxos,
            }));
          }}
        />,
      );
    }

    return settings;
  }, [
    nonceEditable,
    originalNonce,
    hexDataEditable,
    isBtcForkChain,
    currentNonce,
    control,
    intl,
    isLessNonce,
    isLoadingAdvancedSettings,
    onBlur,
    setValue,
    originalHexData,
    network,
    accountId,
    encodedTx,
    isCoinControlChecked,
    setAdvancedSettings,
  ]);

  useEffect(() => {
    setValue('nonce', originalNonce);
    setValue('hexData', originalHexData);
  }, [originalHexData, originalNonce, setValue]);

  useEffect(() => {
    if (!isNil(currentNonce)) {
      setAdvancedSettings((prev) => ({ ...prev, currentNonce }));
    }
  }, [currentNonce, setAdvancedSettings]);

  useEffect(() => {
    if (!isNil(currentHexData)) {
      setAdvancedSettings((prev) => ({ ...prev, currentHexData }));
    }
  }, [currentHexData, setAdvancedSettings]);

  if (advanceSettings && advanceSettings.length > 0) {
    return (
      <Collapse
        arrowPosition="right"
        textAlign="center"
        renderCustomTrigger={(onPress, collapsed) =>
          collapsed ? (
            <Button
              rightIcon={
                <Icon size={12} name="ChevronDownMini" color="icon-subdued" />
              }
              type="plain"
              size="sm"
              mt={2}
              onPress={onPress}
            >
              <Text
                typography="Body1Strong"
                fontSize="14px"
                color="text-subdued"
              >
                {intl.formatMessage({ id: 'action__advance' })}
              </Text>
            </Button>
          ) : null
        }
      >
        <Form mt={6} textAlign="left" paddingX="1px">
          {advanceSettings}
        </Form>
      </Collapse>
    );
  }

  return null;
}

export const SendConfirmAdvancedSettings = memo(
  SendConfirmAdvancedSettingsMemo,
);
