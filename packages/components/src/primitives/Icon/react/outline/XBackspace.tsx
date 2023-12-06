import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgXBackspace = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m11.248 10 4.002 4.002M15.252 10l-4.002 4.002m-7.78-3.238 3.93-5A2 2 0 0 1 8.971 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8.972a2 2 0 0 1-1.573-.764l-3.928-5a2 2 0 0 1 0-2.472Z"
    />
  </Svg>
);
export default SvgXBackspace;
