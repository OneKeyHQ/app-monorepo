import { memo, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import BigNumber from 'bignumber.js';

import {
  Button,
  Collapse,
  Form,
  HStack,
  Icon,
  Pressable,
  Text,
  Tooltip,
  useForm,
} from '@onekeyhq/components';

import { useNetworkSimple } from '../../../hooks';
import { useFormOnChangeDebounced } from '../../../hooks/useFormOnChangeDebounced';

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

  const advanceSettings = useMemo(() => {
    const setttings = [];

    if (nonceEditable && originNonce !== '') {
      const isEditNonceDisabled = originNonce === currentNonce;
      setttings.push(
        <Form.Item
          name="nonce"
          label={
            <HStack alignItems="center" space={1}>
              <Text typography="Body2Strong">
                {intl.formatMessage({ id: 'form__nonce' })}
              </Text>
              <Tooltip
                hasArrow
                maxW="260px"
                placement="top left"
                label={intl.formatMessage({
                  id: 'content__what_is_nonce_desc',
                })}
              >
                <Pressable>
                  <Icon
                    name="QuestionMarkCircleMini"
                    size={16}
                    color="icon-subdued"
                  />
                </Pressable>
              </Tooltip>
            </HStack>
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

    return setttings;
  }, [
    nonceEditable,
    originNonce,
    currentNonce,
    intl,
    control,
    isLoadingAdvancedSettings,
    onBlur,
    setValue,
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
        <Form mt={6} textAlign="left">
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
