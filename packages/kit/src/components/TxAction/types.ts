import type { ComponentProps } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import type { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';

import type { ListItem } from '../ListItem';

export type ITxActionProps = {
  action: IDecodedTxAction;
  decodedTx: IDecodedTx;
  tableLayout?: boolean;
  componentProps?: ComponentProps<typeof ListItem>;
  nativeTokenTransferAmountToUpdate?: string;
  showIcon?: boolean;
};

export type ITxActionComponents = {
  [ETxActionComponentType.ListView]: (
    props: ITxActionProps,
  ) => JSX.Element | null;
  [ETxActionComponentType.DetailView]: (
    props: ITxActionProps,
  ) => JSX.Element | null;
};

export type ITxActionCommonListViewProps = {
  avatar: {
    isNFT?: boolean;
    src: string | string[];
    fallbackIcon?: IKeyOfIcons;
  };
  title: string;
  fee?: string;
  feeFiatValue?: string;
  feeSymbol?: string;
  description?: {
    prefix?: string;
    icon?: IKeyOfIcons;
    children?: string;
  };
  change?: React.ReactNode;
  changeDescription?: React.ReactNode;
  timestamp?: number;
  pending?: boolean;
  tableLayout?: boolean;
  showIcon?: boolean;
};

export type ITxActionCommonDetailViewProps = {
  overview: {
    avatar?: {
      isNFT?: boolean;
      src?: string;
      fallbackIcon?: IKeyOfIcons;
    };
    title?: string;
    content: string;
  };
  target?: {
    title?: string;
    content: string;
  };
  source?: {
    title?: string;
    content: string;
  };
};
