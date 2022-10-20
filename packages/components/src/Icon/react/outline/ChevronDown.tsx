import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChevronDown = (props: SvgProps) => (
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
      d="m19 9-7 7-7-7"
    />
  </Svg>
);
export default SvgChevronDown;
