import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Box,
  Button,
  CustomSkeleton,
  Form,
  Icon,
  Input,
  Pressable,
  Text,
  Typography,
  useForm,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import BaseMenu from '../../../../Overlay/BaseMenu';

import { AccessoryView } from './AccessoryView';
import AnimateHeight from './AnimateHeight';
import { useAccessory, validMenmonicWord } from './hooks';

import type { IBaseMenuOptions } from '../../../../Overlay/BaseMenu';

const defaultSupportWords = [12, 15, 18, 21, 24];

const skeletonDefaultArr = new Array(12).fill(0);

type NineHouseLatticeInputFormProps = {
  onSubmit: ({ text }: { text: string }) => void;
};

export const NineHouseLatticeInputForm: FC<NineHouseLatticeInputFormProps> = ({
  onSubmit,
}) => {
  const intl = useIntl();
  const {
    control,
    handleSubmit,
    setValue,
    setFocus,
    trigger,
    register,
    getValues,
  } = useForm({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });
  const [disableSubmit, setDisableSubmit] = useState(true);
  const [mnemonicoValidateShow, setMnemonicoValidateShow] = useState(false);
  const [currentWordsCount, setCurrentWordsCount] = useState(12);
  const [showRecoveryPhraseFields, setIsShowRecoveryPhraseFields] =
    useState(false);
  const [focusInputName, setFocusInputName] = useState('1');
  const defaultSupportWordsOptions: IBaseMenuOptions = useMemo(
    () =>
      defaultSupportWords.map((value) => ({
        id: 'form__str_words',
        intlValues: { 0: `${value}` },
        closeOnSelect: true,
        onPress: () => {
          setCurrentWordsCount(value);
        },
      })),
    [],
  );
  useEffect(() => {
    setTimeout(() => {
      setIsShowRecoveryPhraseFields(true);
    }, 200);
  }, []);

  const inputIndexArray = useMemo(() => {
    let length = 0;
    let resArray: number[] = [];
    while (length < currentWordsCount) {
      resArray = [...resArray, (length += 1)];
    }
    return resArray;
  }, [currentWordsCount]);

  const onClear = useCallback(() => {
    inputIndexArray.forEach((value) => {
      setValue(`${value}`, '');
    });
    setFocus(`${inputIndexArray?.[0] ?? 1}`);
  }, [inputIndexArray, setFocus, setValue]);

  const pasteHandle = useCallback(
    (e) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      let paste = e.clipboardData?.getData('text') as string;
      if (paste) {
        paste = paste.trim();
        const values = paste.split(' ');
        if (values.length > 2) {
          setTimeout(() => {
            inputIndexArray.forEach((inputIndex) => {
              setValue(`${inputIndex}`, '');
            });
            values.forEach((v, i) => {
              setValue(`${i + 1}`, v);
              trigger(`${i + 1}`);
            });
            if (values.length < inputIndexArray.length) {
              setFocus(`${values.length + 1}`);
            }
          }, 0);
        }
      }
    },
    [inputIndexArray, setFocus, setValue, trigger],
  );

  useEffect(() => {
    window.addEventListener('paste', pasteHandle);
    return () => {
      window.removeEventListener('paste', pasteHandle);
    };
  }, [pasteHandle]);

  const { onChangeText, accessoryData, setAccessoryData } = useAccessory();
  return (
    <Box flex={1}>
      <Box flexDirection="row" justifyContent="space-between" mb={4}>
        <BaseMenu options={defaultSupportWordsOptions} placement="bottom left">
          <Pressable flexDirection="row" alignItems="center">
            <Typography.Button2
              color="text-subdued"
              mr={2}
            >{`${intl.formatMessage(
              {
                id: 'form__str_words',
              },
              { 0: currentWordsCount },
            )}`}</Typography.Button2>
            <Icon color="icon-subdued" size={16} name="ChevronDownMini" />
          </Pressable>
        </BaseMenu>
        <Pressable flexDirection="row" alignItems="center" onPress={onClear}>
          <Icon color="icon-subdued" size={16} name="XCircleMini" />
          <Typography.Button2 color="text-subdued" ml={2}>
            {intl.formatMessage({ id: 'action__clear_all' })}
          </Typography.Button2>
        </Pressable>
      </Box>
      {!showRecoveryPhraseFields ? (
        <Box m="-4px" flexDirection="row" flexWrap="wrap" pb="16px">
          {skeletonDefaultArr.map(() => (
            <Box p="4px" w="1/3">
              <CustomSkeleton w="full" borderRadius="12px" h="38px" />
            </Box>
          ))}
        </Box>
      ) : (
        <Box m="-4px" pb="16px">
          <Form flexDirection="row" flexWrap="wrap">
            {inputIndexArray.map((index) => (
              <Form.Item
                name={`${index}`}
                control={control}
                rules={{
                  validate: async (t) => {
                    const valuesMap = getValues();
                    const values = Object.values(valuesMap);
                    if (values.every((v: string) => v.length > 0)) {
                      try {
                        await backgroundApiProxy.validator.validateMnemonic(
                          values.join(' '),
                        );
                        setDisableSubmit(false);
                        setMnemonicoValidateShow(false);
                      } catch (e) {
                        setDisableSubmit(true);
                        setMnemonicoValidateShow(true);
                      }
                      setAccessoryData([]);
                    } else {
                      setDisableSubmit(true);
                      setMnemonicoValidateShow(false);
                    }
                    if (typeof t === 'string') {
                      return Boolean(validMenmonicWord(t));
                    }
                  },
                  onChange: (e: {
                    target: { value: string; name: string };
                  }) => {
                    const { value } = e.target;
                    if (typeof value === 'string') {
                      if (value.trim().split(' ').length < 3) {
                        onChangeText(value);
                      }
                    }
                  },
                }}
                formControlProps={{ p: '4px', w: '1/3' }}
              >
                <Input
                  w="full"
                  autoFocus={index === 1}
                  leftElement={
                    <Text
                      typography="Body2"
                      w="24px"
                      textAlign="right"
                      color="text-subdued"
                    >
                      {index}
                    </Text>
                  }
                  backgroundColor="action-secondary-default"
                  type={
                    parseInt(focusInputName) === index ? 'text' : 'password'
                  }
                  onFocus={(e) => {
                    setFocusInputName(`${index}`);
                    const valueText = e?.nativeEvent?.text;
                    if (typeof valueText === 'string') {
                      onChangeText(valueText);
                    }
                  }}
                  {...register(`${index}`)}
                />
              </Form.Item>
            ))}
          </Form>
        </Box>
      )}
      <AnimateHeight containerTransition={{ type: 'timing', duration: 150 }}>
        <AccessoryView
          expandWords
          accessoryData={accessoryData}
          withKeybord={false}
          selected={(value) => {
            setValue(focusInputName, value);
            trigger(focusInputName);
            const focusInputNameNumber = parseInt(focusInputName);
            if (focusInputNameNumber < currentWordsCount) {
              setFocus(`${focusInputNameNumber + 1}`);
            }
          }}
        />
        {mnemonicoValidateShow && (
          <Box mt={2}>
            <Alert
              alertType="error"
              dismiss={false}
              title={intl.formatMessage({
                id: 'msg__engine__invalid_mnemonic',
              })}
            />
          </Box>
        )}
      </AnimateHeight>
      <Button
        isDisabled={disableSubmit}
        type="primary"
        mt={4}
        size="xl"
        onPromise={handleSubmit((values) => {
          const result = Object.values(values).join(' ');
          onSubmit({ text: result });
        })}
      >
        {intl.formatMessage({ id: 'action__confirm' })}
      </Button>
    </Box>
  );
};
