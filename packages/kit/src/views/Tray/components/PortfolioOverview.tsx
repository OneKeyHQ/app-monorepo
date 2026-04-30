import BigNumber from 'bignumber.js';

import { Image, SizableText, Stack } from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { ITrayData } from '@onekeyhq/shared/src/types/desktop/tray';
import { AllWalletAvatarImages } from '@onekeyhq/shared/src/utils/avatarUtils';
import type { IAllWalletAvatarImageNamesWithoutDividers } from '@onekeyhq/shared/src/utils/avatarUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { AccountAvatar } from '../../../components/AccountAvatar';

export function PortfolioOverview({
  wallet,
  account,
  totalBalance,
  onPress,
}: {
  wallet: ITrayData['wallet'];
  account: ITrayData['account'];
  totalBalance: ITrayData['totalBalance'];
  onPress: () => void;
}) {
  const change24h = totalBalance.change24h;
  const hasChange = typeof change24h === 'number';
  const isPositive = hasChange && change24h >= 0;
  const changeColor = isPositive ? '$textSuccess' : '$textCritical';
  const changePrefix = isPositive ? '+' : '';

  // BigNumber keeps precision for large balances that would overflow Number.
  const amountBn = new BigNumber(totalBalance.amount || '0');
  const formattedAmount = amountBn.isNaN()
    ? totalBalance.amount
    : amountBn.toFormat(2);
  const currencySymbol = totalBalance.symbol || '$';

  const avatarSource = wallet.avatarImg
    ? AllWalletAvatarImages[
        wallet.avatarImg as IAllWalletAvatarImageNamesWithoutDividers
      ]
    : undefined;
  const hasAccountAvatar = Boolean(
    account.avatar?.address ||
    account.avatar?.indexedAccount ||
    account.avatar?.account ||
    account.avatar?.dbAccount,
  );
  const walletForAvatar =
    wallet.avatarInfo?.img || wallet.avatarImg
      ? ({
          id: wallet.id,
          name: wallet.name,
          type: wallet.type,
          passphraseState: wallet.passphraseState,
          avatarInfo: wallet.avatarInfo ?? { img: wallet.avatarImg },
          firmwareTypeAtCreated: wallet.firmwareTypeAtCreated,
        } as IDBWallet)
      : undefined;

  return (
    <Stack
      padding="$4"
      borderBottomWidth={1}
      borderBottomColor="$borderSubdued"
      onPress={onPress}
      cursor="pointer"
      hoverStyle={{ backgroundColor: '$bgHover' }}
    >
      <Stack flexDirection="row" alignItems="center" marginBottom="$1.5">
        <Stack marginRight="$2.5" flexShrink={0}>
          {hasAccountAvatar ? (
            <AccountAvatar
              size="small"
              borderRadius="$1"
              address={account.avatar?.address}
              indexedAccount={
                account.avatar?.indexedAccount as IDBIndexedAccount | undefined
              }
              account={account.avatar?.account as INetworkAccount | undefined}
              dbAccount={account.avatar?.dbAccount as IDBAccount | undefined}
              wallet={walletForAvatar}
            />
          ) : (
            (() => {
              if (avatarSource) {
                return (
                  <Image
                    source={avatarSource}
                    width={24}
                    height={24}
                    borderRadius={4}
                    flexShrink={0}
                  />
                );
              }
              if (wallet.emoji) {
                return (
                  <SizableText fontSize="$bodyLg" flexShrink={0}>
                    {wallet.emoji}
                  </SizableText>
                );
              }
              return null;
            })()
          )}
        </Stack>
        <Stack flexShrink={1} minWidth={0}>
          <SizableText
            fontSize="$bodySm"
            color="$textSubdued"
            numberOfLines={1}
            ellipsizeMode="tail"
            minWidth={0}
          >
            {wallet.name}
          </SizableText>
          {account.name ? (
            <SizableText
              fontSize="$bodySm"
              color="$textSubdued"
              numberOfLines={1}
              ellipsizeMode="tail"
              minWidth={0}
            >
              {account.name}
            </SizableText>
          ) : null}
        </Stack>
      </Stack>
      <SizableText fontSize="$headingXl" color="$text" fontWeight="600">
        {currencySymbol}
        {formattedAmount}
      </SizableText>
      {hasChange ? (
        <SizableText fontSize="$bodySm" color={changeColor} marginTop="$1">
          {`${changePrefix}${change24h.toFixed(2)}%`}
        </SizableText>
      ) : null}
    </Stack>
  );
}
