import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowSmallRight = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 12h15m0 0-6.75-6.75M19.5 12l-6.75 6.75"
    />
  </Svg>
);
export default SvgArrowSmallRight;
