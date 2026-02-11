import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCirclePlaceholderOff = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M3.043 3.043a1 1 0 0 1 1.414 0l16.5 16.5a1 1 0 1 1-1.414 1.414l-1.216-1.216A9.96 9.96 0 0 1 12 22C6.477 22 2 17.523 2 12c0-2.4.848-4.605 2.258-6.328L3.043 4.457a1 1 0 0 1 0-1.414M20 12a8 8 0 0 0-8-8 8 8 0 0 0-2.555.416 1 1 0 1 1-.638-1.895A10 10 0 0 1 12 2c5.523 0 10 4.477 10 10 0 1.115-.182 2.19-.52 3.193a1.001 1.001 0 0 1-1.896-.638c.27-.801.416-1.66.416-2.555M4 12a8 8 0 0 0 12.904 6.318L5.681 7.095A7.96 7.96 0 0 0 4 12" />
  </Svg>
);
export default SvgCirclePlaceholderOff;
