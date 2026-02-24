import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRotateClockwise = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 3v6h-6V7h2.759a8.3 8.3 0 0 0-1.384-1.085C14.418 5.327 13.342 5 11.973 5a7 7 0 1 0 6.601 9.333L20.46 15a9 9 0 1 1-8.487-12c1.726 0 3.165.423 4.448 1.21.56.344 1.082.753 1.579 1.213V3z" />
  </Svg>
);
export default SvgRotateClockwise;
