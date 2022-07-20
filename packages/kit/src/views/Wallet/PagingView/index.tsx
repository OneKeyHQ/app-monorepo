import React, { FC } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import Desktop from './Container/Desktop';
import Mobile from './Container/Mobile';
import { PageViewProps } from './type';

const PagingView: FC<PageViewProps> = ({ ...props }) => {
  const Contrainer =
    platformEnv.isWeb || platformEnv.isNativeIOSPad ? Desktop : Mobile;
  return <Contrainer {...props} />;
};

export default PagingView;
