import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSpeaker = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M12 12a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M7 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H7Zm1 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm2-8a1 1 0 0 0 0 2h4a1 1 0 1 0 0-2h-4Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgSpeaker;
