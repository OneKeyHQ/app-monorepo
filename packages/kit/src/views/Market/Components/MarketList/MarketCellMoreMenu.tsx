import { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  ICON_NAMES,
  Icon,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components/src';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { ThemeToken } from '@onekeyhq/components/src/Provider/theme';
import { SelectProps } from '@onekeyhq/components/src/Select';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  MARKET_FAVORITES_CATEGORYID,
  MarketTokenItem,
} from '@onekeyhq/kit/src/store/reducers/market';
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
