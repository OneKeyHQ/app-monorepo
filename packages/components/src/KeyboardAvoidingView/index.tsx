import type { ComponentProps, FC } from 'react';

import { KeyboardAvoidingView as BaseKAV } from 'native-base';
import { Platform } from 'react-native';

const KeyboardAvoidingView: FC<ComponentProps<typeof BaseKAV>> = (props) => (
  <BaseKAV
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    {...props}
  />
);

export default KeyboardAvoidingView;
