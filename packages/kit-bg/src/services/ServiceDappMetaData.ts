import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getFiatEndpoint } from '@onekeyhq/engine/src/endpoint';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import ServiceBase from './ServiceBase';

export type UrlInfo = {
  title?: string;
  icon?: string;
};

@backgroundClass()
class ServiceDappMetaData extends ServiceBase {
  get baseUrl() {
    const url = getFiatEndpoint();
    return `${url}/discover`;
  }

  private getUrlKey(url: string) {
    let result = url;
    try {
      const u = new URL(url);
      result = `${u.origin}${u.pathname}${u.search}`;
    } catch {
      debugLogger.common.error(`failed to get url key: ${url}`);
    }
    return result;
  }

  private async fetchUrlInfo(input: string) {
    const { baseUrl } = this;
    const url = `${baseUrl}/url_info`;
    const res = await this.client.post(url, { url: input });
    const data = res.data as UrlInfo;
    return data;
  }

  @backgroundMethod()
  async getUrlMeta({ url }: { url: string }) {
    const key = this.getUrlKey(url);
    const item = await simpleDb.urlInfo.getItem(key);
    if (item) {
      return item;
    }
    try {
      const urlInfo = await this.fetchUrlInfo(url);
      if (urlInfo) {
        const entity = { title: urlInfo.title, icon: urlInfo.icon };
        await simpleDb.urlInfo.setItem(key, entity);
        return entity;
      }
    } catch (e: unknown) {
      debugLogger.common.error(
        `failed to fetch dapp url info with reason ${(e as Error).message}`,
      );
      return { title: '', icon: '' };
    }
  }
}

export default ServiceDappMetaData;
