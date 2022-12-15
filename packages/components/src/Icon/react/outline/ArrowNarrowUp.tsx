import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowNarrowUp = (props: SvgProps) => (
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
      d="m8 7 4-4m0 0 4 4m-4-4v18"
    />
  </Svg>
);
export default SvgArrowNarrowUp;
