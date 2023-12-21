import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBrackets = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4 6a3 3 0 0 1 3-3h1a1 1 0 0 1 0 2H7a1 1 0 0 0-1 1v4c0 .768-.289 1.47-.764 2 .475.53.764 1.232.764 2v4a1 1 0 0 0 1 1h1a1 1 0 1 1 0 2H7a3 3 0 0 1-3-3v-4a1 1 0 0 0-1-1 1 1 0 1 1 0-2 1 1 0 0 0 1-1V6Zm11-2a1 1 0 0 1 1-1h1a3 3 0 0 1 3 3v4a1 1 0 0 0 1 1 1 1 0 1 1 0 2 1 1 0 0 0-1 1v4a3 3 0 0 1-3 3h-1a1 1 0 1 1 0-2h1a1 1 0 0 0 1-1v-4c0-.768.289-1.47.764-2A2.989 2.989 0 0 1 18 10V6a1 1 0 0 0-1-1h-1a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBrackets;
