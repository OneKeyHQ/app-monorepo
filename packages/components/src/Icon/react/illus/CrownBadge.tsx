import * as React from 'react';
import Svg, {
  SvgProps,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

function SvgCrownBadge(props: SvgProps) {
  return (
    <Svg width={20} height={20} fill="none" {...props}>
      <Circle
        cx={10}
        cy={10}
        r={9.25}
        fill="url(#crown-badge_svg__paint0_linear)"
        stroke="url(#crown-badge_svg__paint1_linear)"
        strokeWidth={1.5}
      />
      <Path
        d="M14.059 14H5.92a.47.47 0 01-.449-.321l-.81-2.48-.61-1.868a1 1 0 01.41-1.155c.387-.255.888-.23 1.247.062l1.535 1.249L9.026 5.6c.17-.372.533-.601.95-.601h.01c.42.004.785.241.95.619l1.688 3.87 1.68-1.32c.36-.282.86-.3 1.242-.045a1 1 0 01.404 1.15l-1.442 4.405a.47.47 0 01-.45.321z"
        fill="#FBE3A2"
      />
      <Path
        d="M5.71 13.602h-.001l-.811-2.481h0l-.61-1.868s0 0 0 0a.75.75 0 01.31-.868.801.801 0 01.953.047s0 0 0 0l1.534 1.249.25.204.135-.294 1.783-3.885h0a.778.778 0 01.723-.456h.01a.781.781 0 01.72.468s0 0 0 0l1.69 3.871.129.297.254-.2 1.68-1.32s0 0 0 0a.807.807 0 01.948-.034.75.75 0 01.305.864L14.27 13.6s0 0 0 0a.22.22 0 01-.211.149H5.92a.22.22 0 01-.21-.148z"
        stroke="url(#crown-badge_svg__paint2_linear)"
        strokeOpacity={0.24}
        strokeWidth={0.5}
      />
      <Defs>
        <LinearGradient
          id="crown-badge_svg__paint0_linear"
          x1={10}
          y1={0}
          x2={10}
          y2={20}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#FBA12C" />
          <Stop offset={1} stopColor="#FCD48B" />
        </LinearGradient>
        <LinearGradient
          id="crown-badge_svg__paint1_linear"
          x1={10}
          y1={0}
          x2={10}
          y2={20}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#FCD48B" />
          <Stop offset={1} stopColor="#FBA12C" />
        </LinearGradient>
        <LinearGradient
          id="crown-badge_svg__paint2_linear"
          x1={10}
          y1={5}
          x2={10}
          y2={15.43}
          gradientUnits="userSpaceOnUse"
        >
          <Stop stopColor="#fff" />
          <Stop offset={1} stopColor="#fff" stopOpacity={0} />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

export default SvgCrownBadge;
