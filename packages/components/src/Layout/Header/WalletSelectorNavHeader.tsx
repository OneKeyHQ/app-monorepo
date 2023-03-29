import Box from '../../Box';
import useIsVerticalLayout from '../../Provider/hooks/useIsVerticalLayout';

import { LayoutHeaderDesktop } from './LayoutHeaderDesktop';
import { LayoutHeaderMobile } from './LayoutHeaderMobile';

import type { MessageDescriptor } from 'react-intl';

export function WalletSelectorNavHeader({
  i18nTitle,
}: {
  i18nTitle?: MessageDescriptor['id'];
}) {
  const isVerticalLayout = useIsVerticalLayout();
  const content = isVerticalLayout ? (
    <LayoutHeaderMobile />
  ) : (
    <LayoutHeaderDesktop i18nTitle={i18nTitle} />
  );

  return <Box testID="WalletSelectorNavHeader">{content}</Box>;
}
