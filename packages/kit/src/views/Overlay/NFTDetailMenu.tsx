import type { FC } from 'react';
import { useMemo } from 'react';

import type { ICON_NAMES } from '@onekeyhq/components';

import BaseMenu from './BaseMenu';

import type { IMenu } from './BaseMenu';
import type { MessageDescriptor } from 'react-intl';

const NFTDetailMenu: FC<IMenu & { onCollectToTouch: () => void }> = (props) => {
  const { onCollectToTouch } = props;
  const options: (
    | {
        id: MessageDescriptor['id'];
        onPress: () => void;
        icon: ICON_NAMES;
      }
    | false
    | undefined
  )[] = useMemo(
    () => [
      {
        id: 'action__collect_to_touch',
        onPress: () => {
          onCollectToTouch();
        },
        icon: 'InboxArrowDownMini',
      },
    ],
    [onCollectToTouch],
  );

  return <BaseMenu options={options} {...props} />;
};

export default NFTDetailMenu;
