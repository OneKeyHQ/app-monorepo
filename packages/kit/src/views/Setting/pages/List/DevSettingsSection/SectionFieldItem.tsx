import { Children, cloneElement, useCallback } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';

import type { IPropsWithTestId } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IListItemProps } from '@onekeyhq/kit/src/components/ListItem';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IDevSettingsKeys } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

interface ISectionFieldItem extends PropsWithChildren {
  name?: IDevSettingsKeys;
  title: IListItemProps['title'];
  titleProps?: IListItemProps['titleProps'];
  onValueChange?: (v: any) => void;
}

export function SectionFieldItem({
  name,
  title,
  children,
  onValueChange,
  titleProps = { color: '$textCritical' },
  testID = '',
}: IPropsWithTestId<ISectionFieldItem>) {
  const [devSetting] = useDevSettingsPersistAtom();
  const child = Children.only(children) as ReactElement;
  const value = name ? devSetting?.settings?.[name] : '';
  const handleChange = useCallback(
    async (v: any) => {
      if (name) {
        await backgroundApiProxy.serviceDevSetting.updateDevSetting(name, v);
        onValueChange?.(v);
      }
    },
    [name, onValueChange],
  );
  const field = child
    ? cloneElement(child, {
        ...child.props,
        value,
        onChange: handleChange,
      })
    : null;
  return (
    <ListItem title={title} titleProps={titleProps} testID={testID}>
      {field}
    </ListItem>
  );
}
