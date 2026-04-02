import type { ComponentProps, FC } from 'react';
import { useCallback } from 'react';

import { Icon } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

type IUrlExternalListItemProps = {
  icon: ComponentProps<typeof ListItem>['icon'];
  title: string;
  url: string;
};

export const UrlExternalListItem: FC<IUrlExternalListItemProps> = ({
  icon,
  title,
  url,
}) => {
  const onPress = useCallback(() => {
    openUrlExternal(url);
  }, [url]);
  return (
    <ListItem onPress={onPress} icon={icon} title={title} drillIn={false}>
      <Icon name="ArrowTopRightOutline" size="$5" color="$iconSubdued" />
    </ListItem>
  );
};
