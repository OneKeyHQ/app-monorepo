import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCallCancel = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M20.707 4.707a1 1 0 0 0-1.414-1.414l-8.457 8.457a12 12 0 0 1-1.301-1.872l.748-.749a2 2 0 0 0 .502-1.988L9.97 4.425A2 2 0 0 0 8.055 3H4.999c-1.088 0-2.04.895-1.968 2.062a16.93 16.93 0 0 0 4.261 10.232l-3.999 3.999a1 1 0 1 0 1.414 1.414zM8.71 13.877l.709-.709a14 14 0 0 1-1.654-2.357c-.441-.792-.254-1.737.34-2.331l.765-.765L8.055 5H5.032a14.94 14.94 0 0 0 3.677 8.877Z"
      clipRule="evenodd"
    />
    <Path d="M18.999 18.967a14.9 14.9 0 0 1-7.271-2.451l-1.44 1.44a16.9 16.9 0 0 0 8.649 3.011c1.166.072 2.062-.879 2.062-1.967v-3.056a2 2 0 0 0-1.425-1.916l-2.716-.814a2 2 0 0 0-1.989.501l-.749.75-.216-.126-1.453 1.454q.36.232.737.441c.791.442 1.736.254 2.331-.34l.764-.764 2.716.814z" />
  </Svg>
);
export default SvgCallCancel;
