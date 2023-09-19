const { loadTamagui } = require('@tamagui/static');
const path = require('path');

loadTamagui({
  config: path.resolve(__dirname, '../packages/components/tamagui.config.ts'),
  components: ['tamagui'],
});
