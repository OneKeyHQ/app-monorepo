import { memo, useCallback } from 'react';
import type { ReactNode } from 'react';

import { Skeleton, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

function AccountAvatarWithWallet({
  address,
  walletId,
}: {
  address: string;
  walletId?: string;
}) {
  const { result: wallet } = usePromiseResult(
    async () => {
      if (!walletId) return undefined;
      const w = await backgroundApiProxy.serviceAccount.getWallet({ walletId });
      return w;
    },
    [walletId],
    { initResult: undefined },
  );

  return <AccountAvatar size="default" address={address} wallet={wallet} />;
}

const MemoizedAccountAvatarWithWallet = memo(
  AccountAvatarWithWallet,
  (prev, next) =>
    prev.address === next.address && prev.walletId === next.walletId,
);

type IQuickSelectListItemFrameProps = {
  address: string;
  walletId?: string;
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
  onPress,
  onLongPress,
  onHoverIn,
  onHoverOut,
  testID,
  primary,
  secondary,
  trailing,
}: IQuickSelectListItemFrameProps) {
  const renderAvatar = useCallback(
    () => (
      <MemoizedAccountAvatarWithWallet address={address} walletId={walletId} />
    ),
    [address, walletId],
  );

  return (
    <ListItem
      px="$5"
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
