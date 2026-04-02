import Svg, { Path, Circle, Ellipse } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgDocumentGlobeCenterDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path fill="#fff" d="M48 32h88v113H48z" />
    <Path
      fill="#000"
      stroke="#fff"
      strokeLinejoin="round"
      d="M46.5 34.5h87v112h-87z"
    />
    <Path
      fill="#000"
      stroke="#fff"
      strokeLinejoin="round"
      d="M128.5 52.5v90h-78v-90z"
    />
    <Circle
      cx={89.694}
      cy={99.499}
      r={20.499}
      stroke="#fff"
      strokeLinejoin="round"
    />
    <Ellipse
      cx={89.699}
      cy={99.499}
      stroke="#fff"
      strokeLinejoin="round"
      rx={11.941}
      ry={20.499}
    />
    <Path
      stroke="#fff"
      d="M89.5 79v40.998M69 99.5h40.998M72.977 87.756h33.435M72.977 111.241h33.435"
    />
    <Path stroke="#fff" strokeLinejoin="round" d="M50 43h8M62 43h8M121 43h8" />
  </Svg>
);
export default SvgDocumentGlobeCenterDark;
