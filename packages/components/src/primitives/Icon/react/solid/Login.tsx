import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLogin = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M18 5h-3a1 1 0 1 1 0-2h3a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-3a1 1 0 1 1 0-2h3a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Zm-7.707 2.793a1 1 0 0 1 1.414 0l3.5 3.5a1 1 0 0 1 0 1.414l-3.5 3.5a1 1 0 0 1-1.414-1.414L12.086 13H4a1 1 0 1 1 0-2h8.086l-1.793-1.793a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLogin;
