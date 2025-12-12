import { useState } from 'react';

import {
  Button,
  IconButton,
  Popover,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';

import { useBorrowContext } from '../../BorrowProvider';
import { useSupplyActions } from '../../hooks/useSupplyActions';

import type { IAssetWithToken } from '../../hooks/useSupplyActions';

type IActionFieldProps = {
  item: IAssetWithToken;
  onPress?: (item: IAssetWithToken) => void;
  needAdditionButton?: boolean;
  buttonText: React.ReactNode;
};

export const ActionField = ({
  item,
  onPress,
  needAdditionButton = false,
  buttonText,
}: IActionFieldProps) => {
  const [open, setOpen] = useState(false);
  const { market } = useBorrowContext();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const { handleSwap, handleBridge, handleReceive } = useSupplyActions({
    accountId: activeAccount?.account?.id || '',
    walletId: activeAccount?.wallet?.id || '',
    networkId: market?.networkId || '',
    indexedAccountId: activeAccount?.indexedAccount?.id,
  });

  return (
    <XStack gap="$2" alignItems="center" justifyContent="flex-end">
      <Button
        size="small"
        variant="secondary"
        onPress={() => {
          onPress?.(item);
        }}
      >
        {buttonText}
      </Button>
      {needAdditionButton ? (
        <Popover
          open={open}
          onOpenChange={setOpen}
          placement="bottom-end"
          title=""
          renderTrigger={
            <IconButton icon="DotHorOutline" size="small" variant="tertiary" />
          }
          renderContent={
            <Stack py="$1" minWidth={160}>
              <Button
                variant="tertiary"
                justifyContent="flex-start"
                onPress={() => {
                  setOpen(false);
                  void handleSwap?.(item);
                }}
              >
                Swap
              </Button>
              <Button
                variant="tertiary"
                justifyContent="flex-start"
                onPress={() => {
                  setOpen(false);
                  void handleBridge?.(item);
                }}
              >
                Bridge
              </Button>
              <Button
                variant="tertiary"
                justifyContent="flex-start"
                onPress={() => {
                  setOpen(false);
                  void handleReceive?.(item);
                }}
              >
                Receive
              </Button>
            </Stack>
          }
        />
      ) : null}
    </XStack>
  );
};
