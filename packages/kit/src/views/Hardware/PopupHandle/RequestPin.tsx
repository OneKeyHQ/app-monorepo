import { FC, useEffect, useMemo, useState } from 'react';

import { IDeviceType } from '@onekeyfe/hd-core';
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
import EnterPinCodeOnTouch from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-touch.json';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

export const PINCodeMaxLength = 9;

const getEnterPinCodeAnimation = (type: string) => {
  switch (type) {
    case 'mini':
      return EnterPinCodeOnMini;
    case 'touch':
      return EnterPinCodeOnTouch;
    default:
      return EnterPinCodeOnClassic;
  }
};

type PinOnSoftwareViewProps = {
  onConfirm: (pin: string) => void;
};

const PinOnSoftwareView: FC<PinOnSoftwareViewProps> = ({ onConfirm }) => {
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

      <Box w="full" mt={6}>
        <Input
          isReadOnly
          maxLength={PINCodeMaxLength}
          type="text"
          rightIconName="BackspaceOutline"
          w="100%"
          value={displayValue}
          onPressRightIcon={() => setValue(value.slice(0, -1))}
        />
      </Box>

      <Box mt={6} mb={6}>
        <Typography.Body2 color="text-subdued" textAlign="center">
          {intl.formatMessage({ id: 'modal__enter_pin_desc' })}
        </Typography.Body2>
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
      onCancel={onCancel}
      mobileFillWidth={!innerOnDeviceInput}
      closeWay={innerOnDeviceInput ? 'delay' : 'now'}
    >
      {innerOnDeviceInput ? (
        pinOnDevice
      ) : (
        <PinOnSoftwareView
          onConfirm={(pin) => {
            onConfirm?.(pin);
          }}
        />
      )}

      {!innerOnDeviceInput && (
        <IconButton
          onPress={() => {
            setInnerOnDeviceInput?.(true);
          }}
          position="absolute"
          top={2}
          right={12}
          size="lg"
          type="plain"
          name="DeviceTabletSolid"
        />
      )}
    </BaseRequestView>
  );
};

export default RequestPinView;
