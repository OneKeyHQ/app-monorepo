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

/* eslint-disable @typescript-eslint/no-var-requires */

export type ILoggerScopeMap = {
  account: AccountScope;
  accountSelector: AccountSelectorScope;
  addressInput: AddressInputScope;
  app: AppScope;
  approval: ApprovalScope;
  cloudBackup: CloudBackupScope;
  cloudSync: CloudSyncScope;
  demo: DemoScope;
  dex: DexScope;
  discovery: DiscoveryScope;
  fiatCrypto: FiatCryptoScope;
  hardware: HardwareScope;
  ipTable: IpTableScope;
  market: MarketScope;
  networkDoctor: NetworkDoctorScope;
  notification: NotificationScope;
  onboarding: OnboardingScope;
  perp: PerpScope;
  prime: PrimeScope;
  referral: ReferralScope;
  reward: RewardScope;
  rookieGuide: RookieGuideScope;
  scanQrCode: ScanQrCodeScope;
  setting: SettingScope;
  signatureRecord: SignatureRecordScope;
  staking: StakingScope;
  swap: SwapScope;
  token: TokenScope;
  transaction: TransactionScope;
  ui: UIScope;
  universalSearch: UniversalSearchScope;
  update: UpdateScope;
  wallet: WalletScope;
};

export type ILoggerScopeKey = keyof ILoggerScopeMap;

type ILoggerScopeFactoryMap = {
  [K in ILoggerScopeKey]: () => ILoggerScopeMap[K];
};

type IScopeConstructor<T> = new () => T;

function createScopeFactory<
  T,
  TModule extends Record<TKey, IScopeConstructor<T>>,
  TKey extends keyof TModule,
>(loadModule: () => TModule, exportName: TKey): () => T {
  return () => {
    const scopeModule = loadModule();
    const ScopeConstructor = scopeModule[exportName];
    return new ScopeConstructor();
  };
}

