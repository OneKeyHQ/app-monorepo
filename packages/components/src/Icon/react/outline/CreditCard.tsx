import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCreditCard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={2}
      d="M3 10v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M3 10V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3M3 10h18"
    />
  </Svg>
);
export default SvgCreditCard;
