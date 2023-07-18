import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import InscriptionImage from './InscriptionImage';
import InscriptionSVG from './InscriptionSVG';
import { InscriptionLarge, InscriptionText } from './InscriptionText';
import InscriptionUnknow from './InscriptionUnknow';

import type { InscriptionContentProps } from '../type';

export enum InscriptionContentType {
  Text = 'text/plain;charset=utf-8',
  ImagePNG = 'image/png',
  ImageJEPG = 'image/jpeg',
  ImageWEBP = 'image/webp',
  ImageSVG = 'image/svg+xml',
  ImageGIF = 'image/gif',
  HTML = 'text/html',
}

function ComponentWithContentType({
  contentType,
  isList,
  networkId,
}: {
  contentType: string;
  isList: boolean;
  networkId?: string;
}): (props: InscriptionContentProps) => JSX.Element | null {
  if (
    contentType.startsWith(InscriptionContentType.ImagePNG) ||
    contentType.startsWith(InscriptionContentType.ImageJEPG) ||
    contentType.startsWith(InscriptionContentType.ImageWEBP)
  ) {
    return InscriptionImage;
  }
  if (contentType.startsWith(InscriptionContentType.ImageSVG)) {
    return !platformEnv.isNative ? InscriptionSVG : InscriptionUnknow;
  }
  if (contentType === InscriptionContentType.Text) {
    if (networkId === OnekeyNetwork.tbtc) {
      return InscriptionUnknow;
    }
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
  return {
    Component: ComponentWithContentType({
      contentType: data.content_type,
      isList,
      networkId: data.networkId,
    }),
  };
}
