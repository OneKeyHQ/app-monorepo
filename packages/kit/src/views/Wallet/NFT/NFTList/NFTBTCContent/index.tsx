import type { FC } from 'react';

import { getBTCListComponent } from './getBTCListComponent';

import type { InscriptionContentProps } from '../type';

const NFTBTCContent: FC<InscriptionContentProps> = ({ asset, ...props }) => {
  const { Component } = getBTCListComponent({ data: asset, isList: true });
  return <Component asset={asset} {...props} />;
};

export default NFTBTCContent;
