import { ComponentProps } from 'react';

import { ICON_NAMES, Text } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxDirection,
} from '@onekeyhq/engine/src/vaults/types';

export type ITxActionMetaTitle = {
  title?: string;
  titleKey?: LocaleIds;
};
export type ITxActionMetaIconItem = {
  url?: string;
  name?: ICON_NAMES;
};
export type ITxActionMetaIcon = {
  icon: ITxActionMetaIconItem | null;
};
export type ITxActionMetaComponents = {
  T0: (props: ITxActionCardProps) => JSX.Element | null;
  T1: (props: ITxActionCardProps) => JSX.Element | null;
  T2: (props: ITxActionCardProps) => JSX.Element | null;
};
export type ITxActionTransformTypes = keyof ITxActionMetaComponents;
export type ITxActionMeta = {
  titleInfo?: ITxActionMetaTitle;
  iconInfo?: ITxActionMetaIcon;
  transferAmount?: string;
};
export type ITxActionCardProps = {
  action: IDecodedTxAction;
  decodedTx: IDecodedTx;
  meta?: ITxActionMeta;
};

export type ITxActionAmountProps = ComponentProps<typeof Text> & {
  direction?: IDecodedTxDirection;
  amount: string;
  symbol?: string;
  onPress?: (() => void) | null;
};

export type ITxActionElementDetail = {
  title: string;
  content: JSX.Element | string;
};

export type ITxActionCardViewProps = {
  title?: JSX.Element;
  icon?: JSX.Element;
  content?: JSX.Element;
  details?: ITxActionElementDetail[];
};

export type ITxActionListViewProps = {
  decodedTx: IDecodedTx;
  space?: number;
  showDivider?: boolean;
  transformType?: ITxActionTransformTypes;
  // TODO useContext instead
  transferAmount?: string;
  feeInput?: JSX.Element;
};
