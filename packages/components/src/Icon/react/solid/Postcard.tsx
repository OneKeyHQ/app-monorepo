import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPostcard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path fill="currentColor" d="M14 11h2v2h-2v-2Z" />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 4a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H5Zm9 5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2Zm-7 .25a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H7Zm0 3.5a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2H7Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPostcard;
