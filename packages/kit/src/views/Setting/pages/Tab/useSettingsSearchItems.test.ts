import { ESettingsTabNames } from '@onekeyhq/shared/src/routes';

import { flattenSettingsSearchItems } from './settingsSearchItems';

import type { ISettingsConfig } from './config';

describe('flattenSettingsSearchItems', () => {
  it('excludes entries explicitly hidden from settings search', () => {
    const config = [
      {
        name: ESettingsTabNames.Security,
        icon: 'ShieldCheckDoneOutline',
        title: 'Security',
        configs: [
          [
            { id: 'visible', title: 'Visible' },
            { id: 'travel-mode', title: 'Travel Mode', searchable: false },
          ],
        ],
      },
    ] as ISettingsConfig;

    expect(
      flattenSettingsSearchItems(config, true).map((item) => item.id),
    ).toEqual(['visible']);
  });
});
