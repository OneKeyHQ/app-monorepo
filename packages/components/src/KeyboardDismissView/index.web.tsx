import { FC } from 'react';

import { View } from 'native-base';

const KeyboardDismissView: FC = ({ children, ...props }) => (
  <View w="full" h="full" {...props}>
    {children}
  </View>
);

export default KeyboardDismissView;
