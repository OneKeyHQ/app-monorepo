import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBomb = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M18 2a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0V2Zm3.707.293a1 1 0 0 0-1.414 0l-1 1a1 1 0 0 0 1.414 1.414l1-1a1 1 0 0 0 0-1.414ZM10 6a8 8 0 1 0 6.32 3.094l1.387-1.387a1 1 0 0 0-1.414-1.414L14.906 7.68A7.965 7.965 0 0 0 10 6Zm11 2h1a1 1 0 1 0 0-2h-1a1 1 0 1 0 0 2Z"
    />
  </Svg>
);
export default SvgBomb;
