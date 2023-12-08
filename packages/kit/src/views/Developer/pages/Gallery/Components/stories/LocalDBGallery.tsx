import { Button, Stack } from '@onekeyhq/components';

import backgroundApiProxy from '../../../../../../background/instance/backgroundApiProxy';

import { Layout } from './utils/Layout';

function LocalDBDemo1() {
  return (
    <Stack space="$2">
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoGetAllRecords();
          console.log(ctx);
        }}
      >
        demoGetAllRecords
      </Button>
      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceApp.demoGetDbContextWithoutTx();
          console.log(ctx);
        }}
      >
        demoGetDbContextWithoutTx
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoGetDbContext();
          console.log(ctx);
        }}
      >
        Show Context
      </Button>
      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoDbUpdateUUID();
          console.log(ctx);
        }}
      >
        demoDbUpdateUUID
      </Button>
      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceApp.demoDbUpdateUUIDFixed();
          console.log(ctx);
        }}
      >
        demoDbUpdateUUIDFixed
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoAddRecord1();
          console.log(ctx);
        }}
      >
        Add Record
      </Button>

      <Button
        onPress={async () => {
          const ctx = await backgroundApiProxy.serviceApp.demoRemoveRecord1();
          console.log(ctx);
        }}
      >
        batch remove Record
      </Button>

      <Button
        onPress={async () => {
          const ctx =
            await backgroundApiProxy.serviceApp.demoUpdateCredentialRecord();
          console.log(ctx);
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
