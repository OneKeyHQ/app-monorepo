import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPeopleTogether = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9 12.5c4.43 0 8.262 2.88 8.907 6.844.205 1.263-.854 2.156-1.906 2.156H2c-1.052 0-2.112-.893-1.906-2.156l.069-.37C.98 15.203 4.71 12.5 9 12.5m0 2c-3.562 0-6.36 2.25-6.9 5h13.802c-.541-2.75-3.338-5-6.901-5Z"
      clipRule="evenodd"
    />
    <Path d="M17.056 13.675a1 1 0 0 1 1.277-.609c2.88 1.02 5.097 3.36 5.572 6.278.206 1.263-.854 2.156-1.906 2.156h-1.5a1 1 0 1 1 0-2H21.9c-.396-2.014-1.989-3.753-4.236-4.549a1 1 0 0 1-.608-1.276" />
    <Path
      fillRule="evenodd"
      d="M8.999 2.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9m0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5"
      clipRule="evenodd"
    />
    <Path d="M14.999 2.5a4.5 4.5 0 1 1 0 9 1 1 0 1 1 0-2 2.5 2.5 0 0 0 0-5 1 1 0 1 1 0-2" />
  </Svg>
);
export default SvgPeopleTogether;
