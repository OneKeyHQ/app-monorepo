import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSearchCircle = (props: SvgProps) => (
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
      d="m8 16 2.879-2.879m0 0a3 3 0 1 0 4.243-4.242 3 3 0 0 0-4.243 4.242zM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
    />
  </Svg>
);
export default SvgSearchCircle;
