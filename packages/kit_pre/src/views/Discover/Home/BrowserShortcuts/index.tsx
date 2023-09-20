import { useUserBrowserHistories } from '../../hooks';

import { BrowserHeaderLayout } from './base';

export const BrowserShortcuts = () => {
  const histories = useUserBrowserHistories();
  return <BrowserHeaderLayout histories={histories} />;
};
