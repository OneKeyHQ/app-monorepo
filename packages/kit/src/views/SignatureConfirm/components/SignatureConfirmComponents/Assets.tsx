import type { IYStackProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type {
  IDisplayComponentNFT,
  IDisplayComponentToken,
} from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IAssetsProps = {
  networkId: string;
  showNetwork?: boolean;
  editable?: boolean;
} & ISignatureConfirmItemType;

type IAssetsTokenProps = IAssetsProps & {
  component: IDisplayComponentToken;
};

type IAssetsNFTProps = IAssetsProps & {
  component: IDisplayComponentNFT;
};

type ISignatureConfirmItemType = IYStackProps;

function SignatureAssetDetailItem({
  type,
  label,
  showNetwork,
  amount,
  symbol,
  editable,
  tokenProps,
  ...rest
}: {
  type?: 'token' | 'nft';
  label: string;
  amount: string;
  symbol: string;
  editable?: boolean;
  showNetwork?: boolean;
  tokenProps?: Omit<ITokenProps, 'size' | 'showNetworkIcon'>;
} & ISignatureConfirmItemType) {
  return (
    <SignatureConfirmItem {...rest}>
      <SignatureConfirmItem.Label>{label}</SignatureConfirmItem.Label>
      <XStack gap="$3" alignItems="center">
        <Token
          size="lg"
          showNetworkIcon={showNetwork}
          {...(type === 'nft' && {
            borderRadius: '$2',
          })}
          {...tokenProps}
        />
        <YStack>
          <XStack
            gap="$1"
            alignItems="center"
            {...(editable && {
              onPress: () => {
                console.log('clicked');
              },
              p: '$1',
              m: '$-1',
              borderRadius: '$2',
              userSelect: 'none',
              hoverStyle: {
                bg: '$bgSubdued',
              },
              pressStyle: {
                bg: '$bgActive',
              },
              focusable: true,
              focusVisibleStyle: {
                outlineColor: '$focusRing',
                outlineWidth: 2,
                outlineStyle: 'solid',
                outlineOffset: 0,
              },
            })}
          >
            {amount ? (
              <SizableText size="$headingMd">{amount}</SizableText>
            ) : null}
            <SizableText size="$bodyLg">{symbol}</SizableText>
            {editable ? (
              <Icon name="PencilOutline" size="$4.5" color="$iconSubdued" />
            ) : null}
          </XStack>
          {showNetwork ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              Ethereum
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </SignatureConfirmItem>
  );
}

function AssetsToken(props: IAssetsTokenProps) {
  const { component, showNetwork, ...rest } = props;
  return (
    <SignatureAssetDetailItem
      label={component.label}
      amount={component.amountParsed}
      symbol={component.token.info.symbol}
      tokenProps={{
        tokenImageUri: component.token.info.logoURI,
        isNFT: false,
        networkId: component.token.info.networkId,
      }}
      type="token"
      {...rest}
    />
  );
}

function AssetsNFT(props: IAssetsNFTProps) {
  const { component, ...rest } = props;
  return (
    <SignatureAssetDetailItem
      label={component.label}
      amount={component.amount}
      symbol={
        component.nft.metadata?.name || component.nft.collectionName || ''
      }
      type="nft"
      tokenProps={{
        isNFT: true,
        tokenImageUri: component.nft.metadata?.image ?? '',
        networkId: component.nft.networkId,
      }}
      {...rest}
    />
  );
}

function Assets() {
  return <></>;
}

Assets.Token = AssetsToken;
Assets.NFT = AssetsNFT;

export { Assets };
