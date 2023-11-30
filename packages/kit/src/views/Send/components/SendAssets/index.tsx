import { ListItem, Stack } from '@onekeyhq/components';
import type { IToken } from '@onekeyhq/shared/types/token';

type IProps = {
  assets: IToken[];
};

function SendAssets(props: IProps) {
  const { assets } = props;
  const asset = assets[0];
  return (
    <Stack>
      <ListItem
        key={asset.id}
        title={asset.name}
        avatarProps={{
          src: asset.logoURI,
        }}
      />
    </Stack>
  );
}

export { SendAssets };
