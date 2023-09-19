import { useDebounce } from '../../../../hooks';
import { useUserBrowserHistories } from '../../hooks';

import { BrowserHeaderLayout } from './base';

export const BrowserShortcuts = () => {
  const histories = useUserBrowserHistories();
  const items = useDebounce(histories, 2000);
  return <BrowserHeaderLayout histories={items} />;
};
