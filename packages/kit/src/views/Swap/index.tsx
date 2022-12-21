import { useIsVerticalLayout } from '@onekeyhq/components';

import { Desktop } from './Desktop';
import { Mobile } from './Mobile';

const Swap = () => {
  const isSmall = useIsVerticalLayout();
  return isSmall ? <Mobile /> : <Desktop />;
};

export default Swap;
