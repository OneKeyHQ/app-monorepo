import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOrange = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M14.297 1.207C15.79.344 17.96.3 19.4.865c0 1.806-1.188 3.564-2.712 4.45a9 9 0 1 1-6.284-1.174C9.868 3.578 9.02 3.095 7.91 2.996l.178-1.992c1.798.16 3.31 1.063 4.178 2.25a5.45 5.45 0 0 1 2.03-2.047Zm2.382 12.62a4.76 4.76 0 0 1-3.852 3.851l.346 1.97a6.755 6.755 0 0 0 5.475-5.475zm.14-11.303a3.1 3.1 0 0 0-1.522.414 3.46 3.46 0 0 0-1.177 1.115 3.46 3.46 0 0 0 1.554-.461c.474-.274.86-.643 1.145-1.068"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOrange;
