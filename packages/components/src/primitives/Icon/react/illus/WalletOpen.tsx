import Svg, { Rect, Mask, Path, G } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWalletOpen = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Rect
      width={98}
      height={101}
      x={44}
      y={35}
      fill="#fff"
      stroke="#000"
      rx={5}
      style={{
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Mask
      id="mask0_933_30208"
      width={98}
      height={101}
      x={44}
      y={35}
      maskUnits="userSpaceOnUse"
      style={{
        maskType: 'alpha',
      }}
    >
      <Path
        fill="#fff"
        d="M137 35a5 5 0 0 1 5 5v91a5 5 0 0 1-5 5H84V57.424a5 5 0 0 0-2.549-4.358l-30-16.875c-3.333-1.874-7.45.534-7.451 4.358V40a5 5 0 0 1 5-5zm-93 95.151c0 .974.142 1.928.411 2.836A5 5 0 0 1 44 131z"
        style={{
          fill: '#fff',
          fillOpacity: 1,
        }}
      />
    </Mask>
    <G mask="url(#mask0_933_30208)">
      <Path
        fill="#000"
        d="M44 44h89v85H44z"
        style={{
          fill: '#000',
          fillOpacity: 1,
        }}
      />
      <Path
        fill="#A8A8A8"
        stroke="#000"
        d="M56 49h71v11H56z"
        style={{
          fill: '#a8a8a8',
          fill: 'color(display-p3 .6605 .6605 .6605)',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
      />
      <Path
        fill="#DDD"
        stroke="#000"
        d="M56 60h71v11H56z"
        style={{
          fill: '#ddd',
          fill: 'color(display-p3 .8676 .8676 .8676)',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
      />
      <Path
        fill="#fff"
        stroke="#000"
        d="M56 71h71v51H56z"
        style={{
          fill: '#fff',
          fillOpacity: 1,
          stroke: '#000',
          strokeOpacity: 1,
        }}
      />
    </G>
    <Path
      fill="#fff"
      stroke="#000"
      d="M44 39.352c0-3.289 3.542-5.36 6.408-3.748l31.043 17.462A5 5 0 0 1 84 57.424v92.527c0 3.824-4.118 6.232-7.451 4.357l-27.452-15.441A10 10 0 0 1 44 130.151z"
      style={{
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      fill="#C6D5E0"
      d="M75.5 96.924c0-2.247 2.38-3.696 4.376-2.666l8.417 4.345A5 5 0 0 1 91 103.046v16.03c0 2.247-2.38 3.696-4.376 2.665l-8.417-4.344a5 5 0 0 1-2.707-4.443z"
      style={{
        fill: '#c6d5e0',
        fill: 'color(display-p3 .7765 .8353 .8784)',
        fillOpacity: 1,
      }}
    />
    <Path
      fill="#fff"
      d="M75.5 96.924c0-2.247 2.38-3.696 4.376-2.666l8.417 4.345A5 5 0 0 1 91 103.046v16.03c0 2.247-2.38 3.696-4.376 2.665l-8.417-4.344a5 5 0 0 1-2.707-4.443z"
      style={{
        fill: '#fff',
        fillOpacity: 1,
      }}
    />
    <Path
      stroke="#000"
      d="M75.5 96.924c0-2.247 2.38-3.696 4.376-2.666l8.417 4.345A5 5 0 0 1 91 103.046v16.03c0 2.247-2.38 3.696-4.376 2.665l-8.417-4.344a5 5 0 0 1-2.707-4.443z"
      style={{
        stroke: '#000',
        strokeOpacity: 1,
      }}
    />
    <Path
      fill="#fff"
      d="M48.199 35.5h23v2h-23z"
      style={{
        fill: '#fff',
        fillOpacity: 1,
      }}
    />
  </Svg>
);
export default SvgWalletOpen;
