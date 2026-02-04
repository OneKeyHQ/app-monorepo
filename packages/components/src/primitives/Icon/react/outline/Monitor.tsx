import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMonitor = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4.216 8.351v10.703h15.568V8.351zM21.73 19.054A1.946 1.946 0 0 1 19.784 21H4.216a1.946 1.946 0 0 1-1.946-1.946V8.351c0-1.074.871-1.946 1.946-1.946h4.949L7.024 4.741a.973.973 0 0 1 1.195-1.536L12 6.145l3.78-2.94a.973.973 0 0 1 1.196 1.536l-2.14 1.664h4.948c1.075 0 1.946.872 1.946 1.946z" />
  </Svg>
);
export default SvgMonitor;
