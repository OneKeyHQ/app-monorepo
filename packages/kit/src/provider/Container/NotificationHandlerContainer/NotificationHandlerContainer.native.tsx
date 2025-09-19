import { useRef } from 'react';

import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

import { useInitialNotification } from './hooks';

export const NotificationHandlerContainer = () => {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;

  useInitialNotification(activeAccountRef);
  return null;
};
