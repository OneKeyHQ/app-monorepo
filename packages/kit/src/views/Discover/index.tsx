import React from 'react';

import Explorer from './Explorer';
// import WebView from '../../components/WebView';

const Discover = () => <Explorer />;

// const Discover = () => {
//   const { themeVariant } = useTheme();
//   const { locale } = useLocale();
//   let initialUrl = `https://discover.test.onekey.so/?theme=${themeVariant}&locale=${locale}`;
//   if (platformEnv.isDev) {
//     initialUrl = 'https://metamask.github.io/test-dapp/';
//     // initialUrl = 'https://example.walletconnect.org/';
//   }
//   const [url, setUrl] = useState(initialUrl);
//   console.log('Discover url changed: ', url);
//   return (
//     <Box flex="1" bg="background-default">
//       {url !== initialUrl && (
//         <IconButton
//           name="ArrowLeftSolid"
//           position="absolute"
//           left={4}
//           bottom={4}
//           zIndex={1}
//           onPress={() => setUrl(initialUrl)}
//         />
//       )}
//       <WebView src={url} onSrcChange={setUrl} />
//     </Box>
//   );
// };

export default Discover;
