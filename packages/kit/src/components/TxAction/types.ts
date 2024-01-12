import type { IKeyOfIcons } from '@onekeyhq/components';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';

export type ITxActionProps = {
  action: IDecodedTxAction;
  tableLayout?: boolean;
};

export type ITxActionComponents = {
  T0: (props: ITxActionProps) => JSX.Element | null;
  T1: (props: ITxActionProps) => JSX.Element | null;
};

export type ITxActionCommonProps = {
  avatar: {
    circular?: boolean;
    src?: string | string[];
    fallbackIcon: IKeyOfIcons;
  };
  title: string;
  description?: {
    prefix?: string;
    icon?: IKeyOfIcons;
    children?: string;
  };
  change?: string;
  changeDescription?: string;
  pending?: boolean;
  tableLayout?: boolean;
};
