import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';

export type ITxActionProps = {
  action: IDecodedTxAction;
  accountAddress: string;
};

export type ITxActionComponents = {
  T0: (props: ITxActionProps) => JSX.Element | null;
  T1: (props: ITxActionProps) => JSX.Element | null;
};
