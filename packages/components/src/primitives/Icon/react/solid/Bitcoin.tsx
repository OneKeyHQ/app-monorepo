import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBitcoin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13.25 14.5a.75.75 0 0 0 0-1.5H11v1.5h2.25ZM11 9.5h2.25a.75.75 0 0 1 0 1.5H11V9.5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm6.5-4.5a1 1 0 0 0 0 2H9v5h-.5a1 1 0 1 0 0 2H11v.5a1 1 0 1 0 2 0v-.5h.25a2.75 2.75 0 0 0 2.121-4.5 2.75 2.75 0 0 0-2.121-4.5H13V7a1 1 0 1 0-2 0v.5H8.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBitcoin;
