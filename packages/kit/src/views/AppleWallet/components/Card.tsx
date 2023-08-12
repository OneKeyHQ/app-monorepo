import { useState } from 'react';

import {
  Image,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  type ViewProps,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Box } from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';

import {
  FormatBalance,
  FormatCurrencyNumber,
} from '../../../components/Format';
import { useActiveWalletAccount } from '../../../hooks';
import {
  BACK_BUTTON_HEIGHT,
  CARD_HEADER_HEIGHT,
  CARD_HEIGHT_CLOSED,
  CARD_HEIGHT_OPEN,
  CARD_MARGIN,
  SPRING_CONFIG,
} from '../assets/config';
import { theme } from '../assets/theme';
import { metrics } from '../constants/metrics';

import { ButtonsSection } from './ButtonsSections';
import { TxHistoryListView } from './TxHistoryListView';

import type { CardProps } from '../assets/types';

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 20,
    width: '100%',
    overflow: 'hidden',
    borderWidth: 1,
    color: 'lightgrey',
  },
  cardSubContainer: {
    paddingHorizontal: 16,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 12,
    height: CARD_HEIGHT_OPEN - CARD_HEADER_HEIGHT,
    backgroundColor: '#FDC921',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#13070C',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: CARD_HEADER_HEIGHT,
    backgroundColor: '#FDC921',
  },
  headerSubcontainer: {
    alignItems: 'center',
  },
  fieldSpacer: { marginTop: 16 },
  stContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#13070C',
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  fieldValue: {
    fontSize: 21,
    color: '#13070C',
    textAlign: 'right',
  },
  image: {
    height: 40,
    width: 40,
    borderRadius: 1000,
    marginRight: 8,
    borderWidth: 1,
  },
  qrContainer: {
    alignSelf: 'center',
    padding: 8,
    backgroundColor: theme.colors.white,
    borderRadius: 6,
  },
  qr: { width: 140, height: 140 },
});

export const Flex = ({ children, style, ...rest }: ViewProps) => (
  <View style={[{ flex: 1 }, style]} {...rest}>
    {children}
  </View>
);

const Card = ({
  item,
  index,
  selectedCard,
  scrollY,
  swipeY,
  inTransition,
}: CardProps) => {
  const [isOpened, setIsOpened] = useState(false);
  const animatedHeight = useSharedValue(CARD_HEIGHT_CLOSED);
  const transY = useSharedValue(0);
  const scale = useSharedValue(1);
  const marginTop = index * CARD_MARGIN;
  const spread = 70 * index;
  const spreadOffset = Math.min(2.5 * index * index, spread);
  const { accountId, networkId } = useActiveWalletAccount();

  const animatedStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    opacity: interpolate(scale.value, [0.9, 0.95], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-metrics.screenHeight, 0],
          [50 + spread - spreadOffset, 0],
          Extrapolation.CLAMP,
        ),
      },
      { translateY: transY.value },
      {
        scale: scale.value,
      },
    ],
  }));

  useAnimatedReaction(
    () => swipeY.value,
    (current, previous) => {
      if (selectedCard.value === index) {
        transY.value = transY.value + current - (previous ?? 0);
      }
    },
  );

  useAnimatedReaction(
    () => selectedCard.value,
    (currentSelection, previousSelection) => {
      if (selectedCard.value !== -1) {
        const isSelected = selectedCard.value === index;
        const slideUp = currentSelection >= index;
        const animateToValue = slideUp
          ? scrollY.value - marginTop
          : scrollY.value +
            metrics.screenHeight -
            marginTop -
            BACK_BUTTON_HEIGHT;

        transY.value = isSelected
          ? withSpring(animateToValue, SPRING_CONFIG.OPEN)
          : withTiming(animateToValue);

        if (isSelected) {
          animatedHeight.value = withTiming(CARD_HEIGHT_OPEN);
        } else if (slideUp) {
          scale.value = withTiming(0.9);
        }
      } else {
        if (previousSelection === index) {
          console.log({ previousSelection, currentSelection });
          transY.value = withSpring(0, SPRING_CONFIG.CLOSE);
        } else {
          const wasAbove = (previousSelection ?? 0) > index;
          transY.value = withDelay(
            wasAbove ? 100 : 300,
            withTiming(0, {
              easing: Easing.out(Easing.quad),
            }),
          );
          if (wasAbove) {
            scale.value = withTiming(1);
          }
        }
        if (animatedHeight.value > CARD_HEIGHT_CLOSED) {
          animatedHeight.value = withTiming(CARD_HEIGHT_CLOSED);
        }
      }
    },
  );

  useAnimatedReaction(
    () => selectedCard.value === index,
    (showModal) => {
      setIsOpened(showModal);
    },
  );

  const handleCardPress = () => {
    if (selectedCard.value === -1 && !inTransition.value) {
      selectedCard.value = index;
    }
  };

  return (
    <TouchableWithoutFeedback
      onPress={handleCardPress}
      disabled={isOpened}
      style={{
        height: '100%',
      }}
    >
      <View>
        <Animated.View
          style={[
            styles.cardContainer,
            {
              marginTop,
              shadowColor: 'black',
              shadowOffset: {
                width: 0,
                height: 8,
              },
              shadowRadius: 4,
              shadowOpacity: 0.1,
              height: '100%',
              marginBottom: -marginTop,
            },
            {
              position:
                isOpened && !inTransition.value ? 'relative' : 'absolute',
            },
            animatedStyle,
          ]}
        >
          <View style={[styles.headerContainer]}>
            <View
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                width: '100%',
                height: '100%',
              }}
            >
              <View
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Image
                  source={{
                    uri: item.logoURI || '',
                  }}
                  style={styles.image}
                />
                <Text style={styles.title}>{item.name}</Text>
              </View>
              <View
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <FormatBalance
                  balance={item.balance}
                  suffix={item.symbol}
                  formatOptions={{
                    fixed: 4,
                  }}
                  render={(ele) => <Text style={styles.fieldValue}>{ele}</Text>}
                />
                <Text style={styles.fieldLabel}>
                  <FormatCurrencyNumber
                    decimals={2}
                    value={0}
                    convertValue={+item.usdValue}
                  />
                </Text>
              </View>
            </View>
          </View>
          <View
            style={[
              styles.cardSubContainer,
              {
                display: 'flex',
                justifyContent: 'flex-end',
                paddingBottom: isOpened ? 24 : 52,
              },
            ]}
          >
            <View
              style={[
                styles.fieldSpacer,
                styles.stContainer,
                { width: '100%' },
              ]}
            >
              <Text style={{ fontSize: 24, fontFamily: 'monospace' }}>
                4242 4242 4242 4242
              </Text>
            </View>
          </View>
        </Animated.View>
        {isOpened && (
          <>
            <ButtonsSection {...item} />
            <TxHistoryListView
              accountId={accountId}
              networkId={networkId}
              tokenId={
                isAllNetworks(networkId) ? item.coingeckoId : item.address
              }
            />
          </>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

export default Card;
