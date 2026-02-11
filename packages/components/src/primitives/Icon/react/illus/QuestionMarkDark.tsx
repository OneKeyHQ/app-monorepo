import Svg, { Mask, Path, Circle, G } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgQuestionMarkDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Mask id="path-1-inside-1_970_34298" fill="#fff">
      <Path d="M99.5 32c27.338 0 49.5 22.162 49.5 49.5 0 20.588-12.57 38.238-30.453 45.7A49.26 49.26 0 0 1 93.5 134C66.162 134 44 111.838 44 84.5c0-20.588 12.57-38.24 30.452-45.701A49.27 49.27 0 0 1 99.5 32" />
    </Mask>
    <Path
      fill="#000"
      d="M99.5 32c27.338 0 49.5 22.162 49.5 49.5 0 20.588-12.57 38.238-30.453 45.7A49.26 49.26 0 0 1 93.5 134C66.162 134 44 111.838 44 84.5c0-20.588 12.57-38.24 30.452-45.701A49.27 49.27 0 0 1 99.5 32"
      style={{
        fill: '#000',
        fillOpacity: 1,
      }}
    />
    <Path
      fill="#fff"
      d="m118.547 127.2-.385-.923-.063.027-.059.034zM74.452 38.799l.385.923.063-.026.059-.035zM99.5 32v1c26.786 0 48.5 21.714 48.5 48.5h2C150 53.61 127.39 31 99.5 31zM149 81.5h-1c0 20.17-12.314 37.465-29.838 44.777l.385.923.385.923C137.174 120.511 150 102.506 150 81.5zm-30.453 45.7-.507-.862A48.27 48.27 0 0 1 93.5 133v2a50.27 50.27 0 0 0 25.554-6.938zM93.5 134v-1C66.714 133 45 111.286 45 84.5h-2c0 27.89 22.61 50.5 50.5 50.5zM44 84.5h1c0-20.17 12.314-37.466 29.837-44.778l-.385-.923-.385-.923C55.825 45.488 43 63.495 43 84.5zm30.452-45.701.507.862A48.27 48.27 0 0 1 99.5 33v-2a50.27 50.27 0 0 0-25.555 6.937z"
      mask="url(#path-1-inside-1_970_34298)"
      style={{
        fill: '#fff',
        fillOpacity: 1,
      }}
    />
    <Mask
      id="mask0_970_34298"
      width={97}
      height={97}
      x={50}
      y={33}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: 'alpha',
      }}
    >
      <Circle
        cx={98.5}
        cy={81.5}
        r={48}
        fill="#000"
        stroke="#000"
        style={{
          fill: '#000',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
      />
    </Mask>
    <G fill="#4FE737" stroke="#000" mask="url(#mask0_970_34298)">
      <Path
        d="M-.289.645h37.9v10.13h-37.9z"
        style={{
          fill: '#4fe737',
          fill: 'color(display-p3 .3094 .9059 .2161)',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
        transform="scale(1 -1)rotate(20.877 306.782 281.29)"
      />
      <Path
        d="M-.289.645h27.086V19.56H-.289z"
        style={{
          fill: '#4fe737',
          fill: 'color(display-p3 .3094 .9059 .2161)',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
        transform="scale(1 -1)rotate(20.877 261.79 314.288)"
      />
    </G>
    <Circle
      cx={95.5}
      cy={83.5}
      r={48.5}
      fill="#000"
      style={{
        fill: '#000',
        fillOpacity: 1,
      }}
    />
    <Circle
      cx={93.5}
      cy={84.5}
      r={49}
      fill="#000"
      stroke="#fff"
      style={{
        fill: '#000',
        fillOpacity: 1,
        stroke: '#fff',
        strokeOpacity: 1,
      }}
    />
    <Circle
      cx={93.5}
      cy={84.5}
      r={37}
      fill="#000"
      stroke="#fff"
      style={{
        fill: '#000',
        fillOpacity: 1,
        stroke: '#fff',
        strokeOpacity: 1,
      }}
    />
    <Path
      stroke="#fff"
      d="M85.896 96.569v-4.183a6.736 6.736 0 0 1 6.899-6.734c7.187.174 13.107-5.605 13.107-12.794v-1.323a3.707 3.707 0 0 0-3.707-3.707H91.572a10 10 0 0 0-7.071 2.929l-3.137 3.136M82.742 101.883h6.908"
      style={{
        stroke: '#fff',
        strokeOpacity: 1,
      }}
    />
  </Svg>
);
export default SvgQuestionMarkDark;
