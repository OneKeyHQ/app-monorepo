import { useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  AnimatePresence,
  Dialog,
  Icon,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_TRANSFORM } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { WalletAvatar } from '@onekeyhq/kit/src/components/WalletAvatar';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { HdWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';

import {
  AVATAR_COLUMNS,
  AVATAR_ROW_HEIGHT,
  getAvatarGridHeight,
} from './walletAvatarGridLayout';

export function WalletAvatarEditDialog({ wallet }: { wallet: IDBWallet }) {
  const intl = useIntl();
  const { serviceAccount } = backgroundApiProxy;
  const [selectedAvatar, setSelectedAvatar] = useState(wallet?.avatarInfo?.img);
  // Follows the window, so resizing it with the dialog open keeps the
  // footer on screen.
  const { height: windowHeight } = useWindowDimensions();
  const gridHeight = getAvatarGridHeight({
    avatarCount: HdWalletAvatarImageNames.length,
    windowHeight,
  });

  return (
    <>
      <Dialog.ScrollView maxHeight={gridHeight} mx="$-5" px="$5">
        <XStack flexWrap="wrap">
          {HdWalletAvatarImageNames.map((img, index) => (
            <Stack
              key={index}
              justifyContent="center"
              alignItems="center"
              flexBasis={`${100 / AVATAR_COLUMNS}%`}
              h={AVATAR_ROW_HEIGHT}
              transition="quick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
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
              <Stack>
                <WalletAvatar size="$11" img={img} wallet={undefined} />
                <AnimatePresence>
                  {selectedAvatar === img ? (
                    <Stack
                      position="absolute"
                      zIndex="$1"
                      right={-4}
                      bottom={-4}
                      p="$px"
                      bg="$bg"
                      borderRadius="$full"
                      enterStyle={
                        platformEnv.isNativeAndroid
                          ? undefined
                          : {
                              opacity: 0,
                              scale: 0,
                            }
                      }
                      exitStyle={
                        platformEnv.isNativeAndroid
                          ? undefined
                          : {
                              opacity: 0,
                              scale: 0,
                            }
                      }
                    >
                      <Icon
                        size="$5"
                        color="$iconActive"
                        name="CheckRadioSolid"
                      />
                    </Stack>
                  ) : null}
                </AnimatePresence>
              </Stack>
            </Stack>
          ))}
        </XStack>
      </Dialog.ScrollView>
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
    // eslint-disable-next-line onekey/no-app-locale-main-thread
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_edit_avatar,
    }),
    // No estimatedContentHeight: native would fix the content at its height
    // on open, so shrinking the window would push the footer out of the
    // sheet. Without it the content follows the grid.
    renderContent: <WalletAvatarEditDialog wallet={wallet} />,
  });
}
