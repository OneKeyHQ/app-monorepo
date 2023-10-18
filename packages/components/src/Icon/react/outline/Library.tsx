import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLibrary = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v16M9 4v16m5-16 6 16"
    />
  </Svg>
);
export default SvgLibrary;
