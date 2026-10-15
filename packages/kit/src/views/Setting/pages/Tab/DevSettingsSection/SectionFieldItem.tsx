import { Children, cloneElement, useCallback, useRef } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';

import type { IPropsWithTestId } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useIdentityExitFlow } from '@onekeyhq/kit/src/components/OneKeyAuth/useIdentityExitFlow';
import type { IDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { useMatchesDevSearch } from './DevSettingsSearchContext';

interface ISectionFieldItem extends PropsWithChildren {
  name?: IDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps?: IListItemProps['titleProps'];
  subtitle?: IListItemProps['subtitle'];
  onValueChange?: (v: any) => void;
  onBeforeValueChange?: () => Promise<void>;
  icon?: IListItemProps['icon'];
  /** Extra keywords for search matching (not displayed) */
  searchKeywords?: string;
}

export function SectionFieldItem({
  name,
  title,
  subtitle,
  children,
  onValueChange,
  titleProps = { color: '$textCritical' },
  testID = '',
  onBeforeValueChange,
  icon,
  searchKeywords,
}: IPropsWithTestId<ISectionFieldItem>) {
  const [devSetting] = useDevSettingsPersistAtom();
  const { run: runIdentityExit } = useIdentityExitFlow();
  const environmentChangeInProgress = useRef(false);
  const matches = useMatchesDevSearch(
    typeof title === 'string' ? title : undefined,
    typeof subtitle === 'string' ? subtitle : undefined,
    searchKeywords,
  );
  const child = Children.only(children) as ReactElement;
  const value = name ? devSetting?.settings?.[name] : '';
  const handleChange = useCallback(
    async (v: any) => {
      if (name) {
        const isEnvironmentChange = name === 'enableTestEndpoint';
        if (isEnvironmentChange) {
          if (
            Boolean(v) === Boolean(value) ||
            environmentChangeInProgress.current
          ) {
            return;
          }
          environmentChangeInProgress.current = true;
        }
        const updateSetting = async () => {
          await backgroundApiProxy.serviceDevSetting.updateDevSetting(name, v);
          onValueChange?.(v);
        };
        try {
          await onBeforeValueChange?.();
          if (isEnvironmentChange) {
            await runIdentityExit(
              { type: 'switchEnvironment', scene: 'devSettings' },
              {
                confirmButtonTestID: 'dev-settings-environment-logout-confirm',
                onCompletedReceipt: updateSetting,
              },
            );
          } else {
            await updateSetting();
          }
        } finally {
          if (isEnvironmentChange) {
            environmentChangeInProgress.current = false;
          }
        }
      }
    },
    [name, onBeforeValueChange, onValueChange, runIdentityExit, value],
  );
  const field = child
    ? cloneElement(child, {
        ...(child.props as any),
        value,
        onChange: handleChange,
      })
    : null;
  if (!matches) return null;
  return (
    <ListItem
      icon={icon}
      title={title}
      subtitle={subtitle}
      titleProps={titleProps}
      testID={testID}
    >
      {field}
    </ListItem>
  );
}
