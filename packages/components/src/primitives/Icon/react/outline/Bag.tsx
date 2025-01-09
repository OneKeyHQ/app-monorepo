import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBag = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 11V4h8v7M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
    />
  </Svg>
);
export default SvgBag;
