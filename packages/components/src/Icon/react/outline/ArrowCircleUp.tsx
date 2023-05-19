import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowCircleUp = (props: SvgProps) => (
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
      d="m9 11 3-3m0 0 3 3m-3-3v8m0-13a9 9 0 1 1 0 18 9 9 0 0 1 0-18z"
    />
  </Svg>
);
export default SvgArrowCircleUp;
