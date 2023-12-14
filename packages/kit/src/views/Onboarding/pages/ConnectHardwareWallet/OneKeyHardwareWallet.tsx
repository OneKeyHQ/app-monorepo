import { useRef } from 'react';

import { ResizeMode, Video } from 'expo-av';

import { Button, Page } from '@onekeyhq/components';

export function OneKeyHardwareWallet() {
  const video = useRef(null);

  return (
    <Page>
      <Page.Header title="OneKey Hardware Wallet" />
      <Page.Body>
        <Video
          style={{
            flex: 1,
          }}
          videoStyle={{
            width: '100%',
            height: '100%',
          }}
          ref={video}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
          source={{
            uri: 'https://asset.onekey-asset.com/portal/5d73d49b1a8c5c0dee9f3df46afb3e5a70e27614/shop/hero/shop-hero-animation-compressed-v2.mp4',
          }}
        />
      </Page.Body>
      <Page.Footer
        onConfirm={() => console.log('clicked')}
        onConfirmText="Connect"
        footerHelper={<Button>Buy one</Button>}
      />
    </Page>
  );
}
