import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  IconButton,
  Input,
  Keyboard,
  LottieView,
  Text,
  Typography,
} from '@onekeyhq/components';
import EnterPinCodeOnClassic from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-classic.json';
import EnterPinCodeOnMini from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-mini.json';
import EnterPinCodeOnPro from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-pro.json';
import EnterPinCodeOnTouch from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-touch.json';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BaseRequestView from './BaseRequest';

import type { BaseRequestViewProps } from './BaseRequest';
import type { IDeviceType } from '@onekeyfe/hd-core';

export const PINCodeMaxLength = 9;

const getEnterPinCodeAnimation = (type: IDeviceType) => {
  switch (type) {
    case 'classic':
    case 'classic1s':
      return EnterPinCodeOnClassic;
    case 'mini':
      return EnterPinCodeOnMini;
    case 'touch':
      return EnterPinCodeOnTouch;
    case 'pro':
      return EnterPinCodeOnPro;
    default:
      // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
      const checkType: never = type;
  }
};

type PinOnSoftwareViewProps = {
  onConfirm: (pin: string) => void;
  onDeviceInput: () => void;
};

const PinOnSoftwareView: FC<PinOnSoftwareViewProps> = ({
  onConfirm,
  onDeviceInput,
}) => {
  const intl = useIntl();
  const [value, setValue] = useState('');
  const [displayValue, setDisplayValue] = useState('');

  useEffect(() => {
    setDisplayValue(value.replace(/\d/g, '●'));
  }, [value]);

  return (
    <Box
      width="full"
      height="auto"
      style={{
        // @ts-ignore
        userSelect: 'none',
      }}
    >
      <Typography.Heading>
        {intl.formatMessage({ id: 'modal__enter_pin' })}
      </Typography.Heading>

      <Typography.Body2 color="text-subdued" mt="4px">
        {intl.formatMessage({ id: 'modal__enter_pin_desc' })}
      </Typography.Body2>

      <Box w="full" my={6}>
        <Input
          isReadOnly
          size="xl"
          maxLength={PINCodeMaxLength}
          type="text"
          w="100%"
          value={displayValue}
          rightElement={
            <IconButton
              onPress={() => setValue(value.slice(0, -1))}
              size="xl"
              type="plain"
              name="BackspaceOutline"
            />
          }
        />
      </Box>

      <Keyboard
        keys={['7', '8', '9', '4', '5', '6', '1', '2', '3']}
        secure
        pattern={/^[1-9]{1,9}$/}
        text={value}
        onTextChange={(text) => {
          setValue(() => text);
        }}
      />

      <Button
        mt={6}
        size="xl"
        type="primary"
        isDisabled={value.length === 0}
        onPress={() => {
          onConfirm?.(value);
        }}
      >
        {intl.formatMessage({
          id: 'action__ok',
        })}
      </Button>

      <Button type="plain" size="base" mt={3} onPress={() => onDeviceInput()}>
        {intl.formatMessage({ id: 'msg__enter_pin_on_device' })}
      </Button>
    </Box>
  );
};

type RequestPinViewProps = {
  deviceType: IDeviceType;
  onDeviceInput: boolean;
  onCancel?: () => void;
  onConfirm?: (pin: string) => void;
  onDeviceInputChange?: (onDeviceInput: boolean) => void;
} & Omit<BaseRequestViewProps, 'children'>;

const RequestPinView: FC<RequestPinViewProps> = ({
  deviceType,
  onDeviceInput,
  onCancel,
  onConfirm,
  onDeviceInputChange,
}) => {
  const intl = useIntl();

  const [innerOnDeviceInput, setInnerOnDeviceInput] = useState(onDeviceInput);

  useEffect(() => {
    onDeviceInputChange?.(innerOnDeviceInput);
  }, [innerOnDeviceInput, onDeviceInputChange]);

  const pinOnDevice = useMemo(
    () => (
      <>
        <LottieView
          source={getEnterPinCodeAnimation(deviceType)}
          autoPlay
          loop
          style={{ width: '100%' }}
        />
        <Text
          typography="DisplayMedium"
          mt={6}
          textAlign="center"
          color="text-default"
        >
          {intl.formatMessage({ id: 'modal__input_pin_code' })}
        </Text>
      </>
    ),
    [deviceType, intl],
  );

  return (
    <BaseRequestView
      onCancel={() => {
        onCancel?.();
        if (!innerOnDeviceInput) {
          appUIEventBus.emit(AppUIEventBusNames.HardwareCancel);
        }
      }}
      mobileFillWidth={!innerOnDeviceInput}
      closeWay={innerOnDeviceInput ? 'delay' : 'now'}
      borderBottomRadius={
        platformEnv.isNativeAndroid && !innerOnDeviceInput ? '0px' : '12px'
      }
    >
      {innerOnDeviceInput ? (
        pinOnDevice
      ) : (
        <PinOnSoftwareView
          onConfirm={(pin) => {
            onConfirm?.(pin);
          }}
          onDeviceInput={() => {
            setInnerOnDeviceInput?.(true);
          }}
        />
      )}
    </BaseRequestView>
  );
};

export default RequestPinView;
