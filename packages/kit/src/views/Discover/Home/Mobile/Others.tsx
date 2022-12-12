/* eslint-disable no-nested-ternary */

import {
  FC,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ListRenderItem } from 'react-native';

import {
  Box,
  Divider,
  FlatList,
  Image,
  Pressable,
  Token,
  Typography,
} from '@onekeyhq/components';

import dappColourPNG from '../../../../../assets/dapp_colour.png';
import { useAppSelector } from '../../../../hooks';
import DAppIcon from '../../DAppIcon';
import { useCategoryDapps } from '../../hooks';
import { DAppItemType } from '../../type';
import { DiscoverContext } from '../context';

import { DAppCategories } from './DAppCategories';
import { EmptySkeletonContent } from './EmptySkeleton';

type ChainsSelectorValues = {
  selectedNetworkId: string;
  setSelectedNetworkId: (networkid: string) => void;
};

const SelectedNetworkContext = createContext<ChainsSelectorValues>({
  selectedNetworkId: '',
  setSelectedNetworkId: () => {},
});

const ChainsSelectorItem: FC<{ logoURI?: string; networkId: string }> = ({
  logoURI,
  networkId,
}) => {
  const { selectedNetworkId, setSelectedNetworkId } = useContext(
    SelectedNetworkContext,
  );
  const isActive = selectedNetworkId === networkId;
  return (
    <Pressable
      onPress={() => {
        setSelectedNetworkId(networkId);
      }}
    >
      {({ isHovered, isPressed }) => (
        <Box
          p={1.5}
          m={1}
          borderWidth={2}
          borderColor={
            isActive
              ? 'interactive-default'
              : isPressed
              ? 'border-default'
              : isHovered
              ? 'border-subdued'
              : 'transparent'
          }
          rounded="full"
        >
          {logoURI ? (
            <Token size={8} token={{ logoURI }} />
          ) : (
            <Image size={8} source={dappColourPNG} />
          )}
        </Box>
      )}
    </Pressable>
  );
};

const ChainsSelector: FC<{ networkIds: string[] }> = ({ networkIds }) => {
  const networks = useAppSelector((s) => s.runtime.networks);
  const data = useMemo(() => {
    const items: { logoURI?: string; networkId: string }[] = networks
      .filter((network) => networkIds.includes(network.id))
      .map((item) => ({ logoURI: item.logoURI, networkId: item.id }));
    return [{ networkId: '' }].concat(items);
  }, [networks, networkIds]);

  const renderItem: ListRenderItem<{ logoURI?: string; networkId: string }> =
    useCallback(
      ({ item }) => (
        <ChainsSelectorItem logoURI={item.logoURI} networkId={item.networkId} />
      ),
      [],
    );
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      removeClippedSubviews
      windowSize={5}
      showsVerticalScrollIndicator={false}
      keyExtractor={(item) => item.networkId}
    />
  );
};

const DappsContainerItem: FC<{ item: DAppItemType }> = ({ item }) => {
  const { onItemSelect } = useContext(DiscoverContext);
  return (
    <Pressable
      flexDirection="row"
      px="4"
      pb="4"
      alignItems="center"
      onPress={() => onItemSelect?.(item)}
    >
      <Box mr={3}>
        <DAppIcon size={48} url={item.logoURL} networkIds={item.networkIds} />
      </Box>
      <Box flex={1}>
        <Typography.Body2Strong numberOfLines={1}>
          {item.name}
        </Typography.Body2Strong>
        <Typography.Caption numberOfLines={1} color="text-subdued">
          {item.subtitle}
        </Typography.Caption>
      </Box>
    </Pressable>
  );
};

type DappsContainerProps = {
  dapps: DAppItemType[];
};

const DappsContainer: FC<DappsContainerProps> = ({ dapps }) => {
  const { selectedNetworkId } = useContext(SelectedNetworkContext);
  const data = useMemo(() => {
    if (!selectedNetworkId) {
      return dapps;
    }
    return dapps.filter((item) => item.networkIds.includes(selectedNetworkId));
  }, [selectedNetworkId, dapps]);

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => <DappsContainerItem item={item} />,
    [],
  );

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      removeClippedSubviews
      windowSize={5}
      showsVerticalScrollIndicator={false}
      keyExtractor={(item) => item._id}
      ListEmptyComponent={EmptySkeletonContent}
    />
  );
};

export function Container() {
  const { categoryId } = useContext(DiscoverContext);
  const dapps = useCategoryDapps(categoryId);

  const networkIds = useMemo(() => {
    const ids = dapps.reduce(
      (result, item) => result.concat(item.networkIds),
      [] as string[],
    );
    return Array.from(new Set(ids));
  }, [dapps]);

  return (
    <Box flex="1" bg="background-default" pt="3">
      <Box h="9">
        <DAppCategories />
      </Box>
      <Box flex="1" flexDirection="row" mt="4">
        <Box w="56px">
          <ChainsSelector networkIds={networkIds} />
        </Box>
        <Divider orientation="vertical" />
        <Box flex="1">
          <DappsContainer dapps={dapps} />
        </Box>
      </Box>
    </Box>
  );
}

export const Others = () => {
  const { categoryId } = useContext(DiscoverContext);
  const [selectedNetworkId, setSelectedNetworkId] = useState('');

  useEffect(() => {
    setSelectedNetworkId('');
  }, [categoryId]);

  return (
    <SelectedNetworkContext.Provider
      value={{ selectedNetworkId, setSelectedNetworkId }}
    >
      <Container />
    </SelectedNetworkContext.Provider>
  );
};
