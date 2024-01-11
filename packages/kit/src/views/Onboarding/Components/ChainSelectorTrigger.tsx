import { Icon, ListItem } from '@onekeyhq/components';

import { EChainSelectorPages } from '../../../common/ChainSelector/router/type';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';

export function ChainSelectorTrigger() {
  const navigation = useAppNavigation();

  const handleChainPress = () => {
    navigation.pushModal(EModalRoutes.ChainSelectorModal, {
      screen: EChainSelectorPages.Selector,
    });
  };

  return (
    <ListItem
      borderWidth="$px"
      borderColor="$borderStrong"
      mx="$0"
      avatarProps={{
        src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
        size: '$7',
        bg: '$bgStrong',
        circular: true,
      }}
      title="Ethereum"
      onPress={handleChainPress}
      focusStyle={{
        outlineOffset: 0,
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineColor: '$focusRing',
      }}
    >
      <Icon name="ChevronGrabberVerOutline" color="$iconSubdued" />
    </ListItem>
  );
}
