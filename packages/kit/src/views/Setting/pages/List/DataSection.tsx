import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, Input, ListItem } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import { Section } from './Section';

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

const ClearCacheOnApp = () => {
  const onPress = useCallback(() => {
    Dialog.show({
      title: 'Clear cache on App',
      renderContent: <ClearCacheOnAppContent />,
      tone: 'destructive',
    });
  }, []);
  const intl = useIntl();
  return (
    <ListItem
      onPress={onPress}
      icon="BroomOutline"
      title={intl.formatMessage({ id: 'action__clear_all_cache_on_app' })}
    />
  );
};

const CleanCacheOnWebBrowser = () => {
  const onPress = useCallback(() => {
    Dialog.show({
      title: 'Clear cache of web browser',
      description:
        'This will clear sessions, cookies, local storage files of all sites in the web browser.',
      onConfirm: () => {},
      tone: 'destructive',
    });
  }, []);
  const intl = useIntl();
  return (
    <ListItem
      onPress={onPress}
      icon="CompassOutline"
      title={intl.formatMessage({ id: 'action__clear_cache_of_web_browser' })}
    />
  );
};

const EraseData = () => {
  const onPress = useCallback(() => {
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
            <Input autoFocus flex={1} />
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
      },
      onConfirm() {
        backgroundApiProxy.serviceApp.resetApp().catch(console.error);
      },
    });
  }, []);
  const intl = useIntl();
  return (
    <ListItem
      iconProps={{ color: '$textCritical' }}
      onPress={onPress}
      icon="DeleteOutline"
      title={intl.formatMessage({ id: 'action__erase_data' })}
      titleProps={{ color: '$textCritical' }}
    />
  );
};

const DownloadStateLog = () => {
  const onPress = useCallback(() => {}, []);
  const intl = useIntl();
  return (
    <ListItem
      onPress={onPress}
      icon="Document2Outline"
      title={intl.formatMessage({ id: 'content__state_logs' })}
    >
      <ListItem.IconButton
        disabled
        icon="DownloadOutline"
        iconProps={{
          color: '$iconActive',
        }}
      />
    </ListItem>
  );
};

export const DataSection = () => (
  <Section title="DATA">
    <ClearCacheOnApp />
    <CleanCacheOnWebBrowser />
    <DownloadStateLog />
    <EraseData />
  </Section>
);
