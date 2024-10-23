import { useEffect, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Accordion,
  Icon,
  Page,
  SizableText,
  Skeleton,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { AccountAvatar } from '@onekeyhq/kit/src/components/AccountAvatar';
import type { IWalletAvatarProps } from '@onekeyhq/kit/src/components/WalletAvatar';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { GestureResponderEvent } from 'react-native';

type IDBWalletExtended = Omit<
  IDBWallet,
  'accounts' | 'backuped' | 'type' | 'nextIds' | 'walletNo' | 'hiddenWallets'
> & {
  img: IWalletAvatarProps['img'];
  enabled: boolean;
  accounts: {
    address: string;
    name: string;
    enabled: boolean;
  }[];
  hiddenWallets?: IDBWalletExtended[];
};

const MOCK_DATA: IDBWalletExtended[] = [
  {
    id: 'hd-1',
    name: 'App wallet',
    img: 'bear',
    enabled: true,
    accounts: [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Account #1',
        enabled: true,
      },
      {
        address: '0xabcdef0123456789abcdef0123456789abcdef01',
        name: 'Account #2',
        enabled: true,
      },
      {
        address: '0x9876543210987654321098765432109876543210',
        name: 'Account #3',
        enabled: false,
      },
    ],
  },
  {
    id: 'hw-1',
    name: 'App wallet',
    img: 'pro',
    enabled: true,
    accounts: [
      {
        address: '0xfedcba9876543210fedcba9876543210fedcba98',
        name: 'Account #1',
        enabled: true,
      },
      {
        address: '0x0123456789abcdef0123456789abcdef01234567',
        name: 'Account #2',
        enabled: true,
      },
    ],
    hiddenWallets: [
      {
        id: 'hw-1-1',
        name: 'Hidden #1',
        img: 'bear',
        enabled: true,
        passphraseState: 'enabled',
        accounts: [
          {
            address: '0x1234567890123456789012345678901234567890',
            name: 'Account #1',
            enabled: true,
          },
          {
            address: '0xabcdef0123456789abcdef0123456789abcdef01',
            name: 'Account #2',
            enabled: true,
          },
          {
            address: '0x9876543210987654321098765432109876543210',
            name: 'Account #3',
            enabled: false,
          },
        ],
      },
    ],
  },
  {
    id: 'watched',
    name: 'Watched',
    img: 'othersWatching',
    enabled: false,
    accounts: [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'Account #1',
        enabled: true,
      },
      {
        address: '0xabcdef0123456789abcdef0123456789abcdef01',
        name: 'Account #2',
        enabled: true,
      },
    ],
  },
];

function AccordionItem({ wallet }: { wallet: IDBWalletExtended }) {
  const [isWalletEnabled, setIsWalletEnabled] = useState(wallet.enabled);

  // prevent event bubbling
  const handleWalletSwitchPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
  };

  // handle switch change
  const handleWalletSwitchChange = () => {
    setIsWalletEnabled((prev) => !prev);
  };

  return (
    <Accordion.Item value={isWalletEnabled ? wallet.id : 'closedThisItem'}>
      <Accordion.Trigger
        unstyled
        flexDirection="row"
        alignItems="center"
        gap="$3"
        py="$2"
        px="$5"
        bg="$transparent"
        borderWidth={0}
        disabled={!isWalletEnabled}
        {...(isWalletEnabled && {
          hoverStyle: {
            bg: '$bgHover',
          },
          pressStyle: {
            bg: '$bgActive',
          },
          focusVisibleStyle: {
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineStyle: 'solid',
            outlineOffset: 0,
          },
        })}
      >
        {({ open }: { open: boolean }) => (
          <>
            <XStack
              animation="quick"
              flex={1}
              alignItems="center"
              gap="$3"
              opacity={isWalletEnabled ? 1 : 0.5}
            >
              <YStack animation="quick" rotate={open ? '180deg' : '0deg'}>
                <Icon
                  name="ChevronBottomOutline"
                  color={open ? '$iconActive' : '$iconSubdued'}
                />
              </YStack>
              <WalletAvatar
                img={wallet.img}
                wallet={wallet as IDBWallet & Partial<IDBWalletExtended>}
              />
              <XStack gap="$1">
                <SizableText flex={1} size="$bodyLgMedium">
                  {wallet.name}
                </SizableText>
                <SizableText>
                  (
                  {
                    wallet.accounts.filter(
                      ({ enabled: accountEnabled }) => accountEnabled,
                    ).length
                  }
                  /{wallet.accounts.length})
                </SizableText>
              </XStack>
            </XStack>
            <Switch
              value={isWalletEnabled}
              onChange={handleWalletSwitchChange}
              onPress={handleWalletSwitchPress}
            />
          </>
        )}
      </Accordion.Trigger>

      <Accordion.HeightAnimator animation="quick">
        <Accordion.Content
          unstyled
          bg="$transparent"
          animation="quick"
          exitStyle={{
            opacity: 0,
          }}
        >
          {wallet.accounts.map((account) => (
            <XStack
              key={account.address}
              gap="$3"
              alignItems="center"
              pl={56}
              pr="$5"
              py="$2"
            >
              <AccountAvatar address={account.address} />
              <SizableText flex={1} size="$bodyLgMedium">
                {account.name}
              </SizableText>
              <Switch value={account.enabled} />
            </XStack>
          ))}
        </Accordion.Content>
      </Accordion.HeightAnimator>
    </Accordion.Item>
  );
}

function LoadingView({ show }: { show: boolean }) {
  return (
    <Skeleton.Group show={show}>
      {Array.from({ length: 3 }).map((_, index) => (
        <XStack key={index} alignItems="center" px="$5" py="$2" gap="$3">
          <Icon name="ChevronBottomOutline" color="$neutral4" />
          <Skeleton w="$10" h="$10" radius={8} />
          <Skeleton.BodyLg />
          <Switch ml="auto" disabled />
        </XStack>
      ))}
    </Skeleton.Group>
  );
}

function ManageAccountActivity() {
  // fake loading
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }, []);

  return (
    <Page>
      <Page.Header title="Manage" />
      <Page.Body>
        {isLoading ? (
          <LoadingView show={isLoading} />
        ) : (
          <Accordion type="single" collapsible defaultValue={MOCK_DATA[0].id}>
            {MOCK_DATA.map((wallet, index) => (
              <YStack
                key={wallet.id}
                {...(index !== 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: '$borderSubdued',
                })}
              >
                <AccordionItem wallet={wallet} />
                {/* render items for */}
                {wallet.hiddenWallets?.map((hiddenWallet) => (
                  <AccordionItem key={hiddenWallet.id} wallet={hiddenWallet} />
                ))}
              </YStack>
            ))}
          </Accordion>
        )}
      </Page.Body>
    </Page>
  );
}

export default ManageAccountActivity;
