import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeople = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 11.986c4.177 0 7.235 2.801 8.068 6.505.281 1.253-.746 2.238-1.849 2.238H5.78c-1.102 0-2.13-.985-1.848-2.238l.085-.344c.94-3.532 3.937-6.161 7.984-6.161Zm0 1.943c-3.149 0-5.45 2.038-6.14 4.857h12.28c-.69-2.819-2.99-4.857-6.14-4.857m2.43-7.287a2.43 2.43 0 1 0-4.86.001 2.43 2.43 0 0 0 4.86 0Zm1.942 0a4.372 4.372 0 1 1-8.744 0 4.372 4.372 0 0 1 8.744 0" />
  </Svg>
);
export default SvgPeople;
