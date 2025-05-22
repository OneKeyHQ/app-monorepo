import { Image } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { isGoogleSearchItem } from '@onekeyhq/shared/src/consts/discovery';
import type { IUniversalSearchDapp } from '@onekeyhq/shared/types/search';

interface IUniversalSearchDappItemProps {
  item: IUniversalSearchDapp;
  onPress: () => void;
}

export function UniversalSearchDappItem({
  item,
  onPress,
}: IUniversalSearchDappItemProps) {
  const { name, dappId, logo } = item.payload;
  const isGoogle = isGoogleSearchItem(dappId);

  return (
    <ListItem
      onPress={onPress}
      renderAvatar={<Image source={{ uri: logo }} size="$10" />}
      title={name}
      titleProps={{
        color: isGoogle ? '$textSubdued' : '$text',
      }}
    />
  );
}
