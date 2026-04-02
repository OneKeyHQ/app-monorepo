import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface ISimpleDBWalletStatus {
  // Once these values are set to true, they cannot be updated to false
  walletStatus: Record<
    string,
    {
      manuallyCloseReceiveBlock?: boolean;
      manuallyCloseReferralCodeBlock?: boolean;
      hasValue?: boolean;
    }
  >; // <wallet xfp, status>
}

export class SimpleDbEntityWalletStatus extends SimpleDbEntityBase<ISimpleDBWalletStatus> {
  entityName = 'walletStatus';

  override enableCache = true;

  @backgroundMethod()
  async updateWalletStatus(
    walletXfp: string,
    status: {
      manuallyCloseReceiveBlock?: boolean;
      manuallyCloseReferralCodeBlock?: boolean;
      hasValue?: boolean;
    },
  ) {
    await this.setRawData((v) => {
      const data = { ...v?.walletStatus };
      if (data?.[walletXfp]) {
        if (!data?.[walletXfp].manuallyCloseReceiveBlock) {
          data[walletXfp].manuallyCloseReceiveBlock =
            status.manuallyCloseReceiveBlock;
        }
        if (!data?.[walletXfp].manuallyCloseReferralCodeBlock) {
          data[walletXfp].manuallyCloseReferralCodeBlock =
            status.manuallyCloseReferralCodeBlock;
        }
        if (!data?.[walletXfp].hasValue) {
          data[walletXfp].hasValue = status.hasValue;
        }
      } else {
        data[walletXfp] = status;
      }

      return {
        ...v,
        walletStatus: data,
      };
    });
  }

  async getWalletStatus({ walletXfp }: { walletXfp: string }): Promise<{
    manuallyCloseReceiveBlock?: boolean;
    manuallyCloseReferralCodeBlock?: boolean;
    hasValue?: boolean;
  }> {
    const data = await this.getRawData();
    return data?.walletStatus?.[walletXfp] ?? {};
  }
}
