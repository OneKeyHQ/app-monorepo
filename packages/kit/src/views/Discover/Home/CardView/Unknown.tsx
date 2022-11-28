import { FC } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import { SectionDataType } from '../../type';

import { Desktop } from './Desktop';
import { Mobile } from './Mobile';

export const Unknown: FC<SectionDataType> = ({ ...rest }) => {
  const isSmall = useIsVerticalLayout();
  return isSmall ? <Mobile {...rest} /> : <Desktop {...rest} />;
};
