import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import { Box, Icon, Text, useIsVerticalLayout } from '@onekeyhq/components';
import type { ModalProps } from '@onekeyhq/components/src/Modal';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import type { SelectProps } from '@onekeyhq/components/src/Select';
import type { MarketTokenItem } from '@onekeyhq/kit/src/store/reducers/market';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

import { OverlayPanel } from '../../../Overlay/OverlayPanel';

type MarketDetailActionMoreMenuOption = {
  id: string;
  onPress: () => void | Promise<void>;
  icon: ICON_NAMES;
  textColor?: ThemeToken;
  iconColor?: ThemeToken;
};

type MarketDetailActionMenuProps = {
  closeOverlay: () => void;
  token: MarketTokenItem;
};
const MarketDetailActionMoreMenu: FC<MarketDetailActionMenuProps> = ({
  closeOverlay,
  // token,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  //
  // const priceSubscribeEnable = useMarketTokenPriceSubscribeStatus({
  //   coingeckoId: token.coingeckoId,
  // });
  const intl = useIntl();
  // const onPriceSubscribePress = useCallback(async () => {
  //   let res: boolean;
  //   if (priceSubscribeEnable) {
  //     res =
  //       await backgroundApiProxy.serviceMarket.fetchMarketTokenCancelPriceSubscribe(
  //         token.coingeckoId,
  //       );
  //   } else {
  //     res =
  //       await backgroundApiProxy.serviceMarket.fetchMarketTokenAddPriceSubscribe(
  //         token.coingeckoId,
  //         token.symbol ?? 'unknow',
  //       );
  //   }
  //   if (!res) return;
  //   ToastManager.show({
  //     title: intl.formatMessage({
  //       id: priceSubscribeEnable
  //         ? 'msg__unsubscription_succeeded'
  //         : 'msg__subscription_succeeded',
  //     }),
  //   });
  // }, [intl, priceSubscribeEnable, token.coingeckoId, token.symbol]);
  const options: MarketDetailActionMoreMenuOption[] = useMemo(
    () => [
      {
        id: intl.formatMessage({
          id: 'form__price_alert',
        }),
        onPress: () => {}, // TODO market  price subscribe
        // icon: priceSubscribeEnable ? 'BellSlashOutline' : 'BellOutline',
        icon: 'BellOutline',
      },
      //   {
      //     id: 'Share',
      //     onPress: () => {
      //       // TODO Share 分享的逻辑 第二期功能
      //     },
      //     icon: 'ShareOutline',
      //   },
    ],
    [intl],
  );
  return (
    <Box>
      {options.map(({ id, onPress, icon, textColor, iconColor }) => (
        <PressableItem
          key={id}
          flexDirection="row"
          alignItems="center"
          py={{ base: '12px', sm: '8px' }}
          px={{ base: '16px', sm: '8px' }}
          bg="transparent"
          borderRadius="12px"
          onPress={() => {
            closeOverlay();
            onPress();
          }}
        >
          <Icon
            size={isVerticalLayout ? 24 : 20}
            name={icon}
            color={iconColor ?? 'icon-default'}
          />
          <Text
            typography={isVerticalLayout ? 'Body1Strong' : 'Body2Strong'}
            ml="12px"
            color={textColor ?? 'text-default'}
          >
            {id}
          </Text>
        </PressableItem>
      ))}
    </Box>
  );
};

export const showMarketDetailActionMoreMenu = (
  token: MarketTokenItem,
  modalProps?: ModalProps,
  triggerEle?: SelectProps['triggerEle'],
) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={modalProps}
    >
      <MarketDetailActionMoreMenu closeOverlay={closeOverlay} token={token} />
    </OverlayPanel>
  ));
