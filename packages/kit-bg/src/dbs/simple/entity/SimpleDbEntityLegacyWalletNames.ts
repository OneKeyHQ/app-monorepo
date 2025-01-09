import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export type ILegacyWalletNamesMap = {
  [walletId: string]: string;
};

// Desktop 5.0.0 hw wallet name is not synced with device label, so we need to backup it
export class SimpleDbEntityLegacyWalletNames extends SimpleDbEntityBase<ILegacyWalletNamesMap> {
  entityName = 'legacyWalletNames';

  override enableCache = false;
}
