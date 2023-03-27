import type { Dispatch, SetStateAction } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Form,
  KeyboardDismissView,
  Pressable,
  RadioButton,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import showDerivationPathBottomSheetModal from '@onekeyhq/kit/src/components/NetworkAccountSelector/modals/NetworkAccountSelectorModal/DerivationPathBottomSheetModal';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useDerivationPath } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';

import { formatDerivationLabel } from './helper';

import type { IDerivationOption } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';

const GenerateCount = [10, 50, 100];
export const FROM_INDEX_MAX = 2 ** 31;

type FromValues = {
  derivationType: string;
  fromIndex: string;
  generateCount?: string;
};

type IProps = {
  walletId?: string;
  networkId: string;
  template?: string;
  setButtonDisabled: Dispatch<SetStateAction<boolean>>;
};
export type ISetRangeReturnType = {
  derivationOption: IDerivationOption | undefined;
  derivationType: string;
  fromIndex: string;
  generateCount?: string | undefined;
};
export type ISetRangeRefType = {
  onSubmit: () => Promise<false | ISetRangeReturnType>;
};

const SetRange = forwardRef<ISetRangeRefType, IProps>(
  ({ walletId, networkId, template, setButtonDisabled }, ref) => {
    const isSmallScreen = useIsVerticalLayout();
    const intl = useIntl();
    const {
      control,
      handleSubmit,
      setError,
      setValue,
      getValues,
      formState: { isValid },
    } = useForm<FromValues>({
      defaultValues: {
        derivationType: 'default',
        fromIndex: '1',
        generateCount: '10',
      },
      mode: 'onChange',
    });
    const { derivationOptions } = useDerivationPath(walletId, networkId);
    const [selectedOption, setSelectedOption] = useState<IDerivationOption>();

    // set default derivation option
    useEffect(() => {
      if (!derivationOptions) {
        return;
      }
      const defaultOption = derivationOptions.find((item) => {
        if (template) {
          return item.template === template;
        }
        return item.key === 'default';
      });
      if (defaultOption) {
        setSelectedOption(defaultOption);
      }
    }, [derivationOptions, template]);

    const value = useMemo(() => {
      let label: IDerivationOption['label'];
      if (selectedOption) {
        label = selectedOption.label;
      } else {
        label =
          (derivationOptions ?? []).find((item) => item.key === 'default')
            ?.label || '';
      }
      return formatDerivationLabel(intl, label);
    }, [selectedOption, derivationOptions, intl]);

    useEffect(() => {
      setValue('derivationType', value ?? '');
    }, [value, setValue]);

    const onPress = useCallback(() => {
      showDerivationPathBottomSheetModal({
        type: 'search',
        walletId: walletId ?? '',
        networkId,
        onSelect: (option) => setSelectedOption(option),
      });
    }, [walletId, networkId]);

    const isInteger = (val: any) => {
      let amount = 0;
      if (typeof val === 'string') {
        try {
          amount = parseInt(val);
        } catch (error) {
          return false;
        }
      }

      return (
        typeof amount === 'number' &&
        Number.isFinite(amount) &&
        Math.floor(amount) === amount
      );
    };

    const validateFromIndexTooLarge = useCallback(
      (val: any) => {
        const { generateCount: count } = getValues();
        if (isInteger(val) && isInteger(count)) {
          return {
            max: FROM_INDEX_MAX - parseInt(count ?? '10'),
            error: new BigNumber(val)
              .plus(count ?? '10')
              .isGreaterThan(FROM_INDEX_MAX),
          };
        }
      },
      [getValues],
    );

    useEffect(() => {
      setButtonDisabled(!isValid);
    }, [isValid, setButtonDisabled]);

    const GenerateCountButton = useMemo(
      () => (
        <>
          {GenerateCount.map((item, index) => (
            <Box key={`box-${item}`} alignItems="center" flexDirection="row">
              <RadioButton
                size="sm"
                value="true"
                onPress={() => {
                  setValue('generateCount', `${item}`, {
                    shouldValidate: true,
                  });
                }}
                title={item.toString()}
              />
              {index !== GenerateCount.length - 1 && (
                <Divider orientation="vertical" h={5} ml={1} mr={1} />
              )}
            </Box>
          ))}
          <Box w={1} />
        </>
      ),
      [setValue],
    );

    const onSubmit = useCallback<ISetRangeRefType['onSubmit']>(
      () =>
        new Promise((resolve) => {
          handleSubmit(
            (data: FromValues) => {
              const res = validateFromIndexTooLarge(data.fromIndex);
              if (res?.error) {
                setError(
                  'fromIndex',
                  {
                    message: intl.formatMessage(
                      {
                        id: 'form__field_too_large',
                      },
                      {
                        0: res?.max,
                      },
                    ),
                  },
                  {
                    shouldFocus: true,
                  },
                );
                resolve(false);
              }
              resolve({
                ...data,
                derivationOption: selectedOption,
              });
            },
            () => resolve(false),
          )();
        }),
      [validateFromIndexTooLarge, intl, setError, selectedOption, handleSubmit],
    );

    useImperativeHandle(
      ref,
      () => ({
        onSubmit,
      }),
      [onSubmit],
    );

    return (
      <KeyboardDismissView>
        <Form w="full" mb="26px">
          {derivationOptions.length > 1 && (
            <Pressable onPress={onPress}>
              <Form.Item name="derivationType" control={control}>
                <Form.Input
                  size={isSmallScreen ? 'xl' : 'default'}
                  rightIconName="ChevronDownMini"
                  isReadOnly
                  onPressRightIcon={onPress}
                  onPressIn={platformEnv.isNativeIOS ? onPress : undefined}
                />
              </Form.Item>
            </Pressable>
          )}
          <Form.Item
            name="fromIndex"
            control={control}
            label={intl.formatMessage({
              id: 'form__from',
              defaultMessage: 'From',
            })}
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: 'form__field_is_required',
                }),
              },
              min: {
                value: 1,
                message: intl.formatMessage(
                  {
                    id: 'form__field_too_small',
                  },
                  {
                    0: 1,
                  },
                ),
              },
              pattern: {
                value: /^[0-9]*$/,
                message: intl.formatMessage({
                  id: 'form__field_only_integer',
                }),
              },
              validate: (val) => {
                if (!isInteger(val)) {
                  return intl.formatMessage({
                    id: 'form__field_is_required',
                  });
                }
                if (typeof val !== 'boolean') {
                  const res = validateFromIndexTooLarge(val);
                  if (res?.error) {
                    return intl.formatMessage(
                      {
                        id: 'form__field_too_large',
                      },
                      {
                        0: res?.max,
                      },
                    );
                  }
                }
              },
            }}
          >
            <Form.Input
              type="number"
              keyboardType="number-pad"
              size={isSmallScreen ? 'xl' : 'default'}
            />
          </Form.Item>
          <Form.Item
            name="generateCount"
            control={control}
            label={intl.formatMessage({
              id: 'form__generate_amount',
              defaultMessage: 'Generate Amount',
            })}
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: 'form__field_is_required',
                }),
              },
              min: {
                value: 1,
                message: intl.formatMessage(
                  {
                    id: 'form__field_too_small',
                  },
                  {
                    0: 1,
                  },
                ),
              },
              max: {
                value: 100,
                message: intl.formatMessage(
                  {
                    id: 'form__field_too_large',
                  },
                  {
                    0: 100,
                  },
                ),
              },
              pattern: {
                value: /^[0-9]*$/,
                message: intl.formatMessage({
                  id: 'form__field_only_integer',
                }),
              },
            }}
          >
            <Form.Input
              type="number"
              keyboardType="number-pad"
              size={isSmallScreen ? 'xl' : 'default'}
              rightCustomElement={GenerateCountButton}
            />
          </Form.Item>
        </Form>
      </KeyboardDismissView>
    );
  },
);

SetRange.displayName = 'SetRange';

export default SetRange;
