import { Pressable, Typography, VStack } from '@onekeyhq/components';

import { useWalletConnectQrcodeModal } from './useWalletConnectQrcodeModal';

export function WalletConnectDappSideTest(props: any) {
  // const { onPress, text, chainId, address } =
  //   useConnectExternalByWalletConnect();

  const { connectToWallet, clientRef } = useWalletConnectQrcodeModal();

  return (
    <>
      <Pressable
        {...props}
        // onPress={onPress}
        onPress={() => {
          connectToWallet().catch(console.error);
        }}
      >
        <VStack>
          <Typography.Body1>WalletConnectDappSide Connect</Typography.Body1>
        </VStack>
      </Pressable>
      <Pressable {...props} onPress={() => clientRef.current?.disconnect?.()}>
        <VStack>
          <Typography.Body1>WalletConnectDappSide Disconnect</Typography.Body1>
        </VStack>
      </Pressable>
    </>
  );
}
/*
localStorage.setItem('onekey@walletconnect-dapp-side',`{"connected":true,"accounts":["0xaB33c2E924Bb80914AB570fE99b11A7C91b6197A"],"chainId":12,"bridge":"https://k.bridge.walletconnect.org","key":"04ac01dccdb23c418a9a153fdb503bcc6f32df606ff258cf8b5975ae2d855000","clientId":"be3b321c-c090-4384-adf0-0d9db35e9747","clientMeta":{"description":"Connect with OneKey","url":"https://www.desktop-web.onekey.so","icons":["https://web.onekey-asset.com/portal/b688e1435d0d1e2e92581eb8dd7442c88da36049/icons/icon-256x256.png","https://www.onekey.so/favicon.ico"],"name":"OneKey desktop-web"},"peerId":"80b7698c-4af5-483c-b3ee-0bd6a002d000","peerMeta":{"description":"Rainbow makes exploring Ethereum fun and accessible 🌈","icons":["https://avatars2.githubusercontent.com/u/48327834?s=200&v=4"],"name":"🌈 Rainbow","ssl":true,"url":"https://rainbow.me"},"handshakeId":1658291085653000,"handshakeTopic":"1e67beb6-2f5f-4ad4-a0dd-a3792edfe000"}`)
 */
/*
window.c = this.state.connector
 */
/*
window.c.sendCustomRequest({"method":"session_request","params":[{"peerId":"f296fee3-0355-4411-85df-fe9422c1b7e9","peerMeta":{"description":"","url":"https://example.walletconnect.org","icons":["https://example.walletconnect.org/favicon.ico"],"name":"WalletConnect Example"},"chainId":null}]})
 */
