import { BOT_WALLET_STATUS_ACTIVE } from '@onekeyhq/shared/src/consts/dbConsts';

import { SimpleDbEntityBotWallet } from './SimpleDbEntityBotWallet';

function createBotMetadata(index: number, name = `Bot #${index + 1}`) {
  return {
    index,
    name,
    visible: false,
    status: BOT_WALLET_STATUS_ACTIVE,
    createdAt: index + 1,
  };
}

describe('SimpleDbEntityBotWallet.replaceMetadataForParent', () => {
  test('replaces only the specified parent wallet metadata', async () => {
    const entity = new SimpleDbEntityBotWallet();
    const existingMap = {
      'hd-bot--hd-parent--0': createBotMetadata(0, 'Old Bot'),
      'hd-bot--hd-other--1': {
        ...createBotMetadata(1, 'Other Parent Bot'),
        visible: true,
      },
    };
    const getRawData = jest
      .spyOn(entity, 'getRawData')
      .mockResolvedValue(existingMap as any);
    const setRawData = jest
      .spyOn(entity, 'setRawData')
      .mockResolvedValue(existingMap as any);

    await entity.replaceMetadataForParent('hd-parent', [
      {
        metadata: {
          ...createBotMetadata(2, 'New Bot'),
          visible: true,
        },
      },
    ]);

    expect(getRawData).toHaveBeenCalled();
    expect(setRawData).toHaveBeenCalledWith({
      'hd-bot--hd-other--1': {
        ...createBotMetadata(1, 'Other Parent Bot'),
        visible: true,
      },
      'hd-bot--hd-parent--2': {
        ...createBotMetadata(2, 'New Bot'),
        visible: true,
      },
    });
  });
});

describe('SimpleDbEntityBotWallet.getNextIndex', () => {
  test('returns the first gap for the specified parent wallet', async () => {
    const entity = new SimpleDbEntityBotWallet();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      'hd-bot--hd-parent--0': createBotMetadata(0),
      'hd-bot--hd-parent--2': createBotMetadata(2),
      'hd-bot--hd-parent--3': createBotMetadata(3),
      'hd-bot--hd-other--1': createBotMetadata(1),
    } as any);

    await expect(entity.getNextIndex('hd-parent')).resolves.toBe(1);
  });

  test('ignores invalid indexes and falls back to zero when empty', async () => {
    const entity = new SimpleDbEntityBotWallet();
    jest.spyOn(entity, 'getRawData').mockResolvedValue({
      'hd-bot--hd-parent---1': createBotMetadata(-1),
      'hd-bot--hd-parent--x': {
        ...createBotMetadata(0),
        index: Number.NaN,
      },
    } as any);

    await expect(entity.getNextIndex('hd-parent')).resolves.toBe(0);
  });
});
