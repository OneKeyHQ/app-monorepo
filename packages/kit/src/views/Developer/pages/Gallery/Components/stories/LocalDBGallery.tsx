import { Button, Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { Layout } from './utils/Layout';

function demoLog(data: any) {
  Toast.success({
    title: JSON.stringify(data),
  });
  console.log(data);
}

function LocalDBDemo1() {
  return (
    <Stack space="$2">
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoGetAllRecords();
          demoLog(ctx);
        }}
      >
        demoGetAllRecords
      </Button>
      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceApp.demoGetDbContextWithoutTx();
          demoLog(ctx);
        }}
      >
        demoGetDbContextWithoutTx
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoGetDbContext();
          demoLog(ctx);
        }}
      >
        Show Context
      </Button>
      <Button
        onPress={async () => {
          const r = await backgroundApiProxy.serviceApp.demoGetDbContextCount();
          demoLog(r);
        }}
      >
        Get Context Count
      </Button>
      <Button
        onPress={async () => {
          const r =
            await backgroundApiProxy.serviceApp.demoGetDbAccountsCount();
          demoLog(r);
        }}
      >
        Get Accounts Count
      </Button>
      <Button
        onPress={async () => {
          const r = await backgroundApiProxy.serviceApp.demoGetDbWalletsCount();
          demoLog(r);
        }}
      >
        Get Wallets Count
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoDbUpdateUUID();
          demoLog(ctx);
        }}
      >
        demoDbUpdateUUID
      </Button>
      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceApp.demoDbUpdateUUIDFixed();
          demoLog(ctx);
        }}
      >
        demoDbUpdateUUIDFixed
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoAddRecord1();
          demoLog(ctx);
        }}
      >
        Add Record
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoRemoveRecord1();
          demoLog(ctx);
        }}
      >
        batch remove Record
      </Button>

      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceApp.demoUpdateCredentialRecord();
          demoLog(ctx);
        }}
      >
        demoUpdateCredentialRecord
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
          <Stack space="$1">
            <LocalDBDemo1 />
          </Stack>
        ),
      },
    ]}
  />
);

export default LocalDBGallery;
