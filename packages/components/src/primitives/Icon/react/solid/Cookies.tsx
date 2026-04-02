import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCookies = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2q.578 0 1.14.064l1.006.115-.127 1.004a2.5 2.5 0 0 0 2.145 2.795l.757.101.102.757a2.5 2.5 0 0 0 3.351 2.007l1.045-.39.274 1.081c.2.79.307 1.616.307 2.466 0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M7 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2m10 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-4.5-3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m-4-3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgCookies;
