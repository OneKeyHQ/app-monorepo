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

type MarketDetailActionMoreMenuOption = {
  id: string;
  onPress: () => void;
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
  token,
}) => {
  const isVerticalLayout = useIsVerticalLayout();
  const options: MarketDetailActionMoreMenuOption[] = useMemo(
    () => [
      {
        id: 'Price Alert',
        onPress: () => {
          // TODO 订阅价格
          console.log('token', token);
        },
        icon: 'BellOutline',
      },
      {
        id: 'Share',
        onPress: () => {
          // TODO Share 分享的逻辑
        },
        icon: 'ShareOutline',
      },
    ],
    [token],
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
