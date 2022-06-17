/* eslint-disable object-shorthand */
import React, { FC } from 'react';

import { StyleSheet, TextStyle } from 'react-native';
import {
  BaseToastProps as RNBaseToastProps,
  BaseToast as RNToast,
} from 'react-native-toast-message';

import { useThemeValue } from '../Provider/hooks';
import { ThemeToken } from '../Provider/theme';
import { Body1Props } from '../Typography';

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
  const [bgColor, borderColor, shaodwColor, textColor] = useThemeValue([
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
        borderRadius: 9999,
        borderWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderColor: borderColor,
        borderLeftColor: borderColor,
        shadowColor: shaodwColor,
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
          marginBottom: 0,
        } as TextStyle
      }
    />
  );
};

export default BaseToast;
