import React, { FC, useCallback, useMemo, useRef, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { chunk } from 'lodash';

import {
  Box,
  Center,
  DataProvider,
  LayoutProvider,
  Modal,
  Pressable,
  RecyclerListView,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import WalletAvatar from '@onekeyhq/kit/src/components/Header/WalletAvatar';
import {
  ManagerWalletModalRoutes,
  ManagerWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';

import { EmojiTypes, colors, emojiList } from '../../../utils/emojiUtils';

type RouteProps = RouteProp<
  ManagerWalletRoutesParams,
  ManagerWalletModalRoutes.ManagerWalletModifyEmojiModal
>;

type ColorSelecterProps = {
  color: string;
  onPress: (color: string) => void;
};

const ColorSelecter = React.memo((props: ColorSelecterProps) => {
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
            <Center
              width="40px"
              height="40px"
              borderRadius="20px"
              bgColor={selected ? item : undefined}
            >
              <Box
                bgColor={item}
                width={selected ? '36px' : '28px'}
                height={selected ? '36px' : '28px'}
                borderRadius={selected ? '18px' : '14px'}
                borderColor="surface-subdued"
                borderWidth={selected ? '4px' : '0px'}
              />
            </Center>
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
  const isSmallScreen = useIsVerticalLayout();
  const [pageWidth, setPageWidth] = useState<number>(0);
  const padding = 24;
  const itemWidth = 44;
  const containerWidth = pageWidth - padding;
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
              width={`${containerWidth}px`}
              height={`${itemWidth}px`}
            >
              {rows.map((item, index) => (
                <Pressable
                  key={`rows${rowIndex} ${index}`}
                  onPress={() => {
                    updateEmoji(item);
                  }}
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
          bgColor="surface-default"
        >
          {pageWidth > 0 && (
            <Box paddingLeft="24px" paddingTop="24px" flex={1}>
              <RecyclerListView
                dataProvider={dataProvider}
                layoutProvider={layoutProvider}
                rowRenderer={renderItem}
                renderAheadOffset={300}
                renderAheadStep={100}
                renderFooter={() =>
                  isSmallScreen ? <Box height="24px" /> : null
                }
              />
            </Box>
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default ModifyWalletEmojiViewModal;
