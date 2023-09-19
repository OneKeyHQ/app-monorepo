import type { FC } from 'react';

import { StyleSheet } from 'react-native';
import { BaseToast as RNToast } from 'react-native-toast-message';

import { useThemeValue } from '@onekeyhq/components';

import { Body1Props } from '../Typography';

import type { ThemeToken } from '../Provider/theme';
import type { TextStyle } from 'react-native';
import type { BaseToastProps as RNBaseToastProps } from 'react-native-toast-message';

type BaseToastProps = {
  bgColorToken?: ThemeToken;
  borderColorToken?: ThemeToken;
  shadowColorToken?: ThemeToken;
  textColorToken?: ThemeToken;
};

const BaseToast: FC<BaseToastProps & RNBaseToastProps> = ({
  bgColorToken,
  borderColorToken,
  shadowColorToken,
  textColorToken,
  ...props
}) => {
  const [bgColor, borderColor, shadowColor, textColor] = useThemeValue([
    bgColorToken || 'surface-neutral-default',
    borderColorToken || bgColorToken || 'border-default',
    shadowColorToken || shadowColorToken || 'text-default',
    textColorToken || 'text-default',
  ]);

  return (
    <RNToast
      {...props}
      style={{
        alignSelf: 'center',
        width: 'auto',
        height: 'auto',
        marginLeft: 0,
        backgroundColor: bgColor,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderColor,
        borderLeftColor: borderColor,
        shadowColor,
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.15,
        shadowRadius: 20.0,
        elevation: 8,
      }}
      contentContainerProps={{
        style: {
          paddingVertical: 8,
          paddingHorizontal: 16,
          marginLeft: 0,
          alignSelf: 'center',
          maxWidth: 340,
        },
      }}
      text1NumberOfLines={3}
      text1Style={
        {
          ...Body1Props,
          color: textColor,
          textAlign: 'center',
          marginBottom: 0,
        } as TextStyle
      }
    />
  );
};

export default BaseToast;
