import type { ComponentProps } from 'react';

import type { IKeyOfIcons } from '@onekeyhq/components';
import type { ETxActionComponentType } from '@onekeyhq/shared/types';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';
import type {
  EDecodedTxStatus,
  EReplaceTxType,
  IDecodedTx,
  IDecodedTxAction,
} from '@onekeyhq/shared/types/tx';

import type { ListItem } from '../ListItem';

export type ITxActionProps = {
  action: IDecodedTxAction;
  decodedTx: IDecodedTx;
  tableLayout?: boolean;
  componentProps?: ComponentProps<typeof ListItem>;
  isSendNativeToken?: boolean;
  nativeTokenTransferAmountToUpdate?: string;
  showIcon?: boolean;
  replaceType?: EReplaceTxType;
  swapInfo?: ISwapTxInfo;
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
  status: EDecodedTxStatus;
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
  tableLayout?: boolean;
  showIcon?: boolean;
  hideFeeInfo?: boolean;
  replaceType?: EReplaceTxType;
};

export type ITxActionCommonDetailViewProps = {
  networkId: string;
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
    description?: {
      content?: React.ReactNode;
      icon?: IKeyOfIcons;
    };
  };
  source?: {
    title?: string;
    content: string;
    description?: {
      content?: React.ReactNode;
      icon?: IKeyOfIcons;
    };
  };
  applyFor?: {
    title?: string;
    content: string;
    description?: {
      content?: React.ReactNode;
      icon?: IKeyOfIcons;
    };
  };
};
