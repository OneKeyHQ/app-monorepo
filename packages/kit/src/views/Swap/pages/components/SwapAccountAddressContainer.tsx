import { XStack, YStack } from '@onekeyhq/components';
import { AccountSelectorActiveAccountHome } from '@onekeyhq/kit/src/components/AccountSelector';
import { DeriveTypeSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

interface ISwapAccountAddressContainerProps {
  num: number;
}
const SwapAccountAddressContainer = ({
  num,
}: ISwapAccountAddressContainerProps) => {
  const { activeAccount } = useActiveAccount({ num });
  // const { activeAccount: activeAccount0 } = useActiveAccount({ num: 0 });
  // const [receiverAddressType, setReceiverAddressType] =
  //   useSwapReceiverAddressTypeAtom();

  // const [receiverAddressInputValue, setReceiverAddressInputValue] =
  //   useSwapReceiverAddressInputValueAtom();

  // const { updateSelectedAccount } = useAccountSelectorActions().current;

  // const onSelectReceiverAddressType = useCallback(
  //   (type: ESwapReceiveAddressType) => {
  //     setReceiverAddressType(type);
  //   },
  //   [setReceiverAddressType],
  // );

  // const receiverAddressShowShowComponent = useMemo(() => {
  //   if (receiverAddressType === ESwapReceiveAddressType.INPUT) {
  //     return (
  //       <Input
  //         onChangeText={setReceiverAddressInputValue}
  //         value={receiverAddressInputValue}
  //       />
  //     );
  //   }
  //   if (receiverAddressType === ESwapReceiveAddressType.ADDRESS_BOOK) {
  //     return (
  //       <Button>
  //         <SizableText>open address book</SizableText>
  //       </Button>
  //     );
  //   }
  //   return null;
  // }, [
  //   receiverAddressType,
  //   receiverAddressInputValue,
  //   setReceiverAddressInputValue,
  // ]);
  // const [isSupportReceiveAddressDifferent] =
  //   useSwapProviderSupportReceiveAddressAtom();

  // useEffect(() => {
  //   if (isReceiver && !isSupportReceiveAddressDifferent) {
  //     setReceiverAddressType(ESwapReceiveAddressType.USER_ACCOUNT);
  //     updateSelectedAccount({
  //       num,
  //       builder: (v) => ({
  //         ...v,
  //         networkId: activeAccount0.network?.id,
  //         walletId: activeAccount0.wallet?.id,
  //         indexedAccountId: activeAccount0.indexedAccount?.id,
  //       }),
  //     });
  //   }
  // }, [
  //   activeAccount0,
  //   isReceiver,
  //   isSupportReceiveAddressDifferent,
  //   num,
  //   setReceiverAddressType,
  //   updateSelectedAccount,
  // ]);

  if (!activeAccount) {
    return null;
  }
  return (
    <XStack justifyContent="space-between">
      <YStack>
        <XStack>
          <AccountSelectorActiveAccountHome num={num} />
          <DeriveTypeSelectorTrigger miniMode num={num} />
        </XStack>
        {/* {!isReceiver ||
        receiverAddressType === ESwapReceiveAddressType.USER_ACCOUNT ? (
          <XStack>
            <AccountSelectorActiveAccountHome num={num} />
            <DeriveTypeSelectorTrigger miniMode num={num} />
          </XStack>
        ) : (
          receiverAddressShowShowComponent
        )} */}
      </YStack>

      {/* {!isReceiver && onSelectAmountPercentage ? (
        <SwapFromAmountPercentage
          selectItems={swapFromAmountPercentageItems}
          onSelectItem={onSelectAmountPercentage}
        />
      ) : (
        <SwapReceiverAddressTypeTrigger
          onSelectType={onSelectReceiverAddressType}
        />
      )} */}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
