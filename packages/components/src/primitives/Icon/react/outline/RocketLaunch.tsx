import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRocketLaunch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M22 3c0 4.24-2.068 7.41-5 10.182v5.436l-7 3.5v-4.704L6.586 14H1.882l3.5-7h5.436C13.591 4.068 16.76 2 21 2h1zM12 17.462v1.42l3-1.5v-2.47zm7.947-13.41c-3.098.313-5.567 2.014-7.957 4.62l-3.632 4.272 2.697 2.697 4.272-3.632c2.607-2.39 4.307-4.859 4.62-7.957M5.118 12h1.42l2.55-3h-2.47z"
      clipRule="evenodd"
    />
    <Path
      fillRule="evenodd"
      d="M5 16a3 3 0 1 1 0 6H2v-3a3 3 0 0 1 3-3m0 2a1 1 0 0 0-1 1v1h1a1 1 0 1 0 0-2"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRocketLaunch;
