import React, { ComponentProps, FC } from 'react';

import { TextStyle } from 'react-native';
import Toast, { BaseToast } from 'react-native-toast-message';

import { useThemeValue } from '../Provider/hooks';
import { Body1Props } from '../Typography';

type Props = ComponentProps<typeof Toast>;

const CustomToast: FC<Props> = (outerProps) => {
  const [backgroundColor, fontColor, borderColor, borderLeftColor] =
    useThemeValue([
      'surface-neutral-default',
      'text-default',
      'border-default',
      'border-default',
    ]);
  return (
    <Toast
      bottomOffset={50}
      config={{
        default: (props) => (
          <BaseToast
            {...props}
            style={{
              alignSelf: 'center',
              width: 'auto',
              height: 'auto',
              marginLeft: 0,
              backgroundColor,
              borderRadius: 12,
              borderWidth: 0.5,
              borderLeftWidth: 0.5,
              borderColor,
              borderLeftColor,
              // replace the code below with shadow token 'depth.4' in the future, i don't know how – franco
              shadowColor: '#000',
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
                paddingHorizontal: 12,
                marginLeft: 0,
                alignSelf: 'center',
              },
            }}
            text1Style={
              { ...Body1Props, color: fontColor, marginBottom: 0 } as TextStyle
            }
          />
        ),
      }}
      {...outerProps}
    />
  );
};

export default CustomToast;
