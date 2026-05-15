import { forwardRef } from 'react';
import type { ReactNode, Ref } from 'react';

import type {
  INativeHomeTabsProps,
  INativeHomeTabsRef,
} from './NativeHomeTabs';

export type {
  INativeHomeTabsProps,
  INativeHomeTabsRef,
} from './NativeHomeTabs';
export type * from './types';

function Header(_props: { children: ReactNode }) {
  return null;
}

function Slot(_props: { slotId: string; children: ReactNode }) {
  return null;
}

function NativeHomeTabsRootImpl(
  _props: INativeHomeTabsProps,
  _ref: Ref<INativeHomeTabsRef>,
) {
  return null;
}

const NativeHomeTabsRoot = forwardRef<INativeHomeTabsRef, INativeHomeTabsProps>(
  NativeHomeTabsRootImpl,
);

export const NativeHomeTabs = Object.assign(NativeHomeTabsRoot, {
  Header,
  Slot,
});
