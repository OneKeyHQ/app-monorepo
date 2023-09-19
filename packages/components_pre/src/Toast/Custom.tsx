/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { ComponentProps, FC } from 'react';

import Toast from 'react-native-toast-message';

import BaseToast from './BaseToast';

type Props = ComponentProps<typeof Toast>;

const CustomToast: FC<Props> = (outerProps) => (
  <Toast
    config={{
      default: (props) => (
        <BaseToast
          {...props}
          bgColorToken="surface-neutral-default"
          borderColorToken="border-default"
          shadowColorToken="text-default"
          textColorToken="text-default"
        />
      ),
      success: (props) => (
        <BaseToast
          {...props}
          bgColorToken="interactive-default"
          textColorToken="text-on-primary"
        />
      ),
      error: (props) => (
        <BaseToast
          {...props}
          bgColorToken="action-critical-default"
          textColorToken="text-on-critical"
        />
      ),
    }}
    {...outerProps}
  />
);

export default CustomToast;
