import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMinusCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm14 1a1 1 0 1 0 0-2H8a1 1 0 0 0 0 2h8Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMinusCircle;
