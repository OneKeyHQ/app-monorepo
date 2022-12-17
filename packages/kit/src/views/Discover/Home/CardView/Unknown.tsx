/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { FC } from 'react';

import { useIsVerticalLayout } from '@onekeyhq/components';

import type { SectionDataType } from '../../type';

let Mobile: any;
let Desktop: any;

export const Unknown: FC<SectionDataType> = ({ ...rest }) => {
  const isSmall = useIsVerticalLayout();
  if (isSmall && !Mobile) {
    Mobile = require('./Mobile').Mobile;
  } else if (!isSmall && !Desktop) {
    Desktop = require('./Desktop').Desktop;
  }
  return isSmall ? <Mobile {...rest} /> : <Desktop {...rest} />;
};
