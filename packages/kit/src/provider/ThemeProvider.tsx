import type { ComponentProps, FC } from 'react';
import { memo } from 'react';

import { Provider } from '@onekeyhq/components';

const ThemeApp: FC = ({ children }) => (
  <Provider themeVariant="light">{children}</Provider>
);

export default memo<ComponentProps<typeof ThemeApp>>(ThemeApp);