const loggerScopeFactories: ILoggerScopeFactoryMap = {
  account: createScopeFactory(
    () =>
      require('./scopes/account') as {
        AccountScope: IScopeConstructor<AccountScope>;
      },
    'AccountScope',
  ),
  accountSelector: createScopeFactory(
    () =>
      require('./scopes/accountSelector') as {
        AccountSelectorScope: IScopeConstructor<AccountSelectorScope>;
      },
    'AccountSelectorScope',
  ),
  addressInput: createScopeFactory(
    () =>
      require('./scopes/addressInput') as {
        AddressInputScope: IScopeConstructor<AddressInputScope>;
      },
    'AddressInputScope',
  ),
  app: createScopeFactory(
    () =>
      require('./scopes/app') as {
        AppScope: IScopeConstructor<AppScope>;
      },
    'AppScope',
  ),
  approval: createScopeFactory(
    () =>
      require('./scopes/approval') as {
        ApprovalScope: IScopeConstructor<ApprovalScope>;
      },
    'ApprovalScope',
  ),
  cloudBackup: createScopeFactory(
    () =>
      require('./scopes/cloudBackup') as {
        CloudBackupScope: IScopeConstructor<CloudBackupScope>;
      },
    'CloudBackupScope',
  ),
  cloudSync: createScopeFactory(
    () =>
      require('./scopes/cloudSync') as {
        CloudSyncScope: IScopeConstructor<CloudSyncScope>;
      },
    'CloudSyncScope',
  ),
  demo: createScopeFactory(
    () =>
      require('./scopes/demo') as {
        DemoScope: IScopeConstructor<DemoScope>;
      },
    'DemoScope',
  ),
  dex: createScopeFactory(
    () =>
      require('./scopes/dex') as {
        DexScope: IScopeConstructor<DexScope>;
      },
    'DexScope',
  ),
  discovery: createScopeFactory(
    () =>
      require('./scopes/discovery') as {
        DiscoveryScope: IScopeConstructor<DiscoveryScope>;
      },
    'DiscoveryScope',
  ),
  fiatCrypto: createScopeFactory(
    () =>
      require('./scopes/fiatCrypto') as {
        FiatCryptoScope: IScopeConstructor<FiatCryptoScope>;
      },
    'FiatCryptoScope',
  ),
  hardware: createScopeFactory(
    () =>
      require('./scopes/hardware') as {
        HardwareScope: IScopeConstructor<HardwareScope>;
      },
    'HardwareScope',
  ),
  ipTable: createScopeFactory(
    () =>
      require('./scopes/ipTable') as {
        IpTableScope: IScopeConstructor<IpTableScope>;
      },
    'IpTableScope',
  ),
  market: createScopeFactory(
    () =>
      require('./scopes/market') as {
        MarketScope: IScopeConstructor<MarketScope>;
      },
    'MarketScope',
  ),
  networkDoctor: createScopeFactory(
    () =>
      require('./scopes/networkDoctor') as {
        NetworkDoctorScope: IScopeConstructor<NetworkDoctorScope>;
      },
    'NetworkDoctorScope',
  ),
  notification: createScopeFactory(
    () =>
      require('./scopes/notification/notification') as {
        NotificationScope: IScopeConstructor<NotificationScope>;
      },
    'NotificationScope',
  ),
  onboarding: createScopeFactory(
    () =>
      require('./scopes/onboarding') as {
        OnboardingScope: IScopeConstructor<OnboardingScope>;
      },
    'OnboardingScope',
  ),
  perp: createScopeFactory(
    () =>
      require('./scopes/perp') as {
        PerpScope: IScopeConstructor<PerpScope>;
      },
    'PerpScope',
  ),
  prime: createScopeFactory(
    () =>
      require('./scopes/prime') as {
        PrimeScope: IScopeConstructor<PrimeScope>;
      },
    'PrimeScope',
  ),
  referral: createScopeFactory(
    () =>
      require('./scopes/referral') as {
        ReferralScope: IScopeConstructor<ReferralScope>;
      },
    'ReferralScope',
  ),
  reward: createScopeFactory(
    () =>
      require('./scopes/reward') as {
        RewardScope: IScopeConstructor<RewardScope>;
      },
    'RewardScope',
  ),
  rookieGuide: createScopeFactory(
    () =>
      require('./scopes/rookieGuide') as {
        RookieGuideScope: IScopeConstructor<RookieGuideScope>;
      },
    'RookieGuideScope',
  ),
  scanQrCode: createScopeFactory(
    () =>
      require('./scopes/scanQrCode') as {
        ScanQrCodeScope: IScopeConstructor<ScanQrCodeScope>;
      },
    'ScanQrCodeScope',
  ),
  setting: createScopeFactory(
    () =>
      require('./scopes/setting') as {
        SettingScope: IScopeConstructor<SettingScope>;
      },
    'SettingScope',
  ),
  signatureRecord: createScopeFactory(
    () =>
      require('./scopes/signatureRecord') as {
        SignatureRecordScope: IScopeConstructor<SignatureRecordScope>;
      },
    'SignatureRecordScope',
  ),
  staking: createScopeFactory(
    () =>
      require('./scopes/staking') as {
        StakingScope: IScopeConstructor<StakingScope>;
      },
    'StakingScope',
  ),
  swap: createScopeFactory(
    () =>
      require('./scopes/swap') as {
        SwapScope: IScopeConstructor<SwapScope>;
      },
    'SwapScope',
  ),
  token: createScopeFactory(
    () =>
      require('./scopes/token') as {
        TokenScope: IScopeConstructor<TokenScope>;
      },
    'TokenScope',
  ),
  transaction: createScopeFactory(
    () =>
      require('./scopes/transaction') as {
        TransactionScope: IScopeConstructor<TransactionScope>;
      },
    'TransactionScope',
  ),
  ui: createScopeFactory(
    () =>
      require('./scopes/ui') as {
        UIScope: IScopeConstructor<UIScope>;
      },
    'UIScope',
  ),
  universalSearch: createScopeFactory(
    () =>
      require('./scopes/universalSearch') as {
        UniversalSearchScope: IScopeConstructor<UniversalSearchScope>;
      },
    'UniversalSearchScope',
  ),
  update: createScopeFactory(
    () =>
      require('./scopes/update') as {
        UpdateScope: IScopeConstructor<UpdateScope>;
      },
    'UpdateScope',
  ),
  wallet: createScopeFactory(
    () =>
      require('./scopes/wallet') as {
        WalletScope: IScopeConstructor<WalletScope>;
      },
    'WalletScope',
  ),
};

const loggerScopeKeys = Object.keys(loggerScopeFactories) as ILoggerScopeKey[];

export function getLoggerScopeKeys(): ILoggerScopeKey[] {
  return [...loggerScopeKeys];
}

export function createLoggerScope<K extends ILoggerScopeKey>(
  key: K,
): ILoggerScopeMap[K] {
  return loggerScopeFactories[key]();
}

/* eslint-enable @typescript-eslint/no-var-requires */
