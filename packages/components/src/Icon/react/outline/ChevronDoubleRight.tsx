import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDoubleRight = (props: SvgProps) => (
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
      d="m13 5 7 7-7 7M5 5l7 7-7 7"
    />
  </Svg>
);
export default SvgChevronDoubleRight;
