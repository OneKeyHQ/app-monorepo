import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgStore = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M4.6 4.2A3 3 0 0 1 7 3h10a3 3 0 0 1 2.4 1.2l2.4 3.2a1 1 0 0 1 .2.6v1a3.988 3.988 0 0 1-1 2.646V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6.354A3.988 3.988 0 0 1 2 9V8a1 1 0 0 1 .2-.6l2.4-3.2Zm.4 8.674V18a1 1 0 0 0 1 1h3v-2a3 3 0 1 1 6 0v2h3a1 1 0 0 0 1-1v-5.126a4.008 4.008 0 0 1-4-1.228A3.99 3.99 0 0 1 12 13a3.99 3.99 0 0 1-3-1.354 3.99 3.99 0 0 1-4 1.228Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgStore;
