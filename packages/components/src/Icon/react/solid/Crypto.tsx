import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCrypto = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m9.25 10.124 2.5-1.444a.5.5 0 0 1 .5 0l2.5 1.444a.5.5 0 0 1 .25.433v2.886a.5.5 0 0 1-.25.433l-2.5 1.444a.5.5 0 0 1-.5 0l-2.5-1.444a.5.5 0 0 1-.25-.433v-2.886a.5.5 0 0 1 .25-.433Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm13.75-3.608-2.5-1.444a2.5 2.5 0 0 0-2.5 0l-2.5 1.444A2.5 2.5 0 0 0 7 10.557v2.886a2.5 2.5 0 0 0 1.25 2.165l2.5 1.444a2.5 2.5 0 0 0 2.5 0l2.5-1.444A2.5 2.5 0 0 0 17 13.443v-2.886a2.5 2.5 0 0 0-1.25-2.165Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCrypto;
