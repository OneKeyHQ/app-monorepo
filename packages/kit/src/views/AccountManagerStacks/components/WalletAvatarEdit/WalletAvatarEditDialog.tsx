import { useState } from 'react';

import { useIntl } from 'react-intl';

import {
  AnimatePresence,
  Dialog,
  Icon,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { HdWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';

export function WalletAvatarEditDialog({ wallet }: { wallet: IDBWallet }) {
  const intl = useIntl();
  const { serviceAccount } = backgroundApiProxy;
  const [selectedAvatar, setSelectedAvatar] = useState(wallet?.avatarInfo?.img);

  return (
    <>
      <XStack flexWrap="wrap">
        {HdWalletAvatarImageNames.map((img, index) => (
          <Stack
            key={index}
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
              {selectedAvatar === img ? (
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
              ) : null}
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
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.feedback_change_saved,
            }),
          });
        }}
      />
    </>
  );
}

export function showWalletAvatarEditDialog({ wallet }: { wallet: IDBWallet }) {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_edit_avatar,
    }),
    estimatedContentHeight: 276,
    renderContent: <WalletAvatarEditDialog wallet={wallet} />,
  });
}
