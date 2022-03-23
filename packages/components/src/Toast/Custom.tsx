import React, { ComponentProps, FC } from 'react';

import { TextStyle } from 'react-native';
import Toast, { BaseToast } from 'react-native-toast-message';

import { useThemeValue } from '../Provider/hooks';
import { Body1Props } from '../Typography';

type Props = ComponentProps<typeof Toast>;

const CustomToast: FC<Props> = (outerProps) => {
  const [backgroundColor, fontColor] = useThemeValue([
    'text-default',
    'surface-default',
  ]);
  return (
    <Toast
      bottomOffset={60}
      config={{
        default: (props) => (
          <BaseToast
            {...props}
            style={{
              borderLeftColor: 'transparent',
              width: 'auto',
              height: 'auto',
              alignSelf: 'center',
              borderRadius: 12,
              backgroundColor,
            }}
            contentContainerProps={{
              style: {
                padding: 8,
                paddingHorizontal: 8,
                alignSelf: 'center',
              },
            }}
            text1Style={{ ...Body1Props, color: fontColor } as TextStyle}
          />
        ),
      }}
      {...outerProps}
    />
  );
};

export default CustomToast;
