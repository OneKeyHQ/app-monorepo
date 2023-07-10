import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';

import InscriptionImage from './InscriptionImage';
import { InscriptionLarge, InscriptionText } from './InscriptionText';
import InscriptionUnknow from './InscriptionUnknow';

import type { InscriptionContentProps } from '../type';

export enum InscriptionContentType {
  Text = 'text/plain;charset=utf-8',
  ImagePNG = 'image/png',
  ImageJEPG = 'image/jepg',
  ImageGIF = 'image/gif',
  HTML = 'text/html',
}

function ComponentWithContentType(
  contentType: string,
  isList: boolean,
): (props: InscriptionContentProps) => JSX.Element | null {
  if (
    contentType.startsWith(InscriptionContentType.ImagePNG) ||
    contentType.startsWith(InscriptionContentType.ImageJEPG)
  ) {
    return InscriptionImage;
  }
  if (contentType === InscriptionContentType.Text) {
    return isList ? InscriptionText : InscriptionLarge;
  }
  return InscriptionUnknow;
}

export function getBTCListComponent(props: {
  data: NFTBTCAssetModel;
  isList: boolean;
}): {
  Component: (props: InscriptionContentProps) => JSX.Element | null;
} {
  const { data, isList } = props;
  return { Component: ComponentWithContentType(data.content_type, isList) };
}
