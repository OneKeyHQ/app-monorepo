import { memo, useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import type { ISizableTextProps, IXStackProps } from '@onekeyhq/components';
import { SizableText, XStack } from '@onekeyhq/components';

import { Token } from '../../../components/Token';

import type { IReceiveTitleLogo } from '../utils/receiveTitleUtils';

type IReceiveTitleBlocksProps = Omit<IXStackProps, 'children'> & {
  logo: IReceiveTitleLogo;
  // The logo image; each caller loads it its own way.
  icon: ReactNode;
  textProps: ISizableTextProps;
  // between the words and the logo + symbol, where the sentence has a space
  blockGap: IXStackProps['columnGap'];
  iconGap: IXStackProps['gap'];
};

// A title with its token's logo, as two blocks in a row: the words, and the
// logo with the symbol. An icon inside the text would break the line on web
// and ride the baseline on native. The row breaks between the blocks first;
// a symbol too long for a line of its own then wraps beside its logo, so the
// title never loses text.
export function ReceiveTitleBlocks({
  logo,
  icon,
  textProps,
  blockGap,
  iconGap,
  ...rowProps
}: IReceiveTitleBlocksProps) {
  return (
    <XStack
      maxWidth="100%"
      flexWrap="wrap"
      justifyContent="center"
      alignItems="center"
      columnGap={logo.hasGap ? blockGap : 0}
      {...rowProps}
    >
      {logo.before ? (
        <SizableText flexShrink={1} {...textProps}>
          {logo.before}
        </SizableText>
      ) : null}
      <XStack flexShrink={1} alignItems="center" gap={iconGap}>
        {icon}
        <SizableText flexShrink={1} minWidth={0} {...textProps}>
          {logo.symbol}
        </SizableText>
      </XStack>
      {logo.after ? (
        <SizableText flexShrink={1} {...textProps}>
          {logo.after}
        </SizableText>
      ) : null}
    </XStack>
  );
}

type IReceiveTitleProps = {
  // The whole sentence, e.g. "Receive USDT".
  title: string;
  // Set when the title carries the token's logo.
  logo?: IReceiveTitleLogo;
  testID?: string;
};

const TITLE_TEXT_PROPS = { size: '$heading2xl' } as const;

function BasicReceiveTitle({ title, logo, testID }: IReceiveTitleProps) {
  // A logo that fails to load leaves the plain title, not a placeholder coin
  // in the headline.
  const [failedLogoURI, setFailedLogoURI] = useState<string>();
  const logoURI = logo?.uri;
  const handleLogoError = useCallback(
    () => setFailedLogoURI(logoURI),
    [logoURI],
  );

  if (!logo || failedLogoURI === logo.uri) {
    return (
      <SizableText
        testID={testID}
        role="heading"
        aria-level={1}
        textAlign="center"
        {...TITLE_TEXT_PROPS}
      >
        {title}
      </SizableText>
    );
  }

  return (
    <ReceiveTitleBlocks
      testID={testID}
      // One heading that reads as the whole sentence, like the plain title:
      // the blocks alone would be announced as separate pieces.
      accessible
      role="heading"
      aria-level={1}
      aria-label={title}
      logo={logo}
      textProps={TITLE_TEXT_PROPS}
      blockGap="$2"
      iconGap="$1.5"
      icon={
        // The app's token image, so the logo gets the same dark-theme backing
        // as everywhere else, minus the skeleton and the placeholder coin:
        // the headline shows the logo or nothing. No retry either, so a dead
        // logo gives way to the plain title at once.
        <Token
          size="sm"
          tokenImageUri={logo.uri}
          loadingStrategy="none"
          placeholder={null}
          fallback={null}
          retryTimes={0}
          onError={handleLogoError}
        />
      }
    />
  );
}

// memoized: the page re-renders often and the title rarely changes
export const ReceiveTitle = memo(BasicReceiveTitle);
