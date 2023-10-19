import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageSquare2Mountains = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m4 16 3.293-3.293a1 1 0 0 1 1.414 0L12 16l1.293-1.293a1 1 0 0 1 1.414 0L19 19M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Zm9.25-11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    />
  </Svg>
);
export default SvgImageSquare2Mountains;
