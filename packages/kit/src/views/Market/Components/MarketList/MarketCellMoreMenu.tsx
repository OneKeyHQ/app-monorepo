import type { FC } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Icon,
  Text,
  ToastManager,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { ModalProps } from '@onekeyhq/components/src/Modal';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import type { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import type { SelectProps } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { MarketTokenItem } from '@onekeyhq/kit/src/store/reducers/market';
import { MARKET_FAVORITES_CATEGORYID } from '@onekeyhq/kit/src/store/reducers/market';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';

import { OverlayPanel } from '../../../Overlay/OverlayPanel';
import { useMarketSelectedCategoryId } from '../../hooks/useMarketCategory';

type MarketCellMoreMenuOption = {
  id: string;
  onPress: () => void;
  icon: ICON_NAMES;
  textColor?: ThemeToken;
  iconColor?: ThemeToken;
};

type MarketCellMoreMenuProps = {
  closeOverlay: () => void;
  token: MarketTokenItem;
};
const MarketCellMoreMenu: FC<MarketCellMoreMenuProps> = ({
  closeOverlay,
  token,
}) => {
  const intl = useIntl();

  const selectedCategoryId = useMarketSelectedCategoryId();
  const isVerticalLayout = useIsVerticalLayout();
  const options: MarketCellMoreMenuOption[] = useMemo(() => {
    const cancelAction: MarketCellMoreMenuOption = {
      id: intl.formatMessage({ id: 'action__remove_from_favorites' }),
      onPress: () => {
        backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
          token.coingeckoId,
        );
        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__removed' }),
        });
      },
      icon: 'TrashMini',
      textColor: 'text-critical',
      iconColor: 'icon-critical',
    };
    if (
      selectedCategoryId &&
      selectedCategoryId === MARKET_FAVORITES_CATEGORYID
    ) {
      return [
        cancelAction,
        {
          id: intl.formatMessage({ id: 'action__move_to_top' }),
          onPress: () => {
            backgroundApiProxy.serviceMarket.moveTopMarketFavoriteToken(
              token.coingeckoId,
            );
          },
          icon: 'ArrowUpMini',
        },
      ];
    }
    return token.favorited
      ? [cancelAction]
      : [
          {
            id: intl.formatMessage({ id: 'action__add_to_favorites' }),
            onPress: () => {
              backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
                { coingeckoId: token.coingeckoId, symbol: token.symbol },
              ]);
              ToastManager.show({
                title: intl.formatMessage({ id: 'msg__added_to_favorites' }),
              });
            },
            icon: 'StarOutline',
          },
        ];
  }, [
    intl,
    selectedCategoryId,
    token.favorited,
    token.coingeckoId,
    token.symbol,
  ]);
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

export const showMarketCellMoreMenu = (
  token: MarketTokenItem,
  modalProps?: ModalProps,
  triggerEle?: SelectProps['triggerEle'],
) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={modalProps}
      useDropdownProps={{ autoAdjust: true }}
    >
      <MarketCellMoreMenu closeOverlay={closeOverlay} token={token} />
    </OverlayPanel>
  ));
