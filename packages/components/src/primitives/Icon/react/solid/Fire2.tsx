import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgFire2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12.204 1.68c.683.39 1.333.77 1.975 1.233.69.497 1.611 1.23 2.536 2.174 1.83 1.868 3.785 4.681 3.785 8.208C20.5 18.077 16.72 22 12 22s-8.5-3.923-8.5-8.705c0-2.29 1.109-5.317 3.293-7.502l.707-.708L8.864 6.45zM12 13c-.024.015-2.625 1.567-2.625 4.003C9.375 18.658 10.55 20 12 20s2.625-1.342 2.625-2.997c0-2.436-2.6-3.988-2.625-4.002Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgFire2;
