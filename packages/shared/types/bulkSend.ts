export enum EBulkSendMode {
  OneToMany = 'oneToMany',
  ManyToOne = 'manyToOne',
  ManyToMany = 'manyToMany',
}

export enum EReceiverMode {
  AddressOnly = 'addressOnly',
  AddressAndAmount = 'addressAndAmount',
}

export enum EAmountInputMode {
  Specified = 'specified',
  Range = 'range',
  Custom = 'custom',
}

export type IAmountInputValues = {
  specifiedAmount: string;
  rangeMin: string;
  rangeMax: string;
  isMaxMode?: boolean;
};

export type IAmountInputError = {
  specifiedAmount?: string;
  rangeMin?: string;
  rangeMax?: string;
  rangeError?: string;
};

export type ITransferInfoError = {
  from?: string;
  to?: string;
  amount?: string;
};

export type ITransferInfoErrors = Record<number, ITransferInfoError>;

export enum EIntervalMode {
  Specified = 'specified',
  None = 'none',
}

export type IIntervalSettings = {
  mode: EIntervalMode;
  minSeconds: string;
  maxSeconds: string;
};
