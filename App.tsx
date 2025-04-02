import { setUpReanimated } from 'moti';

setUpReanimated({
  disableWebBehavior: true,
  reduceMotion: false,
  // 尝试设置这个属性，虽然这不是官方文档中的配置项
  // 但由于 Moti 是基于 Reanimated 的，这个配置可能会生效
  background: true,
});
