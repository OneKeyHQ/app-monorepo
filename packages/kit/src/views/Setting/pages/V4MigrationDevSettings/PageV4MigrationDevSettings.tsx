import { Button, Page, Toast, YStack } from '@onekeyhq/components';
import { useV4migrationPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export default function PageV4MigrationDevSettings() {
  const [_, setV4migrationData] = useV4migrationPersistAtom();
  return (
    <Page scrollEnabled>
      <Page.Header title="V4MigrationDevSettings" />
      <YStack>
        <Button
          onPress={() => {
            console.log('use `Clear App Data` instead');
          }}
        >
          use `Clear App Data` instead
        </Button>

        <Button
          onPress={() => {
            setV4migrationData((v) => ({
              v4migrationAutoStartDisabled: false,
              v4migrationAutoStartCount: 0,
              downgradeWarningConfirmed: false,
            }));
            Toast.message({ title: 'Done, please restart app' });
          }}
        >
          Reset V4 Migration Auto Start Status
        </Button>
      </YStack>
    </Page>
  );
}
