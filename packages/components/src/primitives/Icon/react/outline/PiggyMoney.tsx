import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPiggyMoney = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M8.25 9.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m.328-3.055.002.003-.003-.007z" />
    <Path
      fillRule="evenodd"
      d="M21 12c0 .68-.1 1.337-.282 1.958a1 1 0 0 0 1.148-1.457l-.5-.866 1.73-1.001.5.865a3 3 0 0 1-3.715 4.284A7 7 0 0 1 19 16.886V21h-6v-2h-2v2H5v-3.453A5.8 5.8 0 0 1 3.452 16H1V8.935h2.326c.286-.648.655-1.291 1.174-1.851V3h1c1.743 0 2.955.588 3.74 1.223.338.272.588.549.766.777H14a7 7 0 0 1 7 7m-2 0a5 5 0 0 0-5-5H8.849l-.268-.55a2 2 0 0 0-.111-.169 2.8 2.8 0 0 0-.487-.504 3.4 3.4 0 0 0-1.483-.68v2.847l-.33.298c-.543.49-.916 1.176-1.23 2.036l-.24.657H3V14h1.577l.288.499c.437.755.88 1.196 1.638 1.637l.497.289V19h2v-2h6v2h2v-2.983l.332-.298A4.98 4.98 0 0 0 19 12"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPiggyMoney;
