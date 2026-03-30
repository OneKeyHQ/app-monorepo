import appGlobals from '../appGlobals';

import type { AccountScope } from './scopes/account';
import type { AccountSelectorScope } from './scopes/accountSelector';
import type { AddressInputScope } from './scopes/addressInput';
import type { AppScope } from './scopes/app';
import type { ApprovalScope } from './scopes/approval';
import type { CloudBackupScope } from './scopes/cloudBackup';
import type { CloudSyncScope } from './scopes/cloudSync';
import type { DemoScope } from './scopes/demo';
import type { DexScope } from './scopes/dex';
import type { DiscoveryScope } from './scopes/discovery';
import type { FiatCryptoScope } from './scopes/fiatCrypto';
import type { HardwareScope } from './scopes/hardware';
import type { IpTableScope } from './scopes/ipTable';
import type { MarketScope } from './scopes/market';
import type { NetworkDoctorScope } from './scopes/networkDoctor';
import type { NotificationScope } from './scopes/notification/notification';
import type { OnboardingScope } from './scopes/onboarding';
import type { PerpScope } from './scopes/perp';
import type { PrimeScope } from './scopes/prime';
import type { ReferralScope } from './scopes/referral';
import type { RewardScope } from './scopes/reward';
import type { RookieGuideScope } from './scopes/rookieGuide';
import type { ScanQrCodeScope } from './scopes/scanQrCode';
import type { SettingScope } from './scopes/setting';
import type { SignatureRecordScope } from './scopes/signatureRecord';
import type { StakingScope } from './scopes/staking';
import type { SwapScope } from './scopes/swap';
import type { TokenScope } from './scopes/token';
import type { TransactionScope } from './scopes/transaction';
import type { UIScope } from './scopes/ui';
import type { UniversalSearchScope } from './scopes/universalSearch';
import type { UpdateScope } from './scopes/update';
import type { WalletScope } from './scopes/wallet';

// Lazy scope loader — defers require() + instantiation until first access.
// Reduces startup module graph from ~131 files to ~5 (base infrastructure only).
// require() uses literal strings so Metro/webpack can resolve them statically.
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires */

export class DefaultLogger {
  private _cache = new Map<string, unknown>();

  private _lazy<T>(key: string, factory: () => T): T {
    let inst = this._cache.get(key) as T | undefined;
    if (!inst) {
      inst = factory();
      this._cache.set(key, inst);
    }
    return inst;
  }

  get account() {
    return this._lazy<AccountScope>(
      'account',
      () => new (require('./scopes/account').AccountScope)(),
    );
  }

  get accountSelector() {
    return this._lazy<AccountSelectorScope>(
      'accountSelector',
      () => new (require('./scopes/accountSelector').AccountSelectorScope)(),
    );
  }

  get addressInput() {
    return this._lazy<AddressInputScope>(
      'addressInput',
      () => new (require('./scopes/addressInput').AddressInputScope)(),
    );
  }

  get app() {
    return this._lazy<AppScope>(
      'app',
      () => new (require('./scopes/app').AppScope)(),
    );
  }

  get approval() {
    return this._lazy<ApprovalScope>(
      'approval',
      () => new (require('./scopes/approval').ApprovalScope)(),
    );
  }

  get cloudBackup() {
    return this._lazy<CloudBackupScope>(
      'cloudBackup',
      () => new (require('./scopes/cloudBackup').CloudBackupScope)(),
    );
  }

  get cloudSync() {
    return this._lazy<CloudSyncScope>(
      'cloudSync',
      () => new (require('./scopes/cloudSync').CloudSyncScope)(),
    );
  }

  get demo() {
    return this._lazy<DemoScope>(
      'demo',
      () => new (require('./scopes/demo').DemoScope)(),
    );
  }

  get dex() {
    return this._lazy<DexScope>(
      'dex',
      () => new (require('./scopes/dex').DexScope)(),
    );
  }

  get discovery() {
    return this._lazy<DiscoveryScope>(
      'discovery',
      () => new (require('./scopes/discovery').DiscoveryScope)(),
    );
  }

