import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUnlocked = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a5 5 0 0 0-5 5v2a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-7a3 3 0 0 0-3-3H9V7a3 3 0 0 1 5.905-.75 1 1 0 0 0 1.937-.5A5.002 5.002 0 0 0 12 2Zm0 11a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgUnlocked;
