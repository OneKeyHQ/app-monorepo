import appGlobals from '../appGlobals';

import { AccountScope } from './scopes/account';
import { AccountSelectorScope } from './scopes/accountSelector';
import { AddressInputScope } from './scopes/addressInput';
import { AppScope } from './scopes/app';
import { CloudBackupScope } from './scopes/cloudBackup';
import { DemoScope } from './scopes/demo';
import { DexScope } from './scopes/dex';
import { DiscoveryScope } from './scopes/discovery';
import { FiatCryptoScope } from './scopes/fiatCrypto';
import { HardwareScope } from './scopes/hardware';
import { MarketScope } from './scopes/market';
import { NotificationScope } from './scopes/notification/notification';
import { PerpScope } from './scopes/perp';
import { ReferralScope } from './scopes/referral';
import { RewardScope } from './scopes/reward';
import { ScanQrCodeScope } from './scopes/scanQrCode';
import { SettingScope } from './scopes/setting';
import { SignatureRecordScope } from './scopes/signatureRecord';
import { StakingScope } from './scopes/staking';
import { SwapScope } from './scopes/swap';
import { TokenScope } from './scopes/token';
import { TransactionScope } from './scopes/transaction';
import { UIScope } from './scopes/ui';
import { UpdateScope } from './scopes/update';
import { WalletScope } from './scopes/wallet';

export class DefaultLogger {
  account = new AccountScope();

  cloudBackup = new CloudBackupScope();

  accountSelector = new AccountSelectorScope();

  app = new AppScope();

  demo = new DemoScope();

  setting = new SettingScope();

  addressInput = new AddressInputScope();

  signatureRecord = new SignatureRecordScope();

  update = new UpdateScope();

  discovery = new DiscoveryScope();

  token = new TokenScope();

  swap = new SwapScope();

  staking = new StakingScope();

  transaction = new TransactionScope();

  hardware = new HardwareScope();

  fiatCrypto = new FiatCryptoScope();

  notification = new NotificationScope();

  market = new MarketScope();

  perp = new PerpScope();

  scanQrCode = new ScanQrCodeScope();

  wallet = new WalletScope();

  ui = new UIScope();

  referral = new ReferralScope();

  reward = new RewardScope();

  dex = new DexScope();
}

const defaultLogger = new DefaultLogger();
appGlobals.$defaultLogger = defaultLogger;

export { defaultLogger };