  get fiatCrypto() {
    return this._lazy<FiatCryptoScope>(
      'fiatCrypto',
      () => new (require('./scopes/fiatCrypto').FiatCryptoScope)(),
    );
  }

  get hardware() {
    return this._lazy<HardwareScope>(
      'hardware',
      () => new (require('./scopes/hardware').HardwareScope)(),
    );
  }

  get ipTable() {
    return this._lazy<IpTableScope>(
      'ipTable',
      () => new (require('./scopes/ipTable').IpTableScope)(),
    );
  }

  get market() {
    return this._lazy<MarketScope>(
      'market',
      () => new (require('./scopes/market').MarketScope)(),
    );
  }

  get networkDoctor() {
    return this._lazy<NetworkDoctorScope>(
      'networkDoctor',
      () => new (require('./scopes/networkDoctor').NetworkDoctorScope)(),
    );
  }

  get notification() {
    return this._lazy<NotificationScope>(
      'notification',
      () =>
        new (require('./scopes/notification/notification').NotificationScope)(),
    );
  }

  get onboarding() {
    return this._lazy<OnboardingScope>(
      'onboarding',
      () => new (require('./scopes/onboarding').OnboardingScope)(),
    );
  }

  get perp() {
    return this._lazy<PerpScope>(
      'perp',
      () => new (require('./scopes/perp').PerpScope)(),
    );
  }

  get prime() {
    return this._lazy<PrimeScope>(
      'prime',
      () => new (require('./scopes/prime').PrimeScope)(),
    );
  }

  get referral() {
    return this._lazy<ReferralScope>(
      'referral',
      () => new (require('./scopes/referral').ReferralScope)(),
    );
  }

  get reward() {
    return this._lazy<RewardScope>(
      'reward',
      () => new (require('./scopes/reward').RewardScope)(),
    );
  }

  get rookieGuide() {
    return this._lazy<RookieGuideScope>(
      'rookieGuide',
      () => new (require('./scopes/rookieGuide').RookieGuideScope)(),
    );
  }

  get scanQrCode() {
    return this._lazy<ScanQrCodeScope>(
      'scanQrCode',
      () => new (require('./scopes/scanQrCode').ScanQrCodeScope)(),
    );
  }

  get setting() {
    return this._lazy<SettingScope>(
      'setting',
      () => new (require('./scopes/setting').SettingScope)(),
    );
  }

  get signatureRecord() {
    return this._lazy<SignatureRecordScope>(
      'signatureRecord',
      () => new (require('./scopes/signatureRecord').SignatureRecordScope)(),
    );
  }

  get staking() {
    return this._lazy<StakingScope>(
      'staking',
      () => new (require('./scopes/staking').StakingScope)(),
    );
  }

  get swap() {
    return this._lazy<SwapScope>(
      'swap',
      () => new (require('./scopes/swap').SwapScope)(),
    );
  }

  get token() {
    return this._lazy<TokenScope>(
      'token',
      () => new (require('./scopes/token').TokenScope)(),
    );
  }

  get transaction() {
    return this._lazy<TransactionScope>(
      'transaction',
      () => new (require('./scopes/transaction').TransactionScope)(),
    );
  }

  get ui() {
    return this._lazy<UIScope>(
      'ui',
      () => new (require('./scopes/ui').UIScope)(),
    );
  }

  get universalSearch() {
    return this._lazy<UniversalSearchScope>(
      'universalSearch',
      () => new (require('./scopes/universalSearch').UniversalSearchScope)(),
    );
  }

  get update() {
    return this._lazy<UpdateScope>(
      'update',
      () => new (require('./scopes/update').UpdateScope)(),
    );
  }

  get wallet() {
    return this._lazy<WalletScope>(
      'wallet',
      () => new (require('./scopes/wallet').WalletScope)(),
    );
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires */

const defaultLogger = new DefaultLogger();
appGlobals.$defaultLogger = defaultLogger;

export { defaultLogger };
