import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAiStar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12.5c-6.25 0-9 2.903-9 9.5 0-6.597-2.75-9.5-9-9.5 6.25 0 9-2.903 9-9.5 0 6.597 2.75 9.5 9 9.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAiStar;
