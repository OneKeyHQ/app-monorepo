import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgColor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 7v1a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v1Zm0 0H5a1 1 0 0 0-1 1v3a2 2 0 0 0 2 2h7v2.5m2 5.5v-3a2 2 0 1 0-4 0v3"
    />
  </Svg>
);
export default SvgColor;
