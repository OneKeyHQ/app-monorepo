import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Form,
  Icon,
  Input,
  Pressable,
  Typography,
  useForm,
  useIsVerticalLayout,
  useUserDevice,
} from '@onekeyhq/components';

import BaseMenu from '../../../../Overlay/BaseMenu';

import { AccessoryView } from './AccessoryView';
import { useAccessory, validMenmonicWord } from './hooks';

import type { IBaseMenuOptions } from '../../../../Overlay/BaseMenu';

const defaultSupportWords = [12, 15, 18, 21, 24];

export const NineHouseLatticeInputForm: FC = () => {
  console.log('NineHouseLatticeInputForm');
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
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
  const { screenWidth } = useUserDevice();
  const [currentWordsCount, setCurrentWordsCount] = useState(12);
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
  const inputIndexArray = useMemo(() => {
    let length = 0;
    let resArray: number[] = [];
    while (length < currentWordsCount) {
      resArray = [...resArray, (length += 1)];
    }
    return resArray;
  }, [currentWordsCount]);
  const inputW = useMemo(() => {
    if (isVertical) {
      return Math.floor((screenWidth - 24 * 2 - 16) / 3);
    }
    return 128; // (400 - 8*2) / 3
  }, [isVertical, screenWidth]);

  const onClear = useCallback(() => {
    inputIndexArray.forEach((value) => {
      setValue(`${value}`, '');
    });
    setFocus(`${inputIndexArray?.[0] ?? 1}`);
  }, [inputIndexArray, setFocus, setValue]);

  const { onChangeText, accessoryData } = useAccessory();
  return (
    <Box flex={1}>
      <Box flexDirection="row" justifyContent="space-between">
        <BaseMenu options={defaultSupportWordsOptions}>
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
            Clear
          </Typography.Button2>
        </Pressable>
      </Box>
      <Form flexDirection="row" flexWrap="wrap" mt={4}>
        {inputIndexArray.map((index) => (
          <Form.Item
            name={`${index}`}
            control={control}
            rules={{
              validate: (t) => {
                console.log('t---', t);
                // todo
                const values = getValues();
                if (typeof t === 'string') {
                  return Boolean(validMenmonicWord(t));
                }
              },
              onChange: (e: { target: { value: string; name: string } }) => {
                const { value } = e.target;
                if (typeof value === 'string') {
                  onChangeText(value);
                }
              },
            }}
            formControlProps={{
              w: inputW,
              h: '38px',
              ml: index % 3 === 1 ? 0 : 2,
              mb: 2,
            }}
          >
            <Input
              flex={1}
              w="full"
              autoFocus={index === 1}
              leftText={`${index}`}
              backgroundColor="action-secondary-default"
              type={parseInt(focusInputName) === index ? 'text' : 'password'}
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
      {(accessoryData && accessoryData.length > 0) || !accessoryData ? (
        <Box h="44px" mt={2} mb={4} w="full">
          <AccessoryView
            boxProps={{
              position: 'relative',
              display: 'flex',
              flex: 1,
              borderRadius: '12px',
            }}
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
        </Box>
      ) : null}

      <Button
        isDisabled
        type="primary"
        mt={2}
        size={isVertical ? 'xl' : 'lg'}
        onPromise={handleSubmit((values) => {
          console.log('sub--values', values);
        })}
      >
        {intl.formatMessage({ id: 'action__confirm' })}
      </Button>
    </Box>
  );
};
