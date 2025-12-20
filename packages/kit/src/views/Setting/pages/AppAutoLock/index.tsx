import { useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Divider,
  ESwitchSize,
  Page,
  SizableText,
  Stack,
  Switch,
  YStack,
  startViewTransition,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  usePasswordPersistAtom,
  useSystemIdleLockSupport,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/password';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ListItemSelect } from '../../components/ListItemSelect';

import { useOptions } from './useOptions';

const EnableSystemIdleTimeItem = ({
  useLocalState,
  localStateSelectedValue,
}: {
  useLocalState?: boolean;
  localStateSelectedValue?: string;
}) => {
  const intl = useIntl();
  const [{ enableSystemIdleLock }] = usePasswordPersistAtom();
  const [supportSystemIdle] = useSystemIdleLockSupport();

  const switchValue = useMemo(() => {
    if (useLocalState) {
      if (
        localStateSelectedValue === ELockDuration.Always ||
        localStateSelectedValue === ELockDuration.Never
      ) {
        return false;
      }
      return enableSystemIdleLock;
    }
    return supportSystemIdle ? enableSystemIdleLock : false;
  }, [
    useLocalState,
    supportSystemIdle,
    enableSystemIdleLock,
    localStateSelectedValue,
  ]);

  const switchDisabled = useMemo(() => {
    if (useLocalState) {
      return true;
    }
    return !supportSystemIdle;
  }, [useLocalState, supportSystemIdle]);

  return (
    <YStack>
      <Divider mx="$5" />
      <ListItem
        disabled={switchDisabled}
        title={intl.formatMessage({
          id: ETranslations.settings_system_idle_lock,
        })}
      >
        <Switch
          size={ESwitchSize.small}
          disabled={switchDisabled}
          value={switchValue}
          onChange={(checked) => {
            startViewTransition(async () => {
              await backgroundApiProxy.servicePassword.setEnableSystemIdleLock(
                checked,
              );
            });
          }}
        />
      </ListItem>
      <Stack px="$5">
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.settings_system_idle_lock_desc,
          })}
        </SizableText>
      </Stack>
    </YStack>
  );
};

const AutoLockDurationDescription = () => {
  const intl = useIntl();
  let text = intl.formatMessage({
    id: ETranslations.settings_set_auto_lock_duration_desktop,
  });
  if (platformEnv.isExtension) {
    text = intl.formatMessage({
      id: ETranslations.settings_set_auto_lock_duration_extension,
    });
  } else if (platformEnv.isWeb) {
    text = intl.formatMessage({
      id: ETranslations.settings_set_auto_lock_duration_web,
    });
  } else if (platformEnv.isNative) {
    text = intl.formatMessage({
      id: ETranslations.settings_set_auto_lock_duration_mobile,
    });
  }
  return (
    <Stack px="$5" pb="$5">
      <SizableText size="$bodySm" color="$textSubdued">
        {text}
      </SizableText>
    </Stack>
  );
};

export function AppAutoLockSettingsView({
  disableCloudSyncDisallowedOptions,
  useLocalState,
  onValueChange,
}: {
  disableCloudSyncDisallowedOptions?: boolean;
  useLocalState?: boolean;
  onValueChange?: (value: string) => void;
} = {}) {
  const [localStateSelectedValue, setLocalStateSelectedValue] =
    useState<string>('');
  const [passwordSettings] = usePasswordPersistAtom();

  useEffect(() => {
    if (
      useLocalState &&
      localStateSelectedValue === '' &&
      passwordSettings.appLockDuration
    ) {
      setLocalStateSelectedValue(String(passwordSettings.appLockDuration));
    }
  }, [
    useLocalState,
    passwordSettings.appLockDuration,
    localStateSelectedValue,
    onValueChange,
  ]);

  useEffect(() => {
    if (useLocalState && onValueChange) {
      onValueChange?.(localStateSelectedValue);
    }
  }, [useLocalState, localStateSelectedValue, onValueChange]);

  const onChange = useCallback(
    async (value: string) => {
      if (useLocalState) {
        setLocalStateSelectedValue(value);
        return;
      }
      startViewTransition(async () => {
        await backgroundApiProxy.servicePassword
          .setAppLockDuration(Number(value))
          .catch(() => console.log('failed to set app lock duration'));
      });
    },
    [useLocalState],
  );
  const options = useOptions({
    disableCloudSyncDisallowedOptions,
  });
  return (
    <Stack>
      <Stack py="$2">
        <ListItemSelect
          onChange={onChange}
          value={
            useLocalState
              ? localStateSelectedValue
              : String(passwordSettings.appLockDuration)
          }
          options={options}
        />
      </Stack>
      <AutoLockDurationDescription />
      {platformEnv.isExtension || platformEnv.isDesktop ? (
        <EnableSystemIdleTimeItem
          useLocalState={useLocalState}
          localStateSelectedValue={localStateSelectedValue}
        />
      ) : null}
    </Stack>
  );
}

const AppAutoLock = () => {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.settings_auto_lock })}
      />
      <Page.Body>
        <AppAutoLockSettingsView />
      </Page.Body>
    </Page>
  );
};

export default AppAutoLock;
