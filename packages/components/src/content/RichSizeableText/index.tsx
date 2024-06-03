import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import type { ILocaleIds } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { SizableText } from '../../primitives';

import type { ISizableTextProps } from '../../primitives';

export type IRichSizeableTextProps = Omit<ISizableTextProps, 'children'> & {
  children?: string | ILocaleIds;
  linkList?: ILinkItemType[];
  i18NValues?: Record<string, string | ((value: any) => React.JSX.Element)>;
};

type ILinkItemType = Omit<ISizableTextProps, 'onPress'> & {
  onPress?: () => void;
  url?: string;
};

export function RichSizeableText({
  children,
  linkList,
  i18NValues,
  ...rest
}: IRichSizeableTextProps) {
  const onLinkDidPress = useCallback((link: ILinkItemType) => {
    if (link.onPress) {
      link.onPress();
      return;
    }
    if (link.url) {
      openUrlExternal(link?.url ?? '');
    }
  }, []);
  let linkIndex = 0;
  return (
    <SizableText size="$bodyLg" color="$textSubdued" {...rest}>
      {linkList || i18NValues ? (
        <FormattedMessage
          id={children as ILocaleIds}
          defaultMessage={children}
          values={
            {
              ...linkList?.reduce((values) => {
                // eslint-disable-next-line react/no-unstable-nested-components
                values.a = (text) => {
                  if (linkIndex >= linkList.length) {
                    linkIndex = 0;
                  }
                  const link = linkList[linkIndex];
                  linkIndex += 1;
                  return (
                    <SizableText
                      color="$textInfo"
                      {...link}
                      cursor="pointer"
                      onPress={() => onLinkDidPress(link)}
                    >
                      {text}
                    </SizableText>
                  );
                };
                return values;
              }, {} as Record<string, string | ((value: any) => React.JSX.Element)>),
              ...i18NValues,
            } as Record<string, React.ReactNode>
          }
        />
      ) : (
        children
      )}
    </SizableText>
  );
}
