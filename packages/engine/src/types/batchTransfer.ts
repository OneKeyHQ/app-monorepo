export enum BatchTransferMethods {
  disperseNFT = 'disperseNFT(address,address[],uint256[],uint256[])',
  disperseEther = 'disperseEther(address[],uint256[])',
  disperseToken = 'disperseToken(address,address[],uint256[])',
  disperseTokenSimple = 'disperseTokenSimple(address,address[],uint256[])',
  disperseEtherSameValue = 'disperseEtherSameValue(address[],uint256)',
  disperseTokenSameValue = 'disperseTokenSameValue(address,address[],uint256)',
}

export enum BatchTransferSelectors {
  disperseNFT = '0x39039af6',
  disperseEther = '0xe63d38ed',
  disperseToken = '0xc73a2d60',
  disperseTokenSimple = '0x51ba162c',
  disperseEtherSameValue = '0xc263a3e4',
  disperseTokenSameValue = '0x17546c6c',
}

export enum BulkTypeEnum {
  OneToMany = 'OneToMany',
  ManyToMany = 'ManyToMany',
  ManyToOne = 'ManyToOne',
}
