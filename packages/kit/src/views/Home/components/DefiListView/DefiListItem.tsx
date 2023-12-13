import BigNumber from 'bignumber.js';

import { Icon, ListItem } from '@onekeyhq/components';
import type { IAccountDefi } from '@onekeyhq/shared/types/defi';

type IProps = {
  defi: IAccountDefi;
  onPress?: (defi: IAccountDefi) => void;
};

function DefiListItem(props: IProps) {
  const { defi, onPress } = props;
  return (
    <ListItem
      key={defi.protocolName}
      title={defi.protocolName}
      subtitleProps={{
        numberOfLines: 1,
      }}
      avatarProps={{
        src: defi.logoURI,
        fallbackProps: {
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: <Icon name="ImageMountainSolid" />,
        },
      }}
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$4"
      padding="$4"
      mb="$4"
      onPress={() => onPress?.(defi)}
    >
      <ListItem.Text
        align="right"
        primary={new BigNumber(defi.protocolValue).toFixed(2)}
      />
    </ListItem>
  );
}

export { DefiListItem };
