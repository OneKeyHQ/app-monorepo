import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShield = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 7.177a2 2 0 0 0-1.35-1.891l-6-2.062a2 2 0 0 0-1.3 0l-6 2.062A2 2 0 0 0 4 7.177v4.735c0 4.973 4 7.088 8 9.246 4-2.158 8-4.273 8-9.246V7.177Z"
    />
  </Svg>
);
export default SvgShield;
