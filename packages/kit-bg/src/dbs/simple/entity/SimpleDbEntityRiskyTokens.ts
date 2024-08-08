import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IRiskyTokens {
  confirmedRiskTokens: string[]; // networkId_contractAddress
}

export class SimpleDbEntityRiskyTokens extends SimpleDbEntityBase<IRiskyTokens> {
  entityName = 'riskyTokens';

  override enableCache = false;

  @backgroundMethod()
  async getConfirmedRiskTokens() {
    return (await this.getRawData())?.confirmedRiskTokens ?? [];
  }

  @backgroundMethod()
  async addConfirmedRiskTokens(tokens: string[]) {
    await this.setRawData(({ rawData }) => ({
      confirmedRiskTokens: Array.from(
        new Set([...(rawData?.confirmedRiskTokens ?? []), ...tokens]),
      ),
    }));
  }
}
