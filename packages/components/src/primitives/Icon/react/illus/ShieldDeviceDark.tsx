import Svg, { Mask, Path, G, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgShieldDeviceDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Mask
      id="mask0_902_27422"
      width={160}
      height={161}
      x={10}
      y={10}
      maskUnits="userSpaceOnUse"
    >
      <Path
        fill="red"
        d="M170 171H10V10h160zm-53-70a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h25a2 2 0 0 0 2-2v-14a2 2 0 0 0-2-2z"
      />
    </Mask>
    <G mask="url(#mask0_902_27422)">
      <Mask
        id="mask1_902_27422"
        width={127}
        height={137}
        x={30}
        y={25}
        maskUnits="userSpaceOnUse"
      >
        <Path
          fill="#D9D9D9"
          d="M157 162H30V25h127zm-44-68a5 5 0 0 0-5 5v49a5 5 0 0 0 5 5h33a5 5 0 0 0 5-5V99a5 5 0 0 0-5-5z"
        />
      </Mask>
      <G mask="url(#mask1_902_27422)">
        <Path
          fill="#fff"
          d="m149 76.911-.004.906v.005c-.189 19.343-5.246 32.263-14.642 42.548a63 63 0 0 1-3.442 3.472q.222-.235.442-.472c9.396-10.285 14.453-23.205 14.642-42.548v-.005l.004-.906V29H38v-3h111z"
        />
        <Mask
          id="path-4-outside-1_902_27422"
          width={111}
          height={122}
          x={35}
          y={29}
          fill="#000"
          maskUnits="userSpaceOnUse"
        >
          <Path fill="#fff" d="M35 29h111v122H35z" />
          <Path d="M90 30v119c-34.02-17.523-53.622-29.894-53.996-68.187L36 79.906V30zm55 49.906-.004.906C144.622 119.107 125.02 131.478 91 149V30h54z" />
        </Mask>
        <Path
          fill="#fff"
          d="M90 30h1v-1h-1zm0 119-.458.889 1.458.751V149zM36.004 80.813l-1 .004v.005zM36 79.906h-1v.005zM36 30v-1h-1v1zm109 49.906 1 .005v-.005zm-.004.906 1 .01v-.005zM91 149h-1v1.64l1.458-.751zm0-119v-1h-1v1zm54 0h1v-1h-1zm-55 0h-1v119h2V30zm0 119 .458-.889c-17.033-8.773-30.275-16.173-39.335-26.09-9.003-9.854-13.934-22.267-14.12-41.218l-1 .01-.999.01c.189 19.342 5.245 32.261 14.642 42.547 9.34 10.222 22.909 17.769 39.896 26.519zM36.004 80.813l1-.005-.004-.906-1 .004-1 .005.004.906zM36 79.906h1V30h-2v49.906zM36 30v1h54v-2H36zm109 49.906-1-.004-.004.906 1 .004 1 .005.004-.906zm-.004.906-1-.01c-.185 18.952-5.116 31.365-14.119 41.219-9.06 9.917-22.302 17.317-39.335 26.09L91 149l.458.889c16.987-8.75 30.556-16.297 39.896-26.519 9.397-10.286 14.453-23.205 14.642-42.548zM91 149h1V30h-2v119zm0-119v1h54v-2H91zm54 0h-1v49.906h2V30z"
          mask="url(#path-4-outside-1_902_27422)"
        />
      </G>
      <Rect width={39} height={55} x={110} y={96} fill="#fff" rx={3} />
    </G>
  </Svg>
);
export default SvgShieldDeviceDark;
