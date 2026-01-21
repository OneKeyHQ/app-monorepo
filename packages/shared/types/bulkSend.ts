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
