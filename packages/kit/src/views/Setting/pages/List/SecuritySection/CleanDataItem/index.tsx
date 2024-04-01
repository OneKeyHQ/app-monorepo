import {
  ActionList,
  Checkbox,
  Dialog,
  Stack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useResetApp } from '@onekeyhq/kit/src/views/Setting/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IClearCacheOnAppState } from '@onekeyhq/shared/types/setting';

const ClearCacheOnAppContent = () => (
  <Dialog.Form
    formProps={{
      defaultValues: {
        tokenAndNFT: true,
        transactionHistory: true,
        swapHistory: true,
        browserCache: true,
        browserHistory: false,
        connectSites: false,
      },
    }}
  >
    <Stack>
      <Dialog.FormField name="tokenAndNFT">
        <Checkbox label="Token & NFT Data" />
      </Dialog.FormField>
      <Dialog.FormField name="transactionHistory">
        <Checkbox label="Transaction History" />
      </Dialog.FormField>
      <Dialog.FormField name="swapHistory">
        <Checkbox label="Swap History" />
      </Dialog.FormField>
      <Dialog.FormField name="browserCache">
        <Checkbox label="Browser Cache" />
      </Dialog.FormField>
      <Dialog.FormField name="browserHistory">
        <Checkbox label="Browser History, Bookmarks, Pins" />
      </Dialog.FormField>
      <Dialog.FormField name="connectSites">
        <Checkbox label="Connected Sites" />
      </Dialog.FormField>
    </Stack>
  </Dialog.Form>
);

export const CleanDataItem = () => {
  const { copyText } = useClipboard();
  const resetApp = useResetApp();
  return (
    <ActionList
      title="Clear Data"
      renderTrigger={
        <ListItem
          title="Clear Data"
          icon="FolderDeleteOutline"
          testID="setting-clear-data"
        >
          <ListItem.DrillIn name="ChevronDownSmallOutline" />
        </ListItem>
      }
      items={[
        {
          label: 'Clear Cache on App',
          onPress: () => {
            Dialog.show({
              title: 'Clear cache on App',
              renderContent: <ClearCacheOnAppContent />,
              tone: 'destructive',
              confirmButtonProps: {
                disabledOn: ({ getForm }) => {
                  const { getValues } = getForm() || {};
                  if (getValues) {
                    const values = getValues();
                    return !Object.values(values).some((o) => Boolean(o));
                  }
                  return true;
                },
              },
              onConfirm: async (dialogInstance) => {
                const values = dialogInstance.getForm()?.getValues() as
                  | IClearCacheOnAppState
                  | undefined;
                if (values) {
                  await backgroundApiProxy.serviceSetting.clearCacheOnApp(
                    values,
                  );
                  if (
                    values?.browserCache &&
                    (platformEnv.isWeb || platformEnv.isExtension)
                  ) {
                    Dialog.show({
                      title: 'Clear Browser Cache',
                      description: `Open this link in the browser to continue clearing.
                    chrome://settings/clearBrowserData`,
                      onConfirm: () => {
                        copyText('chrome://settings/clearBrowserData');
                      },
                      showCancelButton: false,
                      confirmButtonProps: {
                        variant: 'primary',
                        size: 'large',
                        icon: 'Copy1Outline',
                      },
                    });
                  }
                }
              },
            });
          },
        },
        {
          label: 'Clear Pending Transactions',
          onPress: () => {
            Dialog.show({
              title: 'Clear Pending Transactions',
              description:
                'Clear the pending data in the local history record.',
              tone: 'destructive',
              onConfirmText: 'Clear',
              onConfirm: () => {
                void backgroundApiProxy.serviceSetting.clearPendingTransaction();
              },
            });
          },
        },
        {
          label: 'Reset App',
          destructive: true,
          onPress: resetApp,
          testID: 'setting-erase-data',
        },
      ]}
    />
  );
};
