import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAiStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 3a1 1 0 1 0-2 0c0 3.188-.669 5.256-1.882 6.536C7.916 10.805 5.99 11.5 3 11.5a1 1 0 1 0 0 2c2.99 0 4.916.695 6.118 1.964C10.33 16.744 11 18.812 11 22a1 1 0 1 0 2 0c0-3.188.669-5.256 1.882-6.536C16.084 14.195 18.01 13.5 21 13.5a1 1 0 1 0 0-2c-2.99 0-4.916-.695-6.118-1.964C13.67 8.256 13 6.188 13 3Z"
    />
  </Svg>
);
export default SvgAiStar;
