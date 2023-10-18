import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgXBackspace = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M8.972 4a3 3 0 0 0-2.359 1.147l-3.929 5a3 3 0 0 0 0 3.707l3.93 5A3 3 0 0 0 8.971 20H19a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H8.972Zm1.57 5.293a1 1 0 0 1 1.413 0l1.295 1.295 1.294-1.295a1 1 0 1 1 1.415 1.414l-1.295 1.295 1.293 1.293a1 1 0 0 1-1.414 1.414l-1.293-1.293-1.293 1.293a1 1 0 0 1-1.414-1.414l1.293-1.293-1.295-1.295a1 1 0 0 1 0-1.414Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgXBackspace;
