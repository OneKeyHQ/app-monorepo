import { LottieView } from '@onekeyhq/components/src/content/LottieView';
import type { ILottieViewProps } from '@onekeyhq/components/src/content/LottieView';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Real app animations live under @onekeyhq/kit assets, which components
// stories must not import (package hierarchy) — a tiny inline pulse keeps
// the story self-contained. Inclusive of both runtimes: lottie-react (web,
// lazy-loaded) and lottie-react-native.
const PULSE_DOT: ILottieViewProps['source'] = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 60,
  w: 160,
  h: 160,
  nm: 'pulse',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'dot',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [80, 80, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            {
              t: 0,
              s: [55, 55, 100],
              o: { x: [0.4], y: [0] },
              i: { x: [0.6], y: [1] },
            },
            {
              t: 30,
              s: [100, 100, 100],
              o: { x: [0.4], y: [0] },
              i: { x: [0.6], y: [1] },
            },
            { t: 60, s: [55, 55, 100] },
          ],
        },
      },
      shapes: [
        {
          ty: 'gr',
          nm: 'circle',
          it: [
            { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [90, 90] } },
            {
              ty: 'fl',
              c: { a: 0, k: [0.18, 0.72, 0.47, 1] },
              o: { a: 0, k: 100 },
            },
            {
              ty: 'tr',
              p: { a: 0, k: [0, 0] },
              a: { a: 0, k: [0, 0] },
              s: { a: 0, k: [100, 100] },
              r: { a: 0, k: 0 },
              o: { a: 0, k: 100 },
            },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    },
  ],
};

// autoPlay defaults differ per platform (native true, web false) — set it
// explicitly so both shells animate.
const meta = {
  title: 'Content/LottieView',
  component: LottieView,
  args: {
    source: PULSE_DOT,
    autoPlay: true,
    loop: true,
    width: 160,
    height: 160,
  },
} satisfies Meta<typeof LottieView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Paused: Story = {
  args: {
    autoPlay: false,
  },
};
