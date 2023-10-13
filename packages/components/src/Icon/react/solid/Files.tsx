import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFiles = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M10 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3 3 3 0 0 0 3-3V9h-4a3 3 0 0 1-3-3V2h-4Zm6 17h-6a3 3 0 0 1-3-3V7a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M16 2.586 20.414 7H17a1 1 0 0 1-1-1V2.586Z" />
  </Svg>
);
export default SvgFiles;
