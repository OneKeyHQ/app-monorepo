import { cloneDeep } from 'lodash';

import { SimpleDbEntityNotificationSettings } from '../../dbs/simple/entity/SimpleDbEntityNotificationSettings';

import ServiceNotification from './ServiceNotification';

import type { IDBAccount, IDBWallet } from '../../dbs/local/types';
import type {
  IAccountActivityNotificationSettings,
  ISimpleDbNotificationSettings,
} from '../../dbs/simple/entity/SimpleDbEntityNotificationSettings';

jest.mock('@onekeyhq/shared/src/utils/notificationsUtils', () => ({
  __esModule: true,
  default: {},
  NOTIFICATION_ACCOUNT_ACTIVITY_DEFAULT_MAX_ACCOUNT_COUNT: 20,
}));

jest.mock('../../states/jotai/atoms', () => ({
  notificationsAtom: {
    get: jest.fn(async () => ({ maxAccountCount: 50 })),
    set: jest.fn(),
  },
  primePersistAtom: {
    get: jest.fn(async () => ({ primeSubscription: { isActive: true } })),
  },
}));

function buildWallet(
  id: string,
  accountIds: string[],
  overrides: Partial<IDBWallet> = {},
): IDBWallet {
  return {
    id,
    name: id,
    type: 'hd',
    backuped: true,
    accounts: [],
    nextIds: {},
    walletNo: 1,
    dbIndexedAccounts: accountIds.map((accountId, index) => ({
      id: accountId,
      name: accountId,
      walletId: id,
      index,
      idHash: accountId,
    })),
    ...overrides,
  };
}

function buildAccount(id: string): IDBAccount {
  return {
    id,
    name: id,
    type: undefined,
    path: '',
    coinType: '60',
    impl: 'evm',
    pub: '',
    address: '',
  };
}

function buildSettings(
  enabledIds: string[],
  disabledIds: string[] = [],
): IAccountActivityNotificationSettings[string] {
  const accounts: IAccountActivityNotificationSettings[string]['accounts'] = {};
  for (const id of enabledIds) {
    accounts[id] = { enabled: true };
  }
  for (const id of disabledIds) {
    accounts[id] = { enabled: false };
  }
  return {
    enabled: true,
    accounts,
  };
}

