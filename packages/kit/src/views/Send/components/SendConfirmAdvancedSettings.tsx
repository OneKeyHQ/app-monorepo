import { memo, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const originNonce = String(encodedTx.nonce ?? advancedSettings?.originNonce);

  const network = useNetworkSimple(networkId);

  const nonceEditable = network?.settings?.nonceEditable;
  const isBtcForkChain = network?.settings?.isBtcForkChain;

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

  const isLessNonce = new BigNumber(currentNonce ?? 0).isLessThan(
    new BigNumber(originNonce),
  );

  const { onBlur } = register('nonce', {
    onBlur: () => {
      if (!currentNonce) {
        setValue('nonce', originNonce);
      }
    },
  });

  const isCoinControlChecked = useMemo(
    () => !!advancedSettings?.isCoinControlChecked,
    [advancedSettings?.isCoinControlChecked],
  );

  const advanceSettings = useMemo(() => {
    const settings = [];

    if (nonceEditable && originNonce !== '') {
      const isEditNonceDisabled = originNonce === currentNonce;
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
              '0': originNonce,
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
                onPress={() => setValue('nonce', originNonce)}
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
    accountId,
    network,
    encodedTx,
    nonceEditable,
    originNonce,
    isBtcForkChain,
    currentNonce,
    intl,
    control,
    isLessNonce,
    isLoadingAdvancedSettings,
    isCoinControlChecked,
    onBlur,
    setValue,
    setAdvancedSettings,
  ]);

  useEffect(() => {
    setValue('nonce', originNonce);
  }, [originNonce, setValue]);

  useEffect(() => {
    if (currentNonce) {
      setAdvancedSettings((prev) => ({ ...prev, currentNonce }));
    }
  }, [currentNonce, setAdvancedSettings]);

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
