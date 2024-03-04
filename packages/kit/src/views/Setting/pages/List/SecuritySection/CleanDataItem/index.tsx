import { useCallback, useState } from 'react';

import { ActionList, Checkbox, Dialog, Input } from '@onekeyhq/components';
import type { ICheckedState } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

const ClearCacheOnAppContent = () => {
  const [val, setVal] = useState<ICheckedState[]>([
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  const onChange = useCallback(
    (current: boolean, index: number) => {
      const data = [...val];
      data[index] = current;
      setVal(data);
    },
    [val, setVal],
  );
  return (
    <>
      <Checkbox
        label="Transaction History"
        value={val[0]}
        onChange={(value) => onChange(value as boolean, 0)}
      />
      <Checkbox
        label="Swap History"
        value={val[1]}
        onChange={(value) => onChange(value as boolean, 1)}
      />
      <Checkbox
        label="Token & NFT Data"
        value={val[2]}
        onChange={(value) => onChange(value as boolean, 2)}
      />
      <Checkbox
        label="Market Data"
        value={val[3]}
        onChange={(value) => onChange(value as boolean, 3)}
      />
      <Checkbox
        label="Connected Sites"
        value={val[4]}
        onChange={(value) => onChange(value as boolean, 4)}
      />
      <Checkbox
        label="Explore"
        value={val[5]}
        onChange={(value) => onChange(value as boolean, 5)}
      />
    </>
  );
};

export const CleanDataItem = () => (
  <ActionList
    title="Clear Data"
    renderTrigger={
      <ListItem title="Clear Data" icon="FolderDeleteOutline">
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
          });
        },
      },
      {
        label: 'Clear Pending Transactions',
        onPress: () => {
          Dialog.show({
            title: 'Clear Pending Transactions',
            description: 'Clear the pending data in the local history record.',
            tone: 'destructive',
            onConfirmText: 'Clear',
          });
        },
      },
      {
        label: 'Reset App',
        destructive: true,
        onPress: () => {
          Dialog.show({
            title: 'Erase all data',
            icon: 'ErrorOutline',
            tone: 'destructive',
            description:
              'This will delete all the data you have created on OneKey. After making sure that you have a proper backup, enter "ERASE" to reset the App',
            renderContent: (
              <Dialog.Form
                formProps={{
                  defaultValues: { text: '' },
                }}
              >
                <Dialog.FormField name="text">
                  <Input autoFocus flex={1} testID="erase-data-input" />
                </Dialog.FormField>
              </Dialog.Form>
            ),
            confirmButtonProps: {
              disabledOn: ({ getForm }) => {
                const { getValues } = getForm() || {};
                if (getValues) {
                  const { text } = getValues();
                  return text !== 'ERASE';
                }
                return true;
              },
              testID: 'erase-data-confirm',
            },
            onConfirm() {
              void backgroundApiProxy.serviceApp.resetApp();
            },
          });
        },
      },
    ]}
  />
);