describe('ServiceNotification account activity after account removal', () => {
  let service: ServiceNotification;
  const previousIsInBackground = globalThis.$onekeyIsInBackground;

  beforeAll(() => {
    globalThis.$onekeyIsInBackground = true;
    service = new ServiceNotification({ backgroundApi: {} });
  });

  afterAll(() => {
    globalThis.$onekeyIsInBackground = previousIsInBackground;
  });

  function rebuild(
    notificationWallets: IDBWallet[],
    settings: IAccountActivityNotificationSettings,
    maxAccountCount = 20,
  ) {
    return service.rebuildAccountActivity({
      notificationWallets,
      currentAccountActivity: settings,
      settings: { accountActivity: settings },
      maxAccountCount,
    });
  }

  it.each(['indexed', 'imported'])(
    'removes deleted %s accounts from settings and the notification count',
    async (kind) => {
      const wallet = buildWallet('wallet', ['kept']);
      if (kind === 'imported') {
        wallet.dbIndexedAccounts = undefined;
        wallet.dbAccounts = [buildAccount('kept')];
      }
      const input = { wallet: buildSettings(['kept', 'removed']) };
      const snapshot = cloneDeep(input);
      const result = rebuild([wallet], input);

      expect(result).toEqual({ wallet: buildSettings(['kept']) });
      expect(input).toEqual(snapshot);
      const entity = new SimpleDbEntityNotificationSettings();
      jest
        .spyOn(entity, 'getRawData')
        .mockResolvedValue({ accountActivity: result });
      await expect(entity.getEnabledAccountCount()).resolves.toBe(1);
    },
  );

  it('releases deleted account quota while keeping existing enabled accounts', () => {
    const result = rebuild(
      [buildWallet('wallet', ['new-first', 'new-second', 'kept'])],
      { wallet: buildSettings(['kept', 'removed']) },
      2,
    );

    expect(result).toEqual({
      wallet: buildSettings(['new-first', 'kept'], ['new-second']),
    });
  });

  it('keeps explicit disabled account and wallet preferences', () => {
    const result = rebuild(
      [
        buildWallet('wallet', ['kept', 'disabled']),
        buildWallet('disabled-wallet', ['account']),
      ],
      {
        wallet: buildSettings(['kept', 'removed'], ['disabled']),
        'disabled-wallet': {
          ...buildSettings(['account']),
          enabled: false,
        },
      },
    );

    expect(result).toEqual({
      wallet: buildSettings(['kept'], ['disabled']),
      'disabled-wallet': {
        ...buildSettings([], ['account']),
        enabled: false,
      },
    });
  });

  it('cleans hidden wallet accounts and removed wallets from the same quota', () => {
    const result = rebuild(
      [
        buildWallet('wallet', ['new'], {
          hiddenWallets: [buildWallet('hidden', ['kept'])],
        }),
      ],
      {
        wallet: buildSettings(['removed']),
        hidden: buildSettings(['kept', 'hidden-removed']),
        'removed-wallet': buildSettings(['account']),
      },
      2,
    );

    expect(result).toEqual({
      wallet: buildSettings(['new']),
      hidden: buildSettings(['kept']),
    });
  });

  it('clears the last account and keeps an empty wallet disabled', () => {
    const result = rebuild([buildWallet('wallet', [])], {
      wallet: buildSettings(['removed']),
    });

    expect(result).toEqual({ wallet: { enabled: false, accounts: {} } });
    expect(rebuild([], result)).toEqual({});
  });

  it('reserves full quota for existing accounts even when new ones come first', () => {
    expect(
      rebuild(
        [buildWallet('wallet', ['new', 'first', 'second'])],
        { wallet: buildSettings(['first', 'second']) },
        2,
      ),
    ).toEqual({ wallet: buildSettings(['first', 'second'], ['new']) });
  });

  it('enables only the allowed account count on first initialization', () => {
    expect(
      service.rebuildAccountActivity({
        notificationWallets: [buildWallet('wallet', ['first', 'second'])],
        currentAccountActivity: {},
        settings: undefined,
        maxAccountCount: 1,
      }),
    ).toEqual({ wallet: buildSettings(['first'], ['second']) });
  });

  it('filters deleted Prime backup accounts after restoring live preferences', async () => {
    const settings: ISimpleDbNotificationSettings = {
      accountActivity: { wallet: buildSettings([], ['kept', 'disabled']) },
      primeBackupAccountActivity: {
        wallet: buildSettings(['kept', 'removed'], ['disabled']),
        hidden: buildSettings(['hidden-kept', 'hidden-removed']),
        'removed-wallet': buildSettings(['account']),
      },
    };
    const snapshot = cloneDeep(settings);
    const primeService = new ServiceNotification({
      backgroundApi: {
        simpleDb: {
          notificationSettings: {
            getRawData: jest.fn(async () => settings),
          },
        },
      },
    });
    const save = jest
      .spyOn(primeService, 'saveAccountActivityNotificationSettings')
      .mockResolvedValue(undefined);

    await primeService.fixAccountActivityNotificationSettings({
      notificationWallets: [
        buildWallet('wallet', ['kept', 'disabled'], {
          hiddenWallets: [buildWallet('hidden', ['hidden-kept'])],
        }),
      ],
    });

    expect(save).toHaveBeenCalledWith({
      wallet: buildSettings(['kept'], ['disabled']),
      hidden: buildSettings(['hidden-kept']),
    });
    expect(settings).toEqual(snapshot);
  });
});
