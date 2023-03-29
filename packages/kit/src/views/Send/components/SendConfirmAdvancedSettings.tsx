import { memo, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

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

interface Props {
  accountId: string;
  networkId: string;
  encodedTx: any;
  advancedSettings: AdvancedSettings | undefined;
  setAdvancedSettings: React.Dispatch<React.SetStateAction<AdvancedSettings>>;
  isLoadingAdvancedSettings: boolean;
}

function SendConfirmAdvancedSettingsMemo(props: Props) {
  const { networkId, encodedTx, advancedSettings, isLoadingAdvancedSettings } =
    props;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const originNonce = String(encodedTx.nonce ?? advancedSettings?.nonce);

  const network = useNetworkSimple(networkId);

  const nonceEditable = network?.settings?.nonceEditable;

  const intl = useIntl();

  const useFormReturn = useForm<AdvancedSettings>({
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const { control, setValue } = useFormReturn;

  const { formValues } = useFormOnChangeDebounced<AdvancedSettings>({
    useFormReturn,
  });

  const currentNonce = formValues?.nonce;

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
            required: true,
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
            isDisabled={isLoadingAdvancedSettings}
            decimal={0}
            enableMaxButton
            size="xl"
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
    setValue,
  ]);

  useEffect(() => {
    setValue('nonce', originNonce);
  }, [originNonce, setValue]);

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
