import { validateEvmAddress } from '@onekeyhq/core/src/chains/evm/sdkEvm';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type { IDisplayComponent } from '@onekeyhq/shared/types/signatureConfirm';

// Server-parsed display components carry lowercase (normalized) EVM addresses,
// while hardware devices render EIP-55 checksum addresses. Keep the wallet UI
// aligned with the device by applying EIP-55 to EVM addresses at display-build time.
// Non-EVM networks and values that are not valid EVM addresses (ENS names,
// placeholders) are returned untouched.
async function toEvmDisplayAddress({
  networkId,
  address,
}: {
  networkId: string | undefined;
  address: string;
}): Promise<string> {
  if (!address || !networkUtils.isEvmNetwork({ networkId })) {
    return address;
  }
  const { isValid, displayAddress } = await validateEvmAddress(address);
  return isValid && displayAddress ? displayAddress : address;
}

// Returns the input array instance when no component needed rewriting so
// callers can keep the original display object untouched.
export async function checksumDisplayComponentAddresses({
  networkId,
  components,
}: {
  networkId: string;
  components: IDisplayComponent[];
}): Promise<IDisplayComponent[]> {
  const nextComponents = await Promise.all(
    components.map(async (component) => {
      if (component.type === EParseTxComponentType.Address) {
        const address = await toEvmDisplayAddress({
          networkId: component.networkId || networkId,
          address: component.address,
        });
        return address === component.address
          ? component
          : { ...component, address };
      }
      if (
        component.type === EParseTxComponentType.Approve &&
        component.spender
      ) {
        const spender = await toEvmDisplayAddress({
          networkId: component.networkId || networkId,
          address: component.spender,
        });
        return spender === component.spender
          ? component
          : { ...component, spender };
      }
      return component;
    }),
  );
  const isChanged = nextComponents.some(
    (component, index) => component !== components[index],
  );
  return isChanged ? nextComponents : components;
}
