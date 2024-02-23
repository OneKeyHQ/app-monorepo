import { Children, cloneElement, useCallback } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

interface ISectionItem extends PropsWithChildren {
  name?: IDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps?: IListItemProps['titleProps'];
}

export function SectionItem({
  name,
  title,
  children,
  titleProps = { color: '$textCritical' },
}: ISectionItem) {
  const [devSetting] = useDevSettingsPersistAtom();
  const child = Children.only(children) as ReactElement;
  const value = name ? devSetting?.settings?.[name] : '';
  const handleChange = useCallback(
    (v: any) => {
      if (name) {
        void backgroundApiProxy.serviceDevSetting.updateDevSetting(name, v);
      }
    },
    [name],
  );
  const field = child
    ? cloneElement(child, {
        ...child.props,
        value,
        onChange: handleChange,
      })
    : null;
  return (
    <ListItem title={title} titleProps={titleProps}>
      {field}
    </ListItem>
  );
}
