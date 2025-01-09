import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCreditCardPlus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2H2V7Zm0 4v6a3 3 0 0 0 3 3h11a3 3 0 1 1 0-6 3 3 0 0 1 3-3H2Z"
    />
    <Path
      fill="currentColor"
      d="M20 14a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2h-2v-2Z"
    />
  </Svg>
);
export default SvgCreditCardPlus;
