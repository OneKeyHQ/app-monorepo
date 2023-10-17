import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCode = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm7.707 2.793a1 1 0 0 1 0 1.414L8.914 12l1.793 1.793a1 1 0 0 1-1.414 1.414L7.5 13.414a2 2 0 0 1 0-2.828l1.793-1.793a1 1 0 0 1 1.414 0Zm4 0a1 1 0 1 0-1.414 1.414L15.086 12l-1.793 1.793a1 1 0 0 0 1.414 1.414l1.793-1.793a2 2 0 0 0 0-2.828l-1.793-1.793Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCode;
