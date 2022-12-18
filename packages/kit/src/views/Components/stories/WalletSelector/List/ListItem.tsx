import type { ComponentProps, FC } from 'react';

import { Badge, Box, IconButton, Pressable, Text } from '@onekeyhq/components';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';

type ListItemProps = {
  name?: string;
  NumberOfAccounts?: string;
} & ComponentProps<typeof WalletAvatar>;

const defaultProps = {
  name: 'Untitled Wallet',
} as const;

const SelectedIndicator = () => (
  <Box
    position="absolute"
    left="-8px"
    top="8px"
    h="48px"
    w="3px"
    bgColor="interactive-default"
    roundedRight="full"
  />
);

const RightContent: FC<Partial<ListItemProps>> = ({
  walletImage,
  NumberOfAccounts,
  circular,
}) => (
  <>
    {walletImage === 'imported' ||
    walletImage === 'watching' ||
    walletImage === 'external' ? (
      <Badge title={NumberOfAccounts || '0'} size="sm" mr={2} />
    ) : (
      <IconButton name="EllipsisVerticalMini" circle type="plain" />
    )}
    {!circular ? <SelectedIndicator /> : undefined}
  </>
);

const ListItem: FC<ListItemProps> = ({
  name,
  circular,
  walletImage,
  hwWalletType,
  avatarBgColor,
  status,
  isPassphrase,
  NumberOfAccounts,
}) => (
  <Pressable
    p={2}
    flexDirection="row"
    alignItems="center"
    rounded="2xl"
    _hover={{ bgColor: 'surface-hovered' }}
    _pressed={{ bgColor: 'surface-pressed' }}
  >
    <WalletAvatar
      size="lg"
      walletImage={walletImage}
      hwWalletType={hwWalletType}
      avatarBgColor={avatarBgColor}
      circular={circular}
      status={status}
      isPassphrase={isPassphrase}
    />
    <Text flex={1} mx={3} typography="Body1Strong" isTruncated>
      {name}
    </Text>
    <RightContent
      walletImage={walletImage}
      NumberOfAccounts={NumberOfAccounts}
      circular={circular}
    />
    {!circular ? <SelectedIndicator /> : undefined}
  </Pressable>
);

ListItem.defaultProps = defaultProps;

export default ListItem;
