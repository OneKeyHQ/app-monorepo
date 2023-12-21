import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSliderThree = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.951 2.997a1 1 0 0 1 1 1V10a1 1 0 1 1-2 0V3.997a1 1 0 0 1 1-1Zm6.05 0a1 1 0 0 1 1 1V8h.954a1 1 0 1 1 0 2h-1.939a.984.984 0 0 1-.032 0h-1.94a1 1 0 1 1 0-2H11V3.997a1 1 0 0 1 1-1Zm6.048 0a1 1 0 0 1 1 1v8.004a1 1 0 1 1-2 0V3.997a1 1 0 0 1 1-1ZM12 12.001a1 1 0 0 1 1 1v7.003a1 1 0 0 1-2 0V13a1 1 0 0 1 1-1Zm-9.004 2a1 1 0 0 1 1-1h3.91a1 1 0 1 1 0 2h-.955v5.003a1 1 0 0 1-2 0v-5.003h-.955a1 1 0 0 1-1-1Zm12.097 2.001a1 1 0 0 1 1-1h3.91a1 1 0 1 1 0 2h-.954v3.002a1 1 0 1 1-2 0v-3.002h-.956a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSliderThree;
