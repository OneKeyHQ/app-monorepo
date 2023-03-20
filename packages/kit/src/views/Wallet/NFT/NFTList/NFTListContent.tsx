import type { Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type INFTListContentData = {
  priceType?: boolean;
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
  const { children, priceType } = props;
  const [context, setContext] = useState<INFTListContentData>({
    priceType,
  });
  useEffect(() => {
    setContext((ctx) => ({
      ...ctx,
      priceType,
    }));
  }, [priceType]);

  const contextValue = useMemo(() => ({ context, setContext }), [context]);
  return (
    <NFTListContent.Provider value={contextValue}>
      {children}
    </NFTListContent.Provider>
  );
}

function useNFTListContent() {
  return useContext(NFTListContent);
}

export { NFTListContentProvider, useNFTListContent };
