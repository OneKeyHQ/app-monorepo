import type { FC } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { chunk } from 'lodash';

import { Box, Center, Modal, Pressable, Text } from '@onekeyhq/components';
import RecyclerListView, {
  DataProvider,
  LayoutProvider,
} from '@onekeyhq/components/src/RecyclerListView';
import WalletAvatar from '@onekeyhq/kit/src/components/WalletSelector/WalletAvatar';
import type { ManagerWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/ManagerWallet';
import type { EmojiTypes } from '@onekeyhq/shared/src/utils/emojiUtils';
import { colors, emojiList } from '@onekeyhq/shared/src/utils/emojiUtils';

import type { ManagerWalletModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManagerWalletRoutesParams,
  ManagerWalletModalRoutes.ManagerWalletModifyEmojiModal
>;

type ColorSelecterProps = {
  color: string;
  onPress: (color: string) => void;
};

const ColorSelecter = memo((props: ColorSelecterProps) => {
  const { color, onPress } = props;
  return (
    <Box
      flexDirection="row"
      height="40px"
      justifyContent="space-around"
      px="24px"
      marginY="24px"
    >
      {colors.map((item) => {
        const selected = color === item;
        return (
          <Pressable
            key={`color${item}`}
            onPress={() => {
              onPress(item);
            }}
          >
            {({ isHovered }) => (
              <Center
                width="40px"
                height="40px"
                p="2px"
                borderRadius="full"
                bgColor={
                  // eslint-disable-next-line no-nested-ternary
                  selected ? item : isHovered ? 'border-hovered' : undefined
                }
              >
                <Box
                  flex={1}
                  alignSelf="stretch"
                  bgColor={item}
                  borderRadius="full"
                  borderColor="background-default"
                  borderWidth="4px"
                />
              </Center>
            )}
          </Pressable>
        );
      })}
    </Box>
  );
});
ColorSelecter.displayName = 'ColorSelecter';

const ModifyWalletEmojiViewModal: FC = () => {
  const emojiContainerRef = useRef();
  const navigation = useNavigation();
  const { avatar, onDone } = useRoute<RouteProps>().params;
  const [color, updateColor] = useState(avatar.bgColor);
  const [emoji, updateEmoji] = useState(avatar.emoji);
  const [pageWidth, setPageWidth] = useState<number>(0);
  const padding = 24;
  const itemWidth = 48;
  const containerWidth = pageWidth - padding * 2;
  const rowItems = Math.floor(containerWidth / itemWidth);

  const dataProvider = useMemo(() => {
    const emojis: EmojiTypes[][] = chunk(emojiList, rowItems);
    return new DataProvider((r1, r2) => r1 !== r2).cloneWithRows(emojis);
  }, [rowItems]);

  const layoutProvider = useMemo(
    () =>
      new LayoutProvider(
        () => 'emoji',
        (_, dim) => {
          dim.width = containerWidth;
          dim.height = itemWidth;
        },
      ),
    [containerWidth, itemWidth],
  );

  const renderItem = useCallback(
    (type, dataArray) => {
      const emojisArray: EmojiTypes[][] = chunk(dataArray, rowItems);
      return (
        <Box height="full">
          {emojisArray.map((rows, rowIndex) => (
            <Box
              key={`rows${rowIndex}`}
              flexDirection="row"
              justifyContent="space-between"
              width={`${containerWidth}px`}
              height={`${itemWidth}px`}
            >
              {rows.map((item, index) => (
                <Pressable
                  key={`rows${rowIndex} ${index}`}
                  onPress={() => {
                    updateEmoji(item);
                  }}
                  borderRadius="12px"
                  _hover={{ bg: 'surface-hovered' }}
                  _pressed={{ bg: 'surface-pressed' }}
                >
                  <Box
                    alignItems="center"
                    justifyContent="center"
                    width={`${itemWidth}px`}
                    height={`${itemWidth}px`}
                  >
                    <Text typography="DisplayXLarge">{item}</Text>
                  </Box>
                </Pressable>
              ))}
            </Box>
          ))}
        </Box>
      );
    },
    [itemWidth, rowItems, containerWidth],
  );
  return (
    <Modal
      size="xs"
      height="562px"
      header=""
      primaryActionTranslationId="action__done"
      hideSecondaryAction
      staticChildrenProps={{ flex: 1 }}
      primaryActionProps={{
        onPress: () => {
          if (onDone) {
            onDone({
              emoji,
              bgColor: color,
            });
          }
          navigation.goBack();
        },
      }}
    >
      <Box flex={1}>
        <Box alignItems="center">
          <WalletAvatar
            avatar={{ emoji, bgColor: color }}
            walletImage="hd"
            size="xl"
          />
        </Box>
        <ColorSelecter color={color} onPress={updateColor} />
        <Box
          onLayout={(e) => {
            if (pageWidth !== e.nativeEvent.layout.width) {
              setPageWidth(e.nativeEvent.layout.width);
            }
          }}
          flex={1}
          ref={emojiContainerRef}
          borderTopLeftRadius="24px"
          borderTopRadius="24px"
          bgColor="surface-subdued"
        >
          {pageWidth > 0 && (
            <Box flex={1}>
              <RecyclerListView
                dataProvider={dataProvider}
                layoutProvider={layoutProvider}
                rowRenderer={renderItem}
                renderAheadOffset={300}
                renderAheadStep={100}
                style={{
                  padding,
                }}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default ModifyWalletEmojiViewModal;
