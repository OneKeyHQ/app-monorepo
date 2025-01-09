import { Button, Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Layout } from './utils/Layout';

function demoLog(data: any) {
  Toast.success({
    title: JSON.stringify(data),
  });
  if (!platformEnv.isNative) {
    console.log(data);
  }
}

function LocalDBDemo1() {
  return (
    <Stack gap="$2">
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoGetAllRecords();
          demoLog(ctx);
        }}
      >
        demoGetAllRecords
      </Button>
      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceDemo.demoGetDbContextWithoutTx();
          demoLog(ctx);
        }}
      >
        demoGetDbContextWithoutTx
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoGetDbContext();
          demoLog(ctx);
        }}
      >
        Show Context
      </Button>
      <Button
        onPress={async () => {
          const r =
            await backgroundApiProxy.serviceDemo.demoGetDbContextCount();
          demoLog(r);
        }}
      >
        Get Context Count
      </Button>
      <Button
        onPress={async () => {
          const r =
            await backgroundApiProxy.serviceDemo.demoGetDbAccountsCount();
          demoLog(r);
        }}
      >
        Get Accounts Count
      </Button>
      <Button
        onPress={async () => {
          const r =
            await backgroundApiProxy.serviceDemo.demoGetDbWalletsCount();
          demoLog(r);
        }}
      >
        Get Wallets Count
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoDbUpdateUUID();
          demoLog(ctx);
        }}
      >
        demoDbUpdateUUID
      </Button>
      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceDemo.demoDbUpdateUUIDFixed();
          demoLog(ctx);
        }}
      >
        demoDbUpdateUUIDFixed
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoAddRecord1();
          demoLog(ctx);
        }}
      >
        Add Record
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceDemo.demoRemoveRecord1();
          demoLog(ctx);
        }}
      >
        batch remove Record
      </Button>

      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceDemo.demoUpdateCredentialRecord();
          demoLog(ctx);
        }}
      >
        demoUpdateCredentialRecord
      </Button>

      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceDemo.addMultipleWatchingAccounts();
          demoLog(ctx);
        }}
      >
        demoAddMultipleWatchingAccounts
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          const r =
            await backgroundApiProxy.serviceDemo.demoAddBrowserHistoryRecords();
          demoLog(r);
          demoLog(Date.now() - now);
        }}
      >
        --- demoAddBrowserHistoryRecords ---
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          await backgroundApiProxy.serviceDemo.demoAddBrowserHistoryRecords(1);
          demoLog(Date.now() - now);
        }}
      >
        demoAddBrowserHistoryRecords=1
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          await backgroundApiProxy.serviceDemo.demoAddBrowserHistoryRecords(
            1000,
          );
          demoLog(Date.now() - now);
        }}
      >
        demoAddBrowserHistoryRecords=1000
      </Button>

      <Button
        onPress={async () => {
          await backgroundApiProxy.serviceDemo.demoRemoveAllBrowserHistoryRecords();
        }}
      >
        demoRemoveAllBrowserHistoryRecords
      </Button>

      <Button
        onPress={async () => {
          const r =
            await backgroundApiProxy.serviceDemo.demoAddDappConnectedHistoryRecords();
          demoLog(r);
        }}
      >
        demoAddDappConnectedHistoryRecords
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          await backgroundApiProxy.serviceDemo.demoAddDappConnectedHistoryRecords(
            1,
          );
          demoLog(Date.now() - now);
        }}
      >
        demoAddDappConnectedHistoryRecords=1
      </Button>
      <Button
        onPress={async () => {
          const now = Date.now();
          await backgroundApiProxy.serviceDemo.demoAddDappConnectedHistoryRecords(
            1000,
          );
          demoLog(Date.now() - now);
        }}
      >
        demoAddDappConnectedHistoryRecords=1000
      </Button>

      <Button
        onPress={async () => {
          const r =
            await backgroundApiProxy.serviceDemo.demoRemoveAllConnectedHistoryRecords();
          demoLog(r);
        }}
      >
        demoRemoveAllConnectedHistoryRecords
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          const r =
            await backgroundApiProxy.serviceSignature.getFirstConnectedSites();
          demoLog({ time: Date.now() - now, site: r });
          // demoLog(
          //   `networkIds isArray1: ${Array.isArray(r.networkIds).toString()}`,
          // );
          // demoLog(`networkIds isArray2: ${isArray(r.networkIds).toString()}`);
          // demoLog(`networkIds typeOf: ${typeof r.networkIds}`);
        }}
      >
        getFirstConnectedSites time
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          const r =
            await backgroundApiProxy.serviceSignature.getAllConnectedSites();
          demoLog({ time: Date.now() - now, sites: r.length });
        }}
      >
        getAllConnectedSites time
      </Button>
      <Button
        onPress={async () => {
          const now = Date.now();
          const r =
            await backgroundApiProxy.serviceSignature.getAllConnectedSites({
              offset: 1800,
              limit: 115,
            });
          demoLog({
            time: Date.now() - now,
            sites: r.length,
          });
        }}
      >
        getAllConnectedSites byQuery time
      </Button>
      <Button
        onPress={async () => {
          const now = Date.now();
          const r =
            await backgroundApiProxy.serviceSignature.getAllConnectedSitesCount();
          demoLog({
            time: Date.now() - now,
            sitesCount: r?.count,
          });
        }}
      >
        getAllConnectedSitesCount time
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          const { accounts } =
            await backgroundApiProxy.serviceAccount.getAllAccounts({
              filterRemoved: true,
            });
          demoLog({
            time: Date.now() - now,
            accounts: accounts.length,
          });
          if (!platformEnv.isNative) {
            console.log(accounts);
          }
        }}
      >
        getAllAccounts time
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          const { indexedAccounts } =
            await backgroundApiProxy.serviceAccount.getAllIndexedAccounts({
              filterRemoved: true,
            });
          demoLog({
            time: Date.now() - now,
            indexedAccounts: indexedAccounts.length,
          });
          if (!platformEnv.isNative) {
            console.log(indexedAccounts);
          }
        }}
      >
        getAllIndexedAccounts time
      </Button>

      <Button
        onPress={async () => {
          void (async () => {
            const now = Date.now();
            const r =
              await backgroundApiProxy.serviceSignature.getAllConnectedSites();
            demoLog({
              time: Date.now() - now,
              sites: r.length,
            });
          })();

          void (async () => {
            const now = Date.now();
            const { accounts } =
              await backgroundApiProxy.serviceAccount.getAllAccounts({
                filterRemoved: true,
              });
            demoLog({
              time: Date.now() - now,
              accounts: accounts.length,
            });
            if (!platformEnv.isNative) {
              console.log(accounts);
            }
          })();
        }}
      >
        getAllConnectedSites -》 getAllAccounts time
      </Button>

      <Button
        onPress={async () => {
          const now = Date.now();
          const accountValue =
            await backgroundApiProxy.simpleDb.accountValue.getRawData();
          // accountValue?.
          demoLog(Date.now() - now);
          if (!platformEnv.isNative) {
            console.log(accountValue);
          }
        }}
      >
        simpleDB accountValue time
      </Button>
      <Button
        onPress={async () => {
          const now = Date.now();
          const data =
            await backgroundApiProxy.simpleDb.browserHistory.getRawData();
          demoLog({
            time: Date.now() - now,
            count: data?.data?.length,
          });
          if (!platformEnv.isNative) {
            console.log(data);
          }
        }}
      >
        simpleDB browserHistory time
      </Button>

      <Button
        onPress={async () => {
          void (async () => {
            const now = Date.now();
            const data =
              await backgroundApiProxy.simpleDb.browserHistory.getRawData();
            demoLog({
              time: Date.now() - now,
              count: data?.data?.length,
            });
            if (!platformEnv.isNative) {
              console.log(data);
            }
          })();

          void (async () => {
            const now = Date.now();
            const accountValue =
              await backgroundApiProxy.simpleDb.accountValue.getRawData();
            // accountValue?.
            demoLog(Date.now() - now);
            if (!platformEnv.isNative) {
              console.log(accountValue);
            }
          })();
        }}
      >
        simpleDB browserHistory -》 accountValue time
      </Button>

      <Button
        onPress={() => {
          demoLog(Array.isArray(['evm--1']));
        }}
      >
        test
      </Button>
    </Stack>
  );
}

const LocalDBGallery = () => (
  <Layout
    description="localDB"
    suggestions={['localDB']}
    boundaryConditions={['localDB']}
    elements={[
      {
        title: 'localDB',
        element: (
          <Stack gap="$1">
            <LocalDBDemo1 />
          </Stack>
        ),
      },
    ]}
  />
);

export default LocalDBGallery;
