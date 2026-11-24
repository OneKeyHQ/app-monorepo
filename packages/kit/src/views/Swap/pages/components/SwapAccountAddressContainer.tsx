import { useIntl } from 'react-intl';

import { SizableText, XStack } from '@onekeyhq/components';
import { DeriveTypeSelectorTriggerIconRenderer } from '@onekeyhq/kit/src/components/AccountSelector/DeriveTypeSelectorTrigger';
import AddressTypeSelector from '@onekeyhq/kit/src/components/AddressTypeSelector/AddressTypeSelector';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

interface ISwapAccountAddressContainerProps {
  type: ESwapDirectionType;
}
// The card's direction label, followed by the address type (derive path)
// selector on networks that have one (e.g. Bitcoin). The network itself is
// shown as a badge on the token icon, not here.
const SwapAccountAddressContainer = ({
  type,
}: ISwapAccountAddressContainerProps) => {
  const intl = useIntl();
  const [fromToken] = useSwapSelectFromTokenAtom();
  const [toToken] = useSwapSelectToTokenAtom();
  const { activeAccount: activeFromAccount } = useActiveAccount({ num: 0 });
  const { activeAccount: activeToAccount } = useActiveAccount({ num: 1 });
  const token = type === ESwapDirectionType.FROM ? fromToken : toToken;
  const activeAccount =
    type === ESwapDirectionType.FROM ? activeFromAccount : activeToAccount;
  const showAddressTypeSelector = Boolean(
    token?.networkId &&
    activeAccount.network?.id === token.networkId &&
    activeAccount.vaultSettings?.mergeDeriveAssetsEnabled,
  );

  return (
    <XStack alignItems="center" gap="$1">
      <SizableText
        size="$bodyMd"
        mr="$1"
        userSelect="none"
        color="$textSubdued"
      >
        {intl.formatMessage({
          id:
            type === ESwapDirectionType.FROM
              ? ETranslations.swap_page_from
              : ETranslations.swap_page_to,
        })}
      </SizableText>
      {showAddressTypeSelector ? (
        <AddressTypeSelector
          refreshOnOpen
          whenCollapsed="hide"
          revalidateCollapseOnFocus
          placement="bottom-start"
          networkId={token?.networkId ?? ''}
          indexedAccountId={activeAccount.indexedAccount?.id ?? ''}
          walletId={activeAccount.wallet?.id ?? ''}
          activeDeriveType={activeAccount.deriveType}
          activeDeriveInfo={activeAccount.deriveInfo}
          renderSelectorTrigger={
            <DeriveTypeSelectorTriggerIconRenderer
              autoShowLabel={false}
              onPress={() => {}}
              iconProps={{
                size: '$4',
              }}
              labelProps={{
                pl: '$1',
              }}
            />
          }
        />
      ) : null}
    </XStack>
  );
};

export default SwapAccountAddressContainer;
