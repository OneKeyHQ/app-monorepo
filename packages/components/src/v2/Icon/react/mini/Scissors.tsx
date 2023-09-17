import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgScissors = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 20 20"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M1.469 3.75a3.5 3.5 0 0 0 5.617 4.11l.883.51c.025.092.147.116.21.043a3.75 3.75 0 0 1 .5-.484c.286-.23.3-.709-.018-.892l-.825-.477A3.501 3.501 0 0 0 1.47 3.75zm2.03 3.482a2 2 0 1 1 2-3.464 2 2 0 0 1-2 3.464zm6.457 1.09a2.75 2.75 0 0 0-1.588 1.822L7.97 11.63l-.884.51a3.501 3.501 0 1 0 .75 1.3l10.68-6.166a.75.75 0 0 0-.182-1.374l-.703-.189a2.75 2.75 0 0 0-1.78.123L9.955 8.322zM2.768 15.5a2 2 0 1 1 3.464-2 2 2 0 0 1-3.464 2z"
      clipRule="evenodd"
    />
    <Path d="M12.52 11.89a.5.5 0 0 0 .056.894l3.274 1.381a2.75 2.75 0 0 0 1.78.123l.704-.188a.75.75 0 0 0 .18-1.374l-3.47-2.004a.5.5 0 0 0-.5 0L12.52 11.89z" />
  </Svg>
);
export default SvgScissors;
