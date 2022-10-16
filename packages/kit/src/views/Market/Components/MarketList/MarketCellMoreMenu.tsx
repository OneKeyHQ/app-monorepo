import {
  ICON_NAMES,
  useIsVerticalLayout,
  Text,
  Icon,
  Box,
} from '@onekeyhq/components/src';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { FC, useMemo } from 'react';
import {
  MarketTokenItem,
  MARKET_FAVORITES_CATEGORYID,
} from '../../../../store/reducers/market';
import { useMarketSelectedCategoryId } from '../../hooks/useMarketCategory';
import { showOverlay } from '../../../../utils/overlayUtils';
import { SelectProps } from '@onekeyhq/components/src/Select';
import { OverlayPanel } from '../../../Overlay/OverlayPanel';
import { ColorType } from 'lightweight-charts';
import { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { useIntl } from 'react-intl';
// favorites 1.remove from Favorites  2.move to top
// !favorites add to favorites

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
    if (
      selectedCategoryId &&
      selectedCategoryId === MARKET_FAVORITES_CATEGORYID
    ) {
      return [
        {
          id: intl.formatMessage({ id: 'action__remove_from_favorites' }),
          onPress: () => {
            backgroundApiProxy.serviceMarket.cancelMarketFavoriteToken(
              token.coingeckoId,
            );
          },
          icon: 'TrashSolid',
          textColor: 'text-critical',
          iconColor: 'icon-critical',
        },
        {
          id: intl.formatMessage({ id: 'action__move_to_top' }),
          onPress: () => {
            backgroundApiProxy.serviceMarket.moveTopMarketFavoriteToken(
              token.coingeckoId,
            );
          },
          icon: 'ArrowUpSolid',
        },
      ];
    }
    return [
      {
        id: intl.formatMessage({ id: 'action__add_to_favorites' }),
        onPress: () => {
          backgroundApiProxy.serviceMarket.saveMarketFavoriteTokens([
            token.coingeckoId,
          ]);
        },
        icon: 'StarOutline',
      },
    ];
  }, [selectedCategoryId, token, intl]);
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
    >
      <MarketCellMoreMenu closeOverlay={closeOverlay} token={token} />
    </OverlayPanel>
  ));
