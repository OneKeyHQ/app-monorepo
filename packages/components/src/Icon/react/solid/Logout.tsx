import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLogout = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h5.25a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h5.25a1 1 0 1 1 0 2H6Zm8.793 1.793a1 1 0 0 1 1.414 0l4.5 4.5a1 1 0 0 1 0 1.414l-4.5 4.5a1 1 0 0 1-1.414-1.414L17.586 13H8.75a1 1 0 1 1 0-2h8.836l-2.793-2.793a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgLogout;
