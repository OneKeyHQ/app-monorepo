import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPound = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m.5 4A3.5 3.5 0 0 0 9 9.5c0 .577.13 1.079.292 1.5H8v2h1.697l-1.714 4H15v-2h-3.983l.857-2H15v-2h-3.494l-.027-.05-.09-.173C11.156 10.327 11 9.942 11 9.5a1.5 1.5 0 0 1 2.548-1.073l.716.699 1.397-1.43-.716-.7A3.5 3.5 0 0 0 12.5 6"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPound;
