export type Dot = { light: boolean };

export enum KeyTagMnemonicStatus {
  UNVERIF = 'unverif',
  VERIF = 'verif',
  EMPTY = 'empty',
  INCORRECT = 'incorrect',
  FILL = 'FILLED',
}

export type KeyTagMnemonic = {
  index: number;
  mnemonicIndexNumber?: number;
  mnemonicWord?: string;
  status?: KeyTagMnemonicStatus;
  dotMapData?: boolean[];
};
