import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiStar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 22c0-3.188-.669-5.256-1.882-6.536C7.917 14.195 5.99 13.5 3 13.5a1 1 0 1 1 0-2c2.99 0 4.917-.695 6.118-1.964C10.331 8.256 11 6.188 11 3a1 1 0 1 1 2 0c0 3.188.669 5.256 1.882 6.536C16.084 10.805 18.01 11.5 21 11.5a1 1 0 1 1 0 2c-2.99 0-4.916.695-6.118 1.964C13.669 16.744 13 18.812 13 22a1 1 0 1 1-2 0m1-13.274a7.6 7.6 0 0 1-1.43 2.186A7.3 7.3 0 0 1 8.344 12.5a7.3 7.3 0 0 1 2.224 1.588A7.6 7.6 0 0 1 12 16.273a7.6 7.6 0 0 1 1.43-2.185 7.3 7.3 0 0 1 2.224-1.588 7.3 7.3 0 0 1-2.223-1.588A7.6 7.6 0 0 1 12 8.726" />
  </Svg>
);
export default SvgAiStar;
