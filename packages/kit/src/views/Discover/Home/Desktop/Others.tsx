/* eslint-disable no-nested-ternary */
import type { FC } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useWindowDimensions } from 'react-native';

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
import { useAppSelector, useTranslation } from '../../../../hooks';
import { Chains } from '../../Chains';
import DAppIcon from '../../DAppIcon';
import { useCategoryDapps } from '../../hooks';
import { DiscoverContext } from '../context';

import { DAppCategories } from './DAppCategories';
import { EmptySkeletonContent } from './EmptySkeleton';

import type { DAppItemType } from '../../type';
import type { ListRenderItem } from 'react-native';

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
      showsVerticalScrollIndicator={false}
      keyExtractor={(item) => item.networkId}
    />
  );
};

type DappsContainerProps = {
  dapps: DAppItemType[];
};

const ListEmptyComponent = () => <EmptySkeletonContent offset={-120} />;

const DappsContainer: FC<DappsContainerProps> = ({ dapps }) => {
  const { selectedNetworkId } = useContext(SelectedNetworkContext);
  const t = useTranslation();

  const { onItemSelect } = useContext(DiscoverContext);
  const { width } = useWindowDimensions();
  // with sidebar
  const screenWidth = width - 256 - 72 - 24 - 80;
  const minWidth = 250;
  const numColumns = Math.floor(screenWidth / minWidth);
  const cardWidth = screenWidth / numColumns;

  const renderItem: ListRenderItem<DAppItemType> = useCallback(
    ({ item }) => (
      <Box
        width={cardWidth}
        maxWidth={cardWidth}
        minWidth={cardWidth}
        height={156}
        paddingX="2"
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          bgColor="surface-default"
          flexDirection="column"
          borderRadius="12px"
          padding="4"
          width={cardWidth - 16}
          height={144}
          borderWidth={1}
          _hover={{ bgColor: 'surface-hovered' }}
          borderColor="border-subdued"
          onPress={() => {
            if (onItemSelect) {
              onItemSelect(item);
            }
          }}
        >
          <Box flexDirection="row">
            <DAppIcon
              size={48}
              url={item.logoURL}
              networkIds={item.networkIds}
            />
            <Box ml="3" flex="1">
              <Typography.Body2Strong numberOfLines={1} mb="1" flex="1">
                {item.name}
              </Typography.Body2Strong>
              <Chains networkIds={item.networkIds} />
            </Box>
          </Box>
          <Typography.Caption
            mt="3"
            numberOfLines={2}
            textAlign="left"
            color="text-subdued"
          >
            {t(item._subtitle) ?? item.subtitle}
          </Typography.Caption>
        </Pressable>
      </Box>
    ),
    [cardWidth, onItemSelect, t],
  );

  const data = useMemo(() => {
    if (!selectedNetworkId) {
      return dapps;
    }
    return dapps.filter((item) => item.networkIds.includes(selectedNetworkId));
  }, [selectedNetworkId, dapps]);

  return (
    <FlatList
      paddingLeft="24px"
      paddingRight="24px"
      data={data}
      removeClippedSubviews
      windowSize={5}
      showsHorizontalScrollIndicator={false}
      renderItem={renderItem}
      numColumns={numColumns}
      key={`key${numColumns}`}
      keyExtractor={(item) => item._id}
      ListEmptyComponent={ListEmptyComponent}
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
        <Box pl="4" pr="2">
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

  const contextValue = useMemo(
    () => ({ selectedNetworkId, setSelectedNetworkId }),
    [selectedNetworkId],
  );

  return (
    <SelectedNetworkContext.Provider value={contextValue}>
      <Container />
    </SelectedNetworkContext.Provider>
  );
};
