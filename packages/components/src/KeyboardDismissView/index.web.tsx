import { FC } from 'react';

import { View } from 'native-base';

export const KeyboardDismissView: FC = ({ children }) => (
  <View w="full" h="full">
    {children}
  </View>
);

export default KeyboardDismissView;
