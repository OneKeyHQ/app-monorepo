import { AnimatePresence, useMedia } from 'tamagui';

import type { IButtonProps } from '@onekeyhq/components';
import {
  ActionList,
  ActionListItem,
  Button,
  Checkbox,
  Icon,
  IconButton,
  ListItem,
  Popover,
  SectionList,
  Skeleton,
  Stack,
} from '@onekeyhq/components';

import { WalletOptions } from './WalletOptions';

import type {
  IAccountGroupProps,
  IAccountProps,
  IWalletProps,
} from '../../types';

export interface IWalletDetailsProps {
  wallet?: IWalletProps;
  selectedAccountId?: IAccountProps['id'];
  editMode?: boolean;
  onEditButtonPress?: IButtonProps['onPress'];
  onAccountPress?: (id: IAccountProps['id']) => void;
}

export function WalletDetails({
  wallet,
  selectedAccountId,
  editMode,
  onEditButtonPress,
  onAccountPress,
}: IWalletDetailsProps) {
  const media = useMedia();

  return (
    <Stack flex={1}>
      <ListItem
        mt="$1.5"
        title={wallet?.name}
        titleProps={{
          animation: 'quick',
          opacity: editMode ? 0 : 1,
        }}
      >
        <Button variant="tertiary" onPress={onEditButtonPress}>
          {editMode ? 'Done' : 'Edit'}
        </Button>
      </ListItem>
      <SectionList
        pb="$3"
        estimatedItemSize="$14"
        {...(wallet?.type !== 'others' && {
          ListHeaderComponent: (
            <WalletOptions editMode={editMode} wallet={wallet} />
          ),
        })}
        sections={wallet?.accounts || []}
        renderSectionHeader={({ section }: { section: IAccountGroupProps }) => (
          <>
            {section.title && (
              <SectionList.SectionHeader title={section.title}>
                {section.isHiddenWalletData && editMode && (
                  <ActionList
                    title={section.title}
                    renderTrigger={
                      <Stack>
                        <IconButton
                          icon="DotHorOutline"
                          variant="tertiary"
                          ml="$2"
                        />
                      </Stack>
                    }
                    sections={[
                      {
                        items: [
                          {
                            icon: 'SuqarePlaceholderOutline',
                            label: 'Remember',
                            onPress: () => alert('edit'),
                          },
                        ],
                      },
                      {
                        items: [
                          {
                            icon: 'PencilOutline',
                            label: 'Rename',
                            onPress: () => alert('edit'),
                          },
                          {
                            destructive: true,
                            icon: 'DeleteOutline',
                            label: 'Remove',
                            onPress: () => alert('edit'),
                          },
                        ],
                      },
                    ]}
                  />
                  // <Popover
                  //   floatingPanelProps={{
                  //     w: '$64',
                  //   }}
                  //   title={section.title}
                  //   renderTrigger={
                  //     <Stack>
                  //       <IconButton
                  //         icon="DotHorOutline"
                  //         variant="tertiary"
                  //         ml="$2"
                  //       />
                  //     </Stack>
                  //   }
                  //   renderContent={
                  //     <Stack
                  //       py="$1"
                  //       px="$3"
                  //       $gtMd={{
                  //         px: '$1',
                  //       }}
                  //     >
                  //       <Checkbox
                  //         label="Remember"
                  //         labelProps={{
                  //           pl: '$3',
                  //           variant: media.gtMd ? '$bodyMd' : '$bodyLg',
                  //         }}
                  //         containerProps={{
                  //           alignItems: 'center',
                  //           px: '$2',
                  //           py: media.gtMd ? '$1' : '$2.5',
                  //         }}
                  //       />
                  //       <Popover.Close>
                  //         <ActionListItem icon="PencilOutline" label="Rename" />
                  //       </Popover.Close>
                  //       <Popover.Close>
                  //         <ActionListItem
                  //           destructive
                  //           icon="DeleteOutline"
                  //           label="Remove wallet"
                  //         />
                  //       </Popover.Close>
                  //     </Stack>
                  //   }
                  // />
                )}
              </SectionList.SectionHeader>
            )}
            {section.data.length === 0 && (
              <ListItem
                title="Empty state. Nostrud est eiusmod pariatur cupidatat mollit qui laborum. Consectetur nisi pariatur minim ipsum."
                titleProps={{
                  variant: '$bodyLg',
                }}
              />
            )}
          </>
        )}
        renderItem={({ item }: { item: IAccountProps }) => (
          <ListItem
            key={item.id}
            avatarProps={{
              src: 'https://placehold.co/120x120?text=A',
              fallbackProps: {
                children: <Skeleton w="$10" h="$10" />,
              },
              cornerImageProps: item.networkImageSrc
                ? {
                    src: item.networkImageSrc,
                    fallbackProps: {
                      children: <Skeleton w="$4" h="$4" />,
                    },
                  }
                : undefined,
            }}
            title={item.name}
            titleProps={{
              numberOfLines: 1,
            }}
            subtitle={item.address}
            {...(onAccountPress &&
              !editMode && {
                onPress: () => onAccountPress(item.id),
                checkMark: selectedAccountId === item.id,
              })}
          >
            <AnimatePresence>
              {editMode && (
                <ActionList
                  title={item.name}
                  renderTrigger={
                    <Stack>
                      <ListItem.IconButton icon="DotHorOutline" />
                    </Stack>
                  }
                  items={[
                    {
                      icon: 'PencilOutline',
                      label: 'Rename',
                      onPress: () => alert('edit'),
                    },
                  ]}
                />
              )}
            </AnimatePresence>
          </ListItem>
        )}
        renderSectionFooter={() => (
          <ListItem onPress={() => alert('add')}>
            <Stack
              bg="$bgStrong"
              borderRadius="$2"
              p="$2"
              style={{
                borderCurve: 'continuous',
              }}
            >
              <Icon name="PlusSmallOutline" />
            </Stack>
            <ListItem.Text
              primary="Add account"
              primaryTextProps={{
                variant: '$bodyLg',
              }}
            />
          </ListItem>
        )}
      />
    </Stack>
  );
}
