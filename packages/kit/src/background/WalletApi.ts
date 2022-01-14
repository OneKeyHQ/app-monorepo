// TODO rename to BackgroundService, WalletService, ProviderService?
class WalletApi {
  accounts = [
    '0x76f3f64cb3cd19debee51436df630a342b736c24',
    '0x99f825d80cadd21d77d13b7e13d25960b40a6299',
    '0xc8f560c412b345aa6a5dce56d32d36d1af0b4f2a',
    '0xfb7def5f39f977c4d0e28a648ccb16d4f254aef0',
    '0x76b4a2de2e67ef5ee4a5050352aec077208fc7f1',
  ];

  chainId = '0x1'; // 0x3 Ropsten

  networkVersion = '1';

  selectedAddress = this.accounts[0];

  isConnected = true; // current dapp isConnected
}

export default WalletApi;
