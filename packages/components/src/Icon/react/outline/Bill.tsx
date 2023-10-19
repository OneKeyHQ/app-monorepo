import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBill = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 8h6m-6 4h2m8 9V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16l2.333-2 2.334 2L12 19l2.333 2 2.334-2L19 21Z"
    />
  </Svg>
);
export default SvgBill;
