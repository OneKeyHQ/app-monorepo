import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShield = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 4.11 5.02 6.508v5.432c0 2.16.849 3.677 2.181 4.938 1.273 1.205 2.957 2.15 4.8 3.146 1.841-.997 3.526-1.941 4.798-3.146 1.332-1.261 2.181-2.778 2.181-4.938V6.51L12 4.109Zm8.974 7.831c0 2.8-1.145 4.817-2.804 6.387-1.61 1.525-3.735 2.652-5.697 3.71a1 1 0 0 1-.946 0c-1.962-1.058-4.086-2.185-5.697-3.71-1.659-1.57-2.804-3.588-2.804-6.387V6.51c0-.852.54-1.61 1.346-1.886l6.98-2.4c.42-.144.877-.144 1.297 0l6.98 2.4a1.99 1.99 0 0 1 1.345 1.886z" />
  </Svg>
);
export default SvgShield;
