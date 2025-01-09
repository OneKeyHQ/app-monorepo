import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgYen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm7.253-4.659a1 1 0 1 0-1.506 1.317L10.671 12H10a1 1 0 1 0 0 2h1v3a1 1 0 1 0 2 0v-3h1a1 1 0 1 0 0-2h-.671l2.924-3.341a1 1 0 0 0-1.506-1.318L12 10.482l-2.747-3.14Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgYen;
