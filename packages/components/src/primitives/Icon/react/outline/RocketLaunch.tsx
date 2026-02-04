import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRocketLaunch = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6 19a1 1 0 1 0-2 0v1h1a1 1 0 0 0 1-1m9-4.09-3 2.552v1.771l3-1.8zm4.946-10.858c-3.09.312-5.561 2.008-7.959 4.624l-3.629 4.268 2.697 2.696 4.272-3.632c2.614-2.396 4.308-4.866 4.62-7.956ZM4.766 12h1.772l2.55-3H6.566zM8 19a3 3 0 0 1-3 3H4a2 2 0 0 1-2-2v-1a3 3 0 0 1 6 0m9-1.567a2 2 0 0 1-.97 1.715l-3 1.8c-1.334.8-3.03-.16-3.03-1.715v-1.82L6.586 14h-1.82c-1.554 0-2.515-1.697-1.715-3.03l1.8-3A2 2 0 0 1 6.567 7h4.251c2.525-2.67 5.384-4.631 9.097-4.953a1.88 1.88 0 0 1 2.04 2.039C21.63 7.798 19.668 10.657 17 13.18v4.252Z" />
  </Svg>
);
export default SvgRocketLaunch;
