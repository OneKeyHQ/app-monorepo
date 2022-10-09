import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { NFTAsset } from '@onekeyhq/engine/src/types/nft';

export type SelectAsset = NFTAsset & { selected: boolean };
export type ISendNFTContentData = {
  multiSelect?: boolean;
  listData: SelectAsset[];
};

export type ISendNFTContent = {
  context: ISendNFTContentData;
  setContext: React.Dispatch<React.SetStateAction<ISendNFTContentData>>;
};

const SendNFTContent = createContext<ISendNFTContent | null>(null);

function SendNFTContentProvider(
  props: ISendNFTContentData & { children: ReactNode },
) {
  const { children, listData, multiSelect } = props;
  const [context, setContext] = useState<ISendNFTContentData>({
    multiSelect: false,
    listData: [],
  });

  useEffect(() => {
    setContext((ctx) => ({
      ...ctx,
      listData,
      multiSelect,
    }));
  }, [multiSelect, listData]);

  return (
    <SendNFTContent.Provider value={{ context, setContext }}>
      {children}
    </SendNFTContent.Provider>
  );
}

function useSendNFTContent() {
  return useContext(SendNFTContent);
}

export { SendNFTContentProvider, useSendNFTContent };
