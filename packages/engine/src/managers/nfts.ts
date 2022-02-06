import { OpenSeaPort, Network } from 'opensea-js'
import { OpenSeaAssetQuery } from 'opensea-js/lib/types';

const network = Network.Main;   // default main network, support mainnet, rinkeby
const apiKey = 'YOUR_API_KEY';  // your API key

class NFTAssets {
    private static instance: NFTAssets;

    private network: Network;
    private _seaport: OpenSeaPort;

    private constructor(apiKey: string, _network?: Network,) {
        this.network = _network || Network.Main;
        this._seaport = new OpenSeaPort(null, {
            networkName: this.network,
            apiKey: apiKey
        });
    }

    public static getInstance(): NFTAssets {
        if (!NFTAssets.instance) {
            NFTAssets.instance = new NFTAssets(apiKey, network)
        }
        return this.instance;
    }

    public async getAssets(
        query: OpenSeaAssetQuery = {
            offset: 0,
            limit: 50,
        },
        page: number,
        network?: Network,
    ) {
        if (typeof network !== 'undefined' && network !== this.network) {
            this.changeNetwork(network);
        }

        return await this._seaport.api.getAssets(query, page);
    };

    public async getAsset(
        tokenaddress: string,
        tokenId: string | number | null,
        network?: Network,
    ) {
        if (typeof network !== 'undefined' && network !== this.network) {
            this.changeNetwork(network);
        }
        return await this._seaport.api.getAsset({
            tokenAddress: tokenaddress,
            tokenId: tokenId
        });
    }

    private async changeNetwork(network: Network) {
        this.network = network;

        this._seaport = new OpenSeaPort(null, {
            networkName: this.network,
            apiKey: apiKey
        });
    }
}

export { NFTAssets }
export type { OpenSeaAsset as asset, OpenSeaAssetQuery as assetQuery } from 'opensea-js/lib/types';
