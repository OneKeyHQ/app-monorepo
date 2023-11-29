import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgTelevision = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7.5 3.5 12 7l4.5-3.5M5 20h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgTelevision;
