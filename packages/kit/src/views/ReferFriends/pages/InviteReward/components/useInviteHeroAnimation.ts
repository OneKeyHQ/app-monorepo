import { useCallback, useEffect, useRef } from 'react';

import { useFocusEffect } from '@react-navigation/core';

import { usePageWidth } from '@onekeyhq/components';
import { getInviteCodeStepImageHeight } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';
import type { IInviteCodeStepImageControl } from '@onekeyhq/kit/src/views/ReferFriends/pages/ReferAFriend/components/InviteCodeStepImage';

// The compact hero's looping illustration holds still while it cannot be
// seen: scrolled past (it sits at the top of the content), covered by a
// pushed page (level, payout history and product pages stack over the
// referral page without unmounting it), or behind the Rewards tab. Every
// input lives in a ref and the animation is driven through its control, so
// none of this re-renders the page.
export function useInviteHeroAnimation(isInviteTab: boolean) {
  const controlRef = useRef<IInviteCodeStepImageControl>(null);
  const isFocusedRef = useRef(true);
  const isInviteTabRef = useRef(isInviteTab);
  const isScrolledAwayRef = useRef(false);

  const sync = useCallback(() => {
    controlRef.current?.setPaused(
      !isFocusedRef.current ||
        !isInviteTabRef.current ||
        isScrolledAwayRef.current,
    );
  }, []);

  useEffect(() => {
    isInviteTabRef.current = isInviteTab;
    sync();
  }, [isInviteTab, sync]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      sync();
      return () => {
        isFocusedRef.current = false;
        sync();
      };
    }, [sync]),
  );

  const illustrationHeight = getInviteCodeStepImageHeight(usePageWidth());
  const onScrollOffset = useCallback(
    (offsetY: number) => {
      const isScrolledAway = offsetY > illustrationHeight;
      if (isScrolledAway !== isScrolledAwayRef.current) {
        isScrolledAwayRef.current = isScrolledAway;
        sync();
      }
    },
    [illustrationHeight, sync],
  );

  return { controlRef, onScrollOffset };
}
