import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCreditCardCvv = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M5 4a3 3 0 0 0-3 3v2h20V7a3 3 0 0 0-3-3H5Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 17v-6h20v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Zm5-4a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCreditCardCvv;
