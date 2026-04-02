import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMoonStar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.278 1.968A6.96 6.96 0 0 0 11.001 6a7 7 0 0 0 11.032 5.723 10 10 0 0 1-.23 2.436c-.988 4.503-5 7.873-9.8 7.873-5.542 0-10.034-4.492-10.034-10.034 0-4.8 3.37-8.812 7.873-9.8a10 10 0 0 1 2.436-.23M9.127 4.494a8.034 8.034 0 1 0 10.38 10.38 9 9 0 0 1-10.38-10.38"
      clipRule="evenodd"
    />
    <Path d="M18.668 5.333 21.001 6.5l-2.333 1.167L17.501 10l-1.167-2.333L14.001 6.5l2.333-1.167L17.501 3z" />
  </Svg>
);
export default SvgMoonStar;
