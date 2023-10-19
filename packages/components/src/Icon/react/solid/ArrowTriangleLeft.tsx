import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowTriangleLeft = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M15.664 4.319C17.656 3.323 20 4.77 20 6.998v10.004c0 2.227-2.344 3.674-4.336 2.68L5.656 14.678c-2.208-1.104-2.208-4.255 0-5.358l10.008-5.002Z"
    />
  </Svg>
);
export default SvgArrowTriangleLeft;
