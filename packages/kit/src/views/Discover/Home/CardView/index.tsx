/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { FC } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { SectionDataType } from '../../type';

let CardViewImpl: any;

if (platformEnv.isNative) {
  CardViewImpl = require('./Mobile').Mobile;
} else {
  CardViewImpl = require('./Unknown').Unknown;
}

const CardView: FC<SectionDataType> = ({ ...rest }) => (
  <CardViewImpl {...rest} />
);

export default CardView;
