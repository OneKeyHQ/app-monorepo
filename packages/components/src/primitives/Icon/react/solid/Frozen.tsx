import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFrozen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.998 2a1 1 0 0 1 1 1v7.268l6.294-3.634a1 1 0 0 1 1 1.732L13.998 12l6.294 3.634a1 1 0 1 1-1 1.732l-6.294-3.634V21a1 1 0 1 1-2 0v-7.268l-6.295 3.634a1 1 0 1 1-1-1.732L9.998 12 3.704 8.366a1 1 0 0 1 1-1.732l6.294 3.634V3a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFrozen;
