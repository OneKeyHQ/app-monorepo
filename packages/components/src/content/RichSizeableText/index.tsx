import { useCallback, useMemo } from 'react';

import { FormattedMessage } from 'react-intl';

import type { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { SizableText } from '../../primitives/SizeableText';

import type { ISizableTextProps } from '../../primitives';

export type IRichSizeableTextProps = Omit<ISizableTextProps, 'children'> & {
  children?: string | ETranslations;
  linkList?: { [key: string]: ILinkItemType };
  i18NValues?: Record<string, string | ((value: any) => React.JSX.Element)>;
};

type ILinkItemType = ISizableTextProps & {
  url: string | undefined;
};

function LinkText({
  link,
  children,
}: {
  link: ILinkItemType;
  children: React.ReactNode;
}) {
  const handlePress = useCallback(() => {
    if (link.url) {
      openUrlExternal(link.url ?? '');
    }
  }, [link.url]);

  return (
    <SizableText
      color="$textInfo"
      cursor="pointer"
      onPress={handlePress}
      {...link}
    >
      {children}
    </SizableText>
  );
}

/**
 * @deprecated This component is deprecated. Please use HyperlinkText instead.
 * @see HyperlinkText in @onekeyhq/kit/src/components/HyperlinkText
 */
export function RichSizeableText({
  children,
  linkList,
  i18NValues,
  ...rest
}: IRichSizeableTextProps) {
  const formattedMessageValues = useMemo(
    () =>
      ({
        ...(linkList
          ? Object.keys(linkList).reduce(
              (values, key) => {
                // eslint-disable-next-line react/no-unstable-nested-components
                values[key] = (text: React.ReactNode) => {
                  const link = linkList[key];
                  return <LinkText link={link}>{text}</LinkText>;
                };
                return values;
              },
              {} as Record<
                string,
                string | ((value: any) => React.JSX.Element)
              >,
            )
          : {}),
        ...i18NValues,
      }) as Record<string, any>,
    [linkList, i18NValues],
  );

  return (
    <SizableText size="$bodyLg" color="$textSubdued" {...rest}>
      {linkList || i18NValues ? (
        <FormattedMessage
          id={children as ETranslations}
          defaultMessage={children}
          values={formattedMessageValues}
        />
      ) : (
        children
      )}
    </SizableText>
  );
}
