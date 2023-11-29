import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAi2Star = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M22 15c-4.861 0-7 2.139-7 7 0-4.861-2.139-7-7-7 4.861 0 7-2.139 7-7 0 4.861 2.139 7 7 7ZM11 6.5c-3.125 0-4.5 1.375-4.5 4.5 0-3.125-1.375-4.5-4.5-4.5 3.125 0 4.5-1.375 4.5-4.5 0 3.125 1.375 4.5 4.5 4.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAi2Star;
