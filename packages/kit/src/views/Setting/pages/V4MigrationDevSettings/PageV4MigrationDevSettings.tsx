import { Button, Page, Toast, YStack } from '@onekeyhq/components';
import { useV4migrationPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

export default function PageV4MigrationDevSettings() {
  const [, setV4migrationData] = useV4migrationPersistAtom();
  return (
    <Page scrollEnabled>
      <Page.Header title="V4MigrationDevSettings" />
      <YStack>
        <Button
          testID="setting-page-v4-migration-dev-settings-btn"
          onPress={() => {
            console.log('use `Clear App Data` instead');
          }}
        >
          use `Clear App Data` instead
        </Button>

        <Button
          testID="setting-page-v4-migration-dev-settings-btn"
          onPress={() => {
            setV4migrationData(() => ({
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
