import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgShare = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M15.793 3.793a1 1 0 0 1 1.414 0l3.5 3.5a1 1 0 0 1 0 1.414l-3.5 3.5a1 1 0 0 1-1.414-1.414L17.586 9H13a4 4 0 0 0-4 4v1a1 1 0 1 1-2 0v-1a6 6 0 0 1 6-6h4.586l-1.793-1.793a1 1 0 0 1 0-1.414ZM3 7a1 1 0 0 1 1 1v9a1 1 0 0 0 1 1h14a1 1 0 1 1 0 2H5a3 3 0 0 1-3-3V8a1 1 0 0 1 1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgShare;
