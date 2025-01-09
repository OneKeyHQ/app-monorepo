import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPrinter = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 2a3 3 0 0 0-3 3v1H5a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h1v1a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-1h1a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-1V5a3 3 0 0 0-3-3H9Zm7 4V5a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1h8Zm0 9H8v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4ZM6 11a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPrinter;
