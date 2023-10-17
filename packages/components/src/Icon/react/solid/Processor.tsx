import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgProcessor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12 9.999a2.001 2.001 0 1 0 0 4.003 2.001 2.001 0 0 0 0-4.003Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M9 2.996a1 1 0 0 0-2 0V4a3 3 0 0 0-3 3H3a1 1 0 0 0 0 2h1v2H3a1 1 0 1 0 0 2h1v2H3a1 1 0 1 0 0 2h1a3 3 0 0 0 3 3v1a1 1 0 1 0 2 0v-1h2v1a1 1 0 1 0 2 0v-1h2v1a1 1 0 1 0 2 0v-1a3 3 0 0 0 3-3h1a1 1 0 1 0 0-2h-1v-2h1a1 1 0 1 0 0-2h-1V9h1a1 1 0 1 0 0-2h-1a3 3 0 0 0-3-3V3a1 1 0 1 0-2 0v1h-2V2.996a1 1 0 1 0-2 0V4H9V2.996ZM7.999 12A4.001 4.001 0 1 1 16 12a4.001 4.001 0 0 1-8 0Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgProcessor;
