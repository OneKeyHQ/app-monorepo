import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTrendingDown = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 17h8m0 0V9m0 8-8-8-4 4-6-6"
    />
  </Svg>
);
export default SvgTrendingDown;
