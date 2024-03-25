export type IWalletConnectModalShared = {
  useModal: () => {
    modal: JSX.Element | null;
    openModal: ({ uri }: { uri: string }) => Promise<void>;
    closeModal: () => void;
  };
};
