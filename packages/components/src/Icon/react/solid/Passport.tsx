import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPassport = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M10.5 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.5 2.5a3 3 0 0 0-3 3v13a3 3 0 0 0 3 3h11a3 3 0 0 0 3-3v-13a3 3 0 0 0-3-3h-11Zm2 13.5a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1ZM12 7a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPassport;
