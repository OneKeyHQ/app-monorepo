# TODO

- routes/routesEnum.ts ( background navigate() )
- @onekeyhq/app/src/hardware/OnekeyLite
- navigation url required hash url ( @react-navigation+native+6.0.6.patch useLinking.js )
  - deep linking in ios/android 
- EngineProvider.tsx to background
  - EngineProxy
  - listFiats() ReferenceError: XMLHttpRequest is not defined
    - cross-fetch ( cross-fetch+3.1.4.patch )
  - all api needs to be async promise
  - method params and return should be serialized
  - property not available
  - using @backgroundMethod() 
- axios
  - axios-fetch-adapter
- https://metamask.github.io/test-dapp/ Error: missing provider ( manifest v3 inject delay )
  - https://github.com/MetaMask/test-dapp
  - Network disable cache, Network throttling
- useSWR in background
- redux-persist in background
  - extensionStorage for redux
  - AsyncStorage -> appStorage
- backgroundApi safe check: 
  - other extension call; 
  - background and ui message with random password; 
- background redux state init (with engine init)
  - render UI after background redux state sync done
  - getImplFromNetworkId ERROR: networkId required (first time open UI after extension reload)
- @backgroundClass
  - Engine
  - BackgroundApi
  - ServiceApi
  - ProviderApi
- NetworkService\AccountService\DappService\PromiseService\EngineService
  - ServiceAccount
- axios singleton 
- JsBridgeBase: plain error object
- eth_accounts whitelist domain
- show popup close button when background not ready ( port ready & redux ready )
- internetReachability.ts
- persistor.purge();

- onBoarding Done.tsx
- import type from UI component

# DONE
