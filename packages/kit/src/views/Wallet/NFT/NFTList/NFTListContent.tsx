import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

export type INFTListContentData = {
  priceType?: boolean;
  price: number;
};

export type INFTListContent = {
  context: INFTListContentData;
  setContext: Dispatch<SetStateAction<INFTListContentData>>;
};

const NFTListContent = createContext<INFTListContent | null>(null);

function NFTListContentProvider(
  props: INFTListContentData & {
    children: JSX.Element;
  },
) {
  const { children, priceType, price = 0 } = props;
  const [context, setContext] = useState<INFTListContentData>({
    priceType,
    price,
  });
  useEffect(() => {
    setContext((ctx) => ({
      ...ctx,
      priceType,
      price,
    }));
  }, [priceType, price]);
  return (
    <NFTListContent.Provider value={{ context, setContext }}>
      {children}
    </NFTListContent.Provider>
  );
}

function useNFTListContent() {
  return useContext(NFTListContent);
}

export { NFTListContentProvider, useNFTListContent };
