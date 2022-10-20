import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSelector = (props: SvgProps) => (
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
      d="m8 9 4-4 4 4m0 6-4 4-4-4"
    />
  </Svg>
);
export default SvgSelector;
