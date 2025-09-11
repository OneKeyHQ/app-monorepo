import type { RefObject } from 'react';

import type { IAccountSelectorActiveAccountInfo } from '../../../states/jotai/contexts/accountSelector';

export const useInitialNotification = (
  _: RefObject<IAccountSelectorActiveAccountInfo>,
) => {};
