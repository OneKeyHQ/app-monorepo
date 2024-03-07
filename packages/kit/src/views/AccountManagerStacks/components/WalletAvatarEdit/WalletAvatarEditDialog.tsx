import { useState } from 'react';

import {
  AnimatePresence,
  Dialog,
  Icon,
  Stack,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { HdWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';

export function WalletAvatarEditDialog({ wallet }: { wallet: IDBWallet }) {
  const { serviceAccount } = backgroundApiProxy;
  const [selectedAvatar, setSelectedAvatar] = useState(wallet?.avatarInfo?.img);

  return (
    <>
      <XStack flexWrap="wrap">
        {HdWalletAvatarImageNames.map((img) => (
          <Stack
            justifyContent="center"
            alignItems="center"
            flexBasis="25%"
            py="$2"
            animation="quick"
            hoverStyle={{
              scale: 1.1,
            }}
            pressStyle={{
              scale: 0.9,
            }}
            onPress={() => {
              setSelectedAvatar(img);
            }}
          >
            <WalletAvatar size="$12" img={img} wallet={undefined} />
            <AnimatePresence>
              {selectedAvatar === img && (
                <Stack
                  position="absolute"
                  zIndex="$1"
                  right="$4"
                  bottom="$1"
                  p="$px"
                  bg="$bg"
                  borderRadius="$full"
                  enterStyle={{
                    opacity: 0,
                    scale: 0,
                  }}
                  exitStyle={{
                    opacity: 0,
                    scale: 0,
                  }}
                >
                  <Icon size="$5" color="$iconActive" name="CheckRadioSolid" />
                </Stack>
              )}
            </AnimatePresence>
          </Stack>
        ))}
      </XStack>
      <Dialog.Footer
        onConfirm={async () => {
          if (!wallet?.id || !selectedAvatar) {
            return;
          }
          await serviceAccount.setWalletNameAndAvatar({
            walletId: wallet?.id,
            avatar: {
              img: selectedAvatar,
            },
          });
        }}
      />
    </>
  );
}

export function showWalletAvatarEditDialog({ wallet }: { wallet: IDBWallet }) {
  Dialog.show({
    title: 'Edit Avatar',
    estimatedContentHeight: 340,
    renderContent: <WalletAvatarEditDialog wallet={wallet} />,
  });
}
