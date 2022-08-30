import { FC, useEffect, useMemo, useState } from 'react';

import { IDeviceType } from '@onekeyfe/hd-core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Image,
  Input,
  Keyboard,
  LottieView,
  Pressable,
  Text,
  Typography,
} from '@onekeyhq/components';
import ClassicDeviceIcon from '@onekeyhq/components/img/deviceIcon_classic.png';
import MiniDeviceIcon from '@onekeyhq/components/img/deviceIcon_mini.png';
import TouchDeviceIcon from '@onekeyhq/components/img/deviceicon_touch.png';
import EnterPinCodeOnClassic from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-classic.json';
import EnterPinCodeOnMini from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-mini.json';
import EnterPinCodeOnPro from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-pro.json';
import EnterPinCodeOnTouch from '@onekeyhq/kit/assets/animations/enter-pin-code-on-onekey-touch.json';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import BaseRequestView, { BaseRequestViewProps } from './BaseRequest';

export const PINCodeMaxLength = 9;

const getEnterPinCodeAnimation = (type: IDeviceType) => {
  switch (type) {
    case 'classic':
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

const DEVICE_ICON = {
  'classic': ClassicDeviceIcon,
  'mini': MiniDeviceIcon,
  'touch': TouchDeviceIcon,
  // TODO
  'pro': null,
};

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
        />
      )}

      {!innerOnDeviceInput && (
        <Pressable
          onPress={() => {
            setInnerOnDeviceInput?.(true);
          }}
          position="absolute"
          top={2}
          right={12}
          justifyContent="center"
          alignItems="center"
          _hover={{ bgColor: 'surface-hovered' }}
          _pressed={{ bgColor: 'surface-pressed' }}
          width="40px"
          height="40px"
          mr="8px"
          borderRadius="12px"
        >
          <Image source={DEVICE_ICON[deviceType]} width="16px" height="24px" />
        </Pressable>
      )}
    </BaseRequestView>
  );
};

export default RequestPinView;
