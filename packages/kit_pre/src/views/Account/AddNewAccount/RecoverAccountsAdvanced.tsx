import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Divider,
  Form,
  KeyboardDismissView,
  Modal,
  RadioButton,
  Text,
  Token,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';

import { useNetwork } from '../../../hooks';

import type { CreateAccountModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoverAccountsAdvanced
>;

type NavigationProps = NativeStackNavigationProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.RecoverAccountsAdvanced
>;

// type number does not work properly on Android
type FromValues = {
  fromIndex: string;
  generateCount?: string;
};

export const FROM_INDEX_MAX = 2 ** 31 - 1;

const ModalHeader: FC<{ networkId: string | undefined }> = ({ networkId }) => {
  const { network } = useNetwork({ networkId });
  return (
    <Box>
      <Token
        size={4}
        showInfo
        showName
        showTokenVerifiedIcon={false}
        token={{ name: network?.name, logoURI: network?.logoURI }}
        nameProps={{
          typography: { sm: 'Caption', md: 'Caption' },
          color: 'text-subdued',
          ml: '-6px',
        }}
      />
    </Box>
  );
};

const RecoverAccountsAdvanced: FC = () => {
  const isSmallScreen = useIsVerticalLayout();

  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps>();
  const { fromIndex, generateCount, onApply, networkId } = route.params;

  const [configGenerateCount] = useState([10, 50, 100]);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { isValid },
  } = useForm<FromValues>({
    defaultValues: {
      fromIndex: `${fromIndex}`,
      generateCount: generateCount ? `${generateCount}` : `10`,
    },
    mode: 'onChange',
  });

  const isInteger = (value: any) => {
    let amount = 0;
    if (typeof value === 'string') {
      try {
        amount = parseInt(value);
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
    (value: any) => {
      const { generateCount: count } = getValues();
      if (isInteger(value) && isInteger(count)) {
        return {
          max: FROM_INDEX_MAX - parseInt(count ?? '10'),
          error: new BigNumber(value)
            .plus(count ?? '10')
            .isGreaterThan(FROM_INDEX_MAX),
        };
      }
    },
    [getValues],
  );

  const onSubmit = useCallback(
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
        return;
      }
      if (navigation?.canGoBack?.()) {
        navigation.goBack();
      }
      onApply?.({
        fromIndex: parseInt(`${data.fromIndex}`),
        generateCount: data.generateCount
          ? parseInt(`${data.generateCount}`)
          : undefined,
      });
    },
    [intl, navigation, onApply, setError, validateFromIndexTooLarge],
  );

  const generateCountButton = useMemo(
    () => (
      <>
        {configGenerateCount.map((item, index) => (
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
            {index !== configGenerateCount.length - 1 && (
              <Divider orientation="vertical" h={5} ml={1} mr={1} />
            )}
          </Box>
        ))}
        <Box w={1} />
      </>
    ),
    [configGenerateCount, setValue],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__bulk_add' })}
      headerDescription={<ModalHeader networkId={networkId} />}
      primaryActionProps={{
        onPromise: handleSubmit(onSubmit),
        isDisabled: !isValid,
      }}
      primaryActionTranslationId="action__preview"
      hideSecondaryAction
    >
      <KeyboardDismissView>
        <Form>
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
              validate: (value) => {
                if (!isInteger(value)) {
                  return intl.formatMessage({
                    id: 'form__field_is_required',
                  });
                }
                if (typeof value !== 'boolean') {
                  // TODO: Distinguish between coin
                  const res = validateFromIndexTooLarge(value);
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
              rightCustomElement={generateCountButton}
            />
          </Form.Item>
          <Text
            typography={{ sm: 'Body2', md: 'Body2' }}
            color="text-subdued"
            mt="-20px"
          >
            {intl.formatMessage(
              { id: 'msg__up_to_str_can_be_generated_at_a_time' },
              { 0: 100 },
            )}
          </Text>
        </Form>
      </KeyboardDismissView>
    </Modal>
  );
};

export default RecoverAccountsAdvanced;
