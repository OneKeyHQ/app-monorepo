/* cspell:ignore hoverable */
import { useCallback, useId, useLayoutEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Icon,
  Popover,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const ONEKEY_ID_USAGE_TRACK_ID = 'onekey-id-usage';

function OneKeyIdUsageItem({
  icon,
  title,
  description,
}: {
  icon: IKeyOfIcons;
  title: string;
  description: string;
}) {
  return (
    <XStack gap="$3" alignItems="flex-start">
      <XStack w="$6" h="$6" alignItems="center" justifyContent="center">
        <Icon name={icon} size="$5" color="$iconSubdued" />
      </XStack>
      <YStack flex={1}>
        <SizableText size="$bodyMdMedium">{title}</SizableText>
        <SizableText size="$bodyMd" color="$textSubdued">
          {description}
        </SizableText>
      </YStack>
    </XStack>
  );
}

// Explains what OneKey ID is for, opened from the login dialog subtitle link.
// Wide web windows anchor a panel to the link element, which a hover can open
// while `hoverable`; native (phones and iPad alike) and narrow web windows
// always use a bottom sheet opened by a press, so nothing depends on
// measuring the inline link on native.
export function OneKeyIdUsagePopover({
  open,
  onOpenChange,
  hoverable,
  contentId,
  webAnchorElement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hoverable: boolean;
  /** Lets the web link point at the panel it opens. */
  contentId: string;
  webAnchorElement?: HTMLElement;
}) {
  const intl = useIntl();
  const { md } = useMedia();
  const title = intl.formatMessage({
    id: ETranslations.onekey_id_usage__title,
  });
  const titleId = useId();
  // The sheet header shows the title; the anchored panel has no header.
  const isAnchoredPanel = !platformEnv.isNative && !md;

  // The overlay keeps how it was registered (modal or not) for as long as it
  // is shown, so a window crossing the breakpoint closes the panel; the next
  // press opens it in the new form.
  const wasAnchoredPanelRef = useRef(isAnchoredPanel);
  useLayoutEffect(() => {
    if (wasAnchoredPanelRef.current === isAnchoredPanel) {
      return;
    }
    wasAnchoredPanelRef.current = isAnchoredPanel;
    if (open) {
      onOpenChange(false);
    }
  }, [isAnchoredPanel, onOpenChange, open]);

  // A press or key open (not a hover one) moves focus into the panel, which
  // has nothing focusable of its own; closing returns it to the link.
  const contentRef = useRef<HTMLElement | null>(null);
  const handleContentRef = useCallback((node: unknown) => {
    contentRef.current = node instanceof HTMLElement ? node : null;
  }, []);
  const floatingPanelProps = useMemo(
    () => ({
      onOpenAutoFocus: (event: Event) => {
        event.preventDefault();
        contentRef.current?.focus();
      },
    }),
    [],
  );
  return (
    <Popover
      title={title}
      open={open}
      onOpenChange={onOpenChange}
      renderTrigger={null}
      webAnchorElement={webAnchorElement}
      hoverable={hoverable}
      // Escape closes it also as a hover panel, instead of the login dialog.
      dismissOnEscape
      nativePresentation="sheet"
      placement="bottom-start"
      trackID={ONEKEY_ID_USAGE_TRACK_ID}
      floatingPanelProps={floatingPanelProps}
      renderContent={
        <YStack
          ref={handleContentRef}
          testID="onekey-id-usage-content"
          id={contentId}
          p="$5"
          pt={isAnchoredPanel ? '$5' : '$0'}
          gap="$4"
          {...(isAnchoredPanel
            ? {
                tabIndex: -1,
                role: 'dialog',
                'aria-labelledby': titleId,
                focusVisibleStyle: { outlineWidth: 0 },
              }
            : {})}
        >
          {isAnchoredPanel ? (
            <SizableText id={titleId} size="$headingMd">
              {title}
            </SizableText>
          ) : null}
          <OneKeyIdUsageItem
            icon="CloudOutline"
            title={intl.formatMessage({ id: ETranslations.keyless_wallet })}
            description={intl.formatMessage({
              id: ETranslations.onekey_id_usage_keyless__desc,
            })}
          />
          <OneKeyIdUsageItem
            icon="PrimeOutline"
            title={intl.formatMessage({ id: ETranslations.global_prime })}
            description={intl.formatMessage({
              id: ETranslations.onekey_id_usage_prime__desc,
            })}
          />
          <OneKeyIdUsageItem
            icon="GiftOutline"
            title={intl.formatMessage({
              id: ETranslations.id_refer_a_friend,
            })}
            description={intl.formatMessage({
              id: ETranslations.onekey_id_usage_referral__desc,
            })}
          />
        </YStack>
      }
    />
  );
}
