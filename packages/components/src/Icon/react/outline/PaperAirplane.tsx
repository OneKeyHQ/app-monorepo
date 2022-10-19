import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPaperAirplane = (props: SvgProps) => (
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
      d="m12 19 9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </Svg>
);
export default SvgPaperAirplane;
