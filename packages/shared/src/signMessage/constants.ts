export enum EPrimaryTypeOrder {
  Order = 'Order',
  OrderComponents = 'OrderComponents',
}

export enum EPrimaryTypePermit {
  Permit = 'Permit',
  PermitBatch = 'PermitBatch',
  PermitBatchTransferFrom = 'PermitBatchTransferFrom',
  PermitBatchWitnessTransferFrom = 'PermitBatchWitnessTransferFrom',
  PermitSingle = 'PermitSingle',
  PermitTransferFrom = 'PermitTransferFrom',
  PermitWitnessTransferFrom = 'PermitWitnessTransferFrom',
}

export const PRIMARY_TYPES_ORDER: EPrimaryTypeOrder[] =
  Object.values(EPrimaryTypeOrder);
export const PRIMARY_TYPES_PERMIT: EPrimaryTypePermit[] =
  Object.values(EPrimaryTypePermit);
