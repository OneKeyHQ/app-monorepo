import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMacinthosh = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v11a2.99 2.99 0 0 1-1 2.236V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-1.764c-.614-.55-1-1.348-1-2.236V5Zm3-1a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H7Zm0 2a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6Zm6 9a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMacinthosh;
