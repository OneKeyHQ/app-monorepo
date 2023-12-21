import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBusiness = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm2 0a1 1 0 0 1 1-1h1v2a1 1 0 0 1-2 0V6Zm5 2a1 1 0 0 1-1-1V5h2v2a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1V5h2v2a1 1 0 0 1-1 1Zm4 0a1 1 0 0 1-1-1V5h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1Zm-8 8a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h2v-3a3 3 0 0 0-3-3h-2a3 3 0 0 0-3 3v3h2v-3Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBusiness;
