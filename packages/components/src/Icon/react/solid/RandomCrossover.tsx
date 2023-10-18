import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgRandomCrossover = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M17.293 3.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L18.586 8h-1.758a1 1 0 0 0-.707.293L6.293 18.12a3 3 0 0 1-2.121.88H3a1 1 0 1 1 0-2h1.172a1 1 0 0 0 .707-.293l9.828-9.828A3 3 0 0 1 16.828 6h1.758l-1.293-1.293a1 1 0 0 1 0-1.414ZM2 6a1 1 0 0 1 1-1h1.172a3 3 0 0 1 2.12.879l2.415 2.414a1 1 0 0 1-1.414 1.414L4.879 7.293A1 1 0 0 0 4.172 7H3a1 1 0 0 1-1-1Zm15.293 7.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L18.586 18h-1.758a3 3 0 0 1-2.12-.879l-1.415-1.414a1 1 0 0 1 1.414-1.414l1.414 1.414a1 1 0 0 0 .707.293h1.758l-1.293-1.293a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRandomCrossover;
