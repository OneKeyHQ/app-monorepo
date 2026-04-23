import { memo, useCallback } from 'react';
import type { ReactNode } from 'react';

import { Skeleton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

function AccountAvatarWithWallet({
  address,
  walletId,
  wallet,
}: {
  address: string;
  walletId?: string;
  wallet?: IDBWallet;
}) {
  const { result: resolvedWallet } = usePromiseResult(
    async () => {
      if (wallet) {
        return wallet;
      }
      if (!walletId) return undefined;
      const w = await backgroundApiProxy.serviceAccount.getWallet({ walletId });
      return w;
    },
    [wallet, walletId],
    { initResult: wallet },
  );

  return (
    <AccountAvatar size="default" address={address} wallet={resolvedWallet} />
  );
}

const MemoizedAccountAvatarWithWallet = memo(
  AccountAvatarWithWallet,
  (prev, next) =>
    prev.address === next.address &&
    prev.walletId === next.walletId &&
    prev.wallet?.id === next.wallet?.id,
);

type IQuickSelectListItemFrameProps = {
  address: string;
  walletId?: string;
  wallet?: IDBWallet;
  customRenderAvatar?: () => ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  onHoverIn?: () => void;
  onHoverOut?: () => void;
  testID?: string;
  primary: ReactNode;
  secondary: ReactNode;
  trailing?: ReactNode;
};

function QuickSelectListItemFrame({
  address,
  walletId,
  wallet,
  customRenderAvatar,
  onPress,
  onLongPress,
  onHoverIn,
  onHoverOut,
  testID,
  primary,
  secondary,
  trailing,
}: IQuickSelectListItemFrameProps) {
  const defaultRenderAvatar = useCallback(
    () => (
      <MemoizedAccountAvatarWithWallet
        address={address}
        walletId={walletId}
        wallet={wallet}
      />
    ),
    [address, wallet, walletId],
  );
  const renderAvatar = customRenderAvatar ?? defaultRenderAvatar;

  return (
    <ListItem
      mx="$2.5"
      pl="$2"
      pr="$4"
      py="$3"
      renderAvatar={renderAvatar}
      onPress={onPress}
      onLongPress={onLongPress}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      testID={testID}
    >
      <ListItem.Text
        flexGrow={1}
        flexBasis={0}
        primaryTextProps={{ userSelect: 'none' }}
        secondaryTextProps={{ userSelect: 'none' }}
        primary={primary}
        secondary={secondary}
      />
      {trailing}
    </ListItem>
  );
}

const MemoizedQuickSelectListItemFrame = memo(QuickSelectListItemFrame);

function QuickSelectListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Stack>
      {Array.from({ length: count }).map((_, index) => (
        <ListItem
          key={index}
          px="$5"
          py="$3"
          renderAvatar={() => (
            <Skeleton width="$10" height="$10" borderRadius="$2" bg="$bgApp" />
          )}
        >
          <ListItem.Text
            primary={<Skeleton height={18} width="50%" bg="$bgApp" />}
            secondary={<Skeleton height={14} width="70%" bg="$bgApp" />}
          />
        </ListItem>
      ))}
    </Stack>
  );
}

export { MemoizedQuickSelectListItemFrame as QuickSelectListItemFrame };
export { QuickSelectListSkeleton };
