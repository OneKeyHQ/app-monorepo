import axios from 'axios';
import { OpenSeaAsset } from 'opensea-js/lib/types';

const OPENSEA_API_KEY = 'YOUR_KEY_HERE';

const config = {
    headers: { "X-API-KEY": OPENSEA_API_KEY, Accept: 'application/json' }
};

type AssetList = { assets: OpenSeaAsset[]; estimatedCount: number; }


function getAssets(
    owner: string,
    offset: number = 0,
    limit: number = 50,
    assetContractAddress?: string,
): Promise<AssetList> {

    var request = `https://api.opensea.io/api/v1/assets?offset=${offset}&limit=${limit}&`

    request += `owner=${owner}`

    if (assetContractAddress) {
        request += `asset_contract_address=${assetContractAddress}&`
    }

    return axios.get<AssetList>(request, config)
        .then((response) => {
            return response.data;
        });
}


function getAssetDetail(
    assetContractAddress: string,
    tokenId: string,
): Promise<OpenSeaAsset> {

    var request = `https://api.opensea.io/api/v1/asset/${assetContractAddress}/${tokenId}`

    return axios.get<OpenSeaAsset>(request, config)
        .then((response) => {
            return response.data;
        });
}


export type { OpenSeaAsset as asset } from 'opensea-js/lib/types';