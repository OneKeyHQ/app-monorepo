import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';

import { HeaderRight } from './HeaderRight';
import { HeaderLeft } from './HedaerLeft';

import type { ITabPageHeaderProp } from './type';

export function TabPageHeader({ sceneName }: ITabPageHeaderProp) {
  const renderHeaderLeft = useCallback(
    () => <HeaderLeft sceneName={sceneName} />,
    [sceneName],
  );

  return (
    <Page.Header headerLeft={renderHeaderLeft} headerRight={HeaderRight} />
  );
}
