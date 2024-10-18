export enum EPrimaryTypeOrder {
  Order = 'Order',
  OrderComponents = 'OrderComponents',
}

export enum EPrimaryTypePermit {
  Permit = 'Permit',
  PermitBatch = 'PermitBatch',
  PermitBatchTransferFrom = 'PermitBatchTransferFrom',
  PermitSingle = 'PermitSingle',
  PermitTransferFrom = 'PermitTransferFrom',
}

export const PRIMARY_TYPES_ORDER: EPrimaryTypeOrder[] =
  Object.values(EPrimaryTypeOrder);
export const PRIMARY_TYPES_PERMIT: EPrimaryTypePermit[] =
  Object.values(EPrimaryTypePermit);
