import type { FC } from 'react';

import Box from '../Box';

const KeyboardDismissView: FC = ({ children, ...props }) => (
  <Box testID="KeyboardDismissView-web" w="full" h="full" {...props}>
    {children}
  </Box>
);

export default KeyboardDismissView;
