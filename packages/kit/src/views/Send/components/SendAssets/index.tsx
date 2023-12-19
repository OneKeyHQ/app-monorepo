import { Icon, ListItem, Stack } from '@onekeyhq/components';
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
        title={asset.name}
        avatarProps={{
          src: asset.logoURI,
          fallbackProps: {
            bg: '$bgStrong',
            justifyContent: 'center',
            alignItems: 'center',
            children: <Icon name="ImageMountainSolid" />,
          },
        }}
      />
    </Stack>
  );
}

export { SendAssets };
