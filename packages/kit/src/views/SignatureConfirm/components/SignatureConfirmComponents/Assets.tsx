import { useEffect, useRef } from 'react';

import type { IYStackProps } from '@onekeyhq/components';
import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSignatureConfirmActions } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import type {
  IDisplayComponentApprove,
  IDisplayComponentNFT,
  IDisplayComponentToken,
} from '@onekeyhq/shared/types/signatureConfirm';

import { showApproveEditor } from '../ApproveEditor';
import { SignatureConfirmItem } from '../SignatureConfirmItem';

type IAssetsProps = {
  networkId: string;
  showNetwork?: boolean;
  editable?: boolean;
} & ISignatureConfirmItemType;

type IAssetsTokenProps = IAssetsProps & {
  component: IDisplayComponentToken;
};

type IAssetsApproveProps = IAssetsProps & {
  accountId: string;
  component: IDisplayComponentApprove;
  approveInfo?: IApproveInfo;
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
  handleEdit,
  ...rest
}: {
  type?: 'token' | 'nft';
  label: string;
  amount: string;
  symbol: string;
  editable?: boolean;
  showNetwork?: boolean;
  tokenProps?: Omit<ITokenProps, 'size' | 'showNetworkIcon'>;
  handleEdit?: () => void;
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
                handleEdit?.();
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
  const { component, ...rest } = props;
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

function AssetsTokenApproval(props: IAssetsApproveProps) {
  const { component, accountId, networkId, approveInfo, ...rest } = props;
  const { token } = component;
  const approveInfoInit = useRef(false);
  const { updateTokenApproveInfo } = useSignatureConfirmActions().current;

  useEffect(() => {
    if (approveInfoInit.current) return;
    updateTokenApproveInfo({
      originalAllowance: component.amount,
      originalIsUnlimited: component.isInfiniteAmount,
    });
    approveInfoInit.current = true;
  }, [updateTokenApproveInfo, component.amount, component.isInfiniteAmount]);

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
      handleEdit={() => {
        showApproveEditor({
          accountId,
          networkId,
          isUnlimited: component.isInfiniteAmount,
          allowance: component.amount,
          tokenDecimals: token.info.decimals,
          tokenSymbol: token.info.symbol,
          tokenAddress: token.info.address,
          balanceParsed: component.balanceParsed,
          approveInfo,
        });
      }}
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
Assets.TokenApproval = AssetsTokenApproval;

Assets.NFT = AssetsNFT;

export { Assets };
