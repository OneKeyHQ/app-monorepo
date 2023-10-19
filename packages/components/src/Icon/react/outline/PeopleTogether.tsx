import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleTogether = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.274 13.147c2.728-.663 5.806.916 6.87 4.739.312 1.117-.63 2.114-1.79 2.114H17M10.5 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm9 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm-8.146 13H3.646c-1.16 0-2.102-1-1.79-2.118 1.816-6.51 9.472-6.51 11.288 0C13.456 19 12.514 20 11.354 20Z"
    />
  </Svg>
);
export default SvgPeopleTogether;
