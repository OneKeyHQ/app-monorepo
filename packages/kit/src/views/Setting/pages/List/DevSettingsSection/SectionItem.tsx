import { Children, cloneElement, useCallback } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';

import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';

interface ISectionItem extends PropsWithChildren {
  name: IDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps: IListItemProps['titleProps'];
}

export function SectionItem({
  name,
  title,
  titleProps,
  children,
}: ISectionItem) {
  const [devSetting] = useDevSettingsPersistAtom();
  const child = Children.only(children) as ReactElement;
  const value = devSetting?.settings?.[name];
  const handleChange = useCallback(
    (v: any) => {
      void backgroundApiProxy.serviceDevSetting.updateDevSetting(name, v);
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
