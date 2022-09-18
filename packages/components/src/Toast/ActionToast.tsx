/* eslint-disable object-shorthand */
import React, { FC } from 'react';

import { BaseToastProps as RNBaseToastProps } from 'react-native-toast-message';

import Box from '../Box';
import Button from '../Button';
import { useThemeValue } from '../Provider/hooks';
import { ThemeToken } from '../Provider/theme';
import { Text } from '../Typography';

type ActionToastProps = {
  bgColorToken?: ThemeToken;
  borderColorToken?: ThemeToken;
  shadowColorToken?: ThemeToken;
  textColorToken?: ThemeToken;
  buttonText?: string;
  buttonTextColorToken?: ThemeToken;
  onPress?: () => void;
};

const ActionToast: FC<ActionToastProps & RNBaseToastProps> = ({
  bgColorToken,
  borderColorToken,
  shadowColorToken,
  textColorToken,
  buttonText,
  buttonTextColorToken,
  onPress,
  text1,
  ...props
}) => {
  const [bgColor, borderColor, shadowColor, textColor, buttonTextColor] =
    useThemeValue([
      bgColorToken || 'surface-default',
      borderColorToken || bgColorToken || 'border-default',
      shadowColorToken || shadowColorToken || 'text-default',
      textColorToken || 'text-default',
      buttonTextColorToken || 'interactive-default',
    ]);

  return (
    <Box
      {...props}
      borderWidth="0.5px"
      borderRadius="12px"
      bg={bgColor}
      borderColor={borderColor}
      style={{
        shadowColor,
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 20.0,
        elevation: 8,
      }}
      py="8px"
      px="12px"
      // contentContainerProps={{
      //   style: {
      //     paddingVertical: 8,
      //     paddingHorizontal: 16,
      //     marginLeft: 0,
      //     alignSelf: 'center',
      //     maxWidth: 340,
      //   },
      // }}
    >
      <Text
        textAlign="center"
        typography="Body1"
        color={textColor}
        numberOfLines={3}
      >
        {text1}
      </Text>
      <Button type="plain" onPress={onPress}>
        {buttonText}
      </Button>
    </Box>
  );
};

export default ActionToast;
