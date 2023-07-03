import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';

import InscriptionImage from './InscriptionImage';
import { InscriptionLarge, InscriptionText } from './InscriptionText';
import InscriptionUnknow from './InscriptionUnknow';

import type { InscriptionContentProps } from '../type';

export enum InscriptionContentType {
  Text = 'text/plain',
  ImagePNG = 'image/png',
  ImageGIF = 'image/gif',
  HTML = 'text/html',
}

function ComponentWithContentType(
  contentType: string,
  isList: boolean,
): (props: InscriptionContentProps) => JSX.Element | null {
  if (contentType.startsWith(InscriptionContentType.ImagePNG)) {
    return InscriptionImage;
  }
  if (contentType.startsWith(InscriptionContentType.Text)) {
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
