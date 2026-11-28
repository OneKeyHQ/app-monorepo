import { useCallback, useLayoutEffect, useState } from 'react';

import { flushSync } from 'react-dom';

import type { ISizableTextProps } from '@onekeyhq/components';

// Hero balances (home total, token detail) render at 48px on one line. On
// web the value keeps its natural size: `adjustsFontSizeToFit` is a native
// Text feature and `numberOfLines` alone would only ellipsize here. The
// native variant (`heroBalanceFit.native.ts`) shrinks the font instead
// (OK-65121).
export const HERO_BALANCE_FIT_PROPS: Pick<
  ISizableTextProps,
  'numberOfLines' | 'adjustsFontSizeToFit' | 'minimumFontScale'
> = {};

// Beside the home's actions, a total too long for its row steps down the type
// scale to the largest size that keeps it on one line; its line height stays
// 48, so the header doesn't move. Past the last step it wraps.
const ROW_FIT_SIZES = [48, 40, 32];

// `total` holds the text and sits first in its row, ahead of the refresh
// button. Each size is tried on one line as drawn, then the styles go back.
function measureRowFit(total: HTMLElement) {
  const row = total.parentElement;
  const text = total.firstElementChild;
  const last = row?.lastElementChild;
  if (!row || !last || !(text instanceof HTMLElement)) {
    return ROW_FIT_SIZES[0];
  }
  const nodes = [text, ...text.querySelectorAll<HTMLElement>('*')];
  const saved = nodes.map((node) => node.style.cssText);
  const setAll = (property: string, value: string) =>
    nodes.forEach((node) =>
      node.style.setProperty(property, value, 'important'),
    );
  setAll('white-space', 'nowrap');
  // The text's width now plus what the row leaves after its last item: the
  // same whether the text fits or is squeezed. 1px spare keeps a total that
  // only just fits from breaking on rounding.
  const rowRight =
    row.getBoundingClientRect().right -
    Number.parseFloat(getComputedStyle(row).paddingRight);
  const lastRight =
    last.getBoundingClientRect().right +
    Number.parseFloat(getComputedStyle(last).marginRight);
  const room = text.getBoundingClientRect().width + rowRight - lastRight - 1;
  const range = document.createRange();
  range.selectNodeContents(text);
  let size = ROW_FIT_SIZES[ROW_FIT_SIZES.length - 1];
  for (const step of ROW_FIT_SIZES) {
    setAll('font-size', `${step}px`);
    if (range.getBoundingClientRect().width <= room) {
      size = step;
      break;
    }
  }
  nodes.forEach((node, index) => {
    node.style.cssText = saved[index];
  });
  return size;
}

export function useHeroBalanceRowFit(inBalanceRow: boolean) {
  const [total, setTotal] = useState<HTMLElement | null>(null);
  const [fontSize, setFontSize] = useState(ROW_FIT_SIZES[0]);
  const ref = useCallback((node: unknown) => {
    setTotal(node instanceof HTMLElement ? node : null);
  }, []);
  useLayoutEffect(() => {
    if (!inBalanceRow || !total) {
      return;
    }
    setFontSize(measureRowFit(total));
    let active = true;
    // A new value, a resized row, or a late font. Applied before the frame
    // paints, so a long total never shows wrapped first. Only the row is
    // watched for size: its width doesn't follow the total's font size.
    const refit = () => {
      if (!active) {
        return;
      }
      const size = measureRowFit(total);
      flushSync(() => setFontSize(size));
    };
    const resize = new ResizeObserver(refit);
    if (total.parentElement) {
      resize.observe(total.parentElement);
    }
    const mutation = new MutationObserver(refit);
    mutation.observe(total, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    void document.fonts?.ready.then(refit);
    return () => {
      active = false;
      resize.disconnect();
      mutation.disconnect();
    };
  }, [inBalanceRow, total]);
  return { ref, fontSize: inBalanceRow ? fontSize : ROW_FIT_SIZES[0] };
}
