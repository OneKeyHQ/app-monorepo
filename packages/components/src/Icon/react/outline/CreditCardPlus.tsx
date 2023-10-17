import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCreditCardPlus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 14v3m0 0v3m0-3h-3m3 0h3M3 10v7a2 2 0 0 0 2 2h7m-9-9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3H3Z"
    />
  </Svg>
);
export default SvgCreditCardPlus;
