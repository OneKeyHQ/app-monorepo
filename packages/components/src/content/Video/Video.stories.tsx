import {
  EVideoResizeMode,
  Video,
} from '@onekeyhq/components/src/content/Video';

import type { Meta, StoryObj } from '@storybook/react-native-web-vite';

// Product hero clip served from the OneKey CDN (Device Management
// plays the same file).
const HERO_VIDEO_URI =
  'https://asset.onekey-asset.com/app-monorepo/bb7a4e71aba56b405faf9278776d57d73b829708/static/media/mydevice_hero_light.mp4';

// HTML5 <video> on web, react-native-video on native. Keep it muted:
// browsers only allow muted autoplay, and the web build starts
// playback on mount.
const meta = {
  title: 'Content/Video',
  component: Video,
  args: {
    source: { uri: HERO_VIDEO_URI },
    muted: true,
    repeat: true,
    resizeMode: EVideoResizeMode.COVER,
    w: 320,
    h: 180,
    borderRadius: '$3',
  },
} satisfies Meta<typeof Video>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Paused: Story = {
  args: {
    paused: true,
  },
};
