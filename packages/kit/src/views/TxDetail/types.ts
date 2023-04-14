import type { ComponentProps } from 'react';

import type { ICON_NAMES, Text } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxDirection,
  IHistoryTx,
} from '@onekeyhq/engine/src/vaults/types';

import type { useSendConfirmRouteParamsParsed } from '../Send/utils/useSendConfirmRouteParamsParsed';
import type { ITxDetailContextData } from './TxDetailContext';
import type { IntlShape } from 'react-intl';

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
  historyTx: IHistoryTx | undefined;
  meta?: ITxActionMeta;
  intl: IntlShape;
  network?: Network | null;
};

export type ITxActionAmountProps = ComponentProps<typeof Text> & {
  direction?: IDecodedTxDirection;
  amount?: string;
  symbol?: string;
  decimals?: number;
  onPress?: (() => void) | null;
  subText?: string | JSX.Element;
};

export type ITxActionElementDetail = {
  title: JSX.Element | string;
  content: JSX.Element | string;
  extra?: JSX.Element | string;
};

export type ITxActionCardViewProps = {
  title?: JSX.Element;
  subTitle?: JSX.Element;
  icon?: JSX.Element;
  content?: JSX.Element;
  details?: Array<ITxActionElementDetail | undefined | null>;
  isSingleTransformMode?: boolean;
  showTitleDivider?: boolean;
};

export type ITxActionListViewProps = {
  sendConfirmParamsParsed?: ReturnType<typeof useSendConfirmRouteParamsParsed>;
  historyTx?: IHistoryTx;
  decodedTx: IDecodedTx;
  space?: number | string;
  showDivider?: boolean;
  showConnectionLine?: boolean;
  transformType?: ITxActionTransformTypes;
  // TODO useContext instead
  transferAmount?: string;
  feeInput?: JSX.Element;
  isSingleTransformMode?: boolean;
  advancedSettingsForm?: JSX.Element | null;
} & ITxDetailContextData;
