/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { FC } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { SectionDataType } from '../../type';

let CardViewImpl: any;

if (platformEnv.isNative) {
  CardViewImpl = require('./Mobile').Mobile;
} else {
  CardViewImpl = require('./Unknown').Unknown;
}

export default CardViewImpl as FC<SectionDataType>;
