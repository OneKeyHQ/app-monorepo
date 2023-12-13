import { useState } from 'react';

import { AnimatePresence, useMedia } from 'tamagui';

import {
  Dialog,
  Form,
  Icon,
  IconButton,
  Input,
  ListItem,
  Stack,
  XStack,
  useForm,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  WalletAvatar,
  WalletAvatarImages,
} from '../../WalletList/WalletAvatar';

import type { IWalletDetailsProps } from '..';
import type { IWalletAvatarProps } from '../../WalletList/WalletAvatar';

const avatarData: IWalletAvatarProps['img'][] = [
  'classic', // classic, mini, touch or pro
  'monkey',
  'dog',
  'wolf',
  'fox',
  'raccoon',
  'cat',
  'frog',
  'lion',
  'tiger',
  'cow',
  'rabbit',
  'bear',
  'polarBear',
  'koala',
  'panda',
  'pig',
];

export function WalletProfile({
  wallet,
}: {
  wallet: IWalletDetailsProps['wallet'];
}) {
  const media = useMedia();
  const form = useForm({
    values: {
      walletName: wallet?.name,
    },
  });

  const [selectedAvatar, setSelectedAvatar] = useState(wallet?.img);

  return (
    <ListItem
      avatarProps={{
        source: wallet?.img ? WalletAvatarImages[wallet?.img] : undefined,
        cornerIconProps: {
          name: 'MenuCircleHorSolid',
          containerProps: {
            animation: 'quick',
            hitSlop: platformEnv.isNative
              ? { top: 16, left: 16, right: 16, bottom: 16 }
              : undefined,
            hoverStyle: {
              scale: 1.25,
            },
            onPress: () =>
              Dialog.show({
                title: 'Edit Avatar',
                estimatedContentHeight: 340,
                renderContent: (
                  <XStack flexWrap="wrap">
                    {avatarData.map((img) => (
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
                        <WalletAvatar size="$12" img={img} />
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
                              <Icon
                                size="$5"
                                color="$iconActive"
                                name="CheckRadioSolid"
                              />
                            </Stack>
                          )}
                        </AnimatePresence>
                      </Stack>
                    ))}
                  </XStack>
                ),
              }),
          },
        },
      }}
    >
      <ListItem.Text primary={wallet?.name} />
      <IconButton
        title="Rename"
        icon="PencilOutline"
        size="small"
        variant="tertiary"
        $platform-native={{
          hitSlop: { top: 8, left: 8, right: 8, bottom: 8 },
        }}
        onPress={() =>
          Dialog.show({
            title: 'Rename',
            renderContent: (
              <Form form={form}>
                <Form.Field
                  name="walletName"
                  {...(wallet?.type === 'hw' && {
                    description:
                      'Also change the label displayed on your device',
                  })}
                >
                  <Input size={media.gtMd ? 'medium' : 'large'} autoFocus />
                </Form.Field>
              </Form>
            ),
          })
        }
      />
    </ListItem>
  );
}
