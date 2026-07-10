import { ButtonFrame, Icon, SizableText, XStack } from '@onekeyhq/components';
import { Token, TokenGroup } from '@onekeyhq/kit/src/components/Token';

const ASSET_PILL_FOCUS_STYLE = {
  outlineColor: '$focusRing',
  outlineStyle: 'solid',
  outlineWidth: 2,
} as const;

type IProtocolPositionAssetPillProps = {
  symbol: string;
  logoURI?: string;
  logoURIs?: string[];
  interactive?: boolean;
  testID?: string;
};

function ProtocolPositionAssetPillContent({
  symbol,
  logoURI,
  logoURIs,
  interactive,
}: Omit<IProtocolPositionAssetPillProps, 'testID'>) {
  const tokenGroup =
    logoURIs && logoURIs.length > 1
      ? logoURIs.map((tokenImageUri) => ({ tokenImageUri }))
      : undefined;

  return (
    <>
      {tokenGroup ? (
        <TokenGroup
          tokens={tokenGroup}
          size="xs"
          variant="overlapped"
          wrapperStyle="border"
          wrapperBorderColor="$bgSubdued"
        />
      ) : (
        <Token size="sm" tokenImageUri={logoURIs?.[0] ?? logoURI} bg="$bg" />
      )}
      <SizableText size="$bodyMdMedium" numberOfLines={1} flexShrink={1}>
        {symbol}
      </SizableText>
      {interactive ? (
        <Icon name="ChevronDownSmallOutline" color="$iconSubdued" size="$4.5" />
      ) : null}
    </>
  );
}

export function ProtocolPositionAssetPill({
  symbol,
  logoURI,
  logoURIs,
  interactive = false,
  testID,
}: IProtocolPositionAssetPillProps) {
  const content = (
    <ProtocolPositionAssetPillContent
      symbol={symbol}
      logoURI={logoURI}
      logoURIs={logoURIs}
      interactive={interactive}
    />
  );

  if (!interactive) {
    return (
      <XStack
        testID={testID}
        alignSelf="center"
        alignItems="center"
        gap="$2"
        px="$4"
        py="$2.5"
        borderRadius="$full"
        borderCurve="continuous"
        bg="$bgSubdued"
        maxWidth="100%"
      >
        {content}
      </XStack>
    );
  }

  return (
    <ButtonFrame
      testID={testID}
      alignItems="center"
      justifyContent="flex-start"
      gap="$2"
      px="$4"
      py="$2.5"
      borderWidth={0}
      borderRadius="$full"
      borderCurve="continuous"
      bg="$bgSubdued"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
      focusable
      focusVisibleStyle={ASSET_PILL_FOCUS_STYLE}
      maxWidth="100%"
    >
      {content}
    </ButtonFrame>
  );
}
