import Svg, { ClipPath, Defs, G, Rect } from 'react-native-svg';

import { useThemeValue } from '@onekeyhq/components';

export default function SvgAllNetwrorksLoadingLight() {
  const [c1, c2, c3, c4, c5, c6] = useThemeValue([
    'surface-default',
    'decorative-icon-three',
    'surface-neutral-default',
    'divider',
    'decorative-icon-two',
    'decorative-icon-one',
  ]);
  return (
    <Svg width="260" height="135" viewBox="0 0 260 135" fill="none">
      <G opacity="0.1">
        <Rect
          x="30.4615"
          y="0.461538"
          width="199.077"
          height="60"
          rx="10.6154"
          fill={c1}
        />
        <G clipPath="url(#clip0_24966_155338)">
          <Rect
            x="41.0767"
            y="15.6895"
            width="29.5385"
            height="29.5385"
            rx="14.7692"
            fill={c2}
          />
        </G>
        <G clipPath="url(#clip1_24966_155338)">
          <Rect
            x="81.6924"
            y="16.7617"
            width="69.2308"
            height="11.0769"
            rx="1.84615"
            fill={c3}
          />
        </G>
        <G clipPath="url(#clip2_24966_155338)">
          <Rect
            x="81.6924"
            y="37.9902"
            width="108"
            height="9.23077"
            rx="1.84615"
            fill={c3}
          />
        </G>
        <Rect
          x="30.4615"
          y="0.461538"
          width="199.077"
          height="60"
          rx="10.6154"
          stroke={c4}
          strokeWidth="0.923077"
        />
      </G>
      <G opacity="0.7">
        <Rect
          x="20.4231"
          y="30.4231"
          width="219.154"
          height="55"
          rx="9.73077"
          fill={c1}
        />
        <G clipPath="url(#clip3_24966_155338)">
          <Rect
            x="30.1533"
            y="44.3867"
            width="27.0769"
            height="27.0769"
            rx="13.5385"
            fill={c5}
          />
        </G>
        <G clipPath="url(#clip4_24966_155338)">
          <Rect
            x="67.3843"
            y="45.3604"
            width="63.4615"
            height="10.1538"
            rx="1.69231"
            fill={c3}
          />
        </G>
        <G clipPath="url(#clip5_24966_155338)">
          <Rect
            x="67.3843"
            y="64.8242"
            width="99"
            height="8.46154"
            rx="1.69231"
            fill={c3}
          />
        </G>
        <Rect
          x="20.4231"
          y="30.4231"
          width="219.154"
          height="55"
          rx="9.73077"
          stroke={c4}
          strokeWidth="0.846154"
        />
      </G>
      <Rect x="0.5" y="69.5" width="259" height="65" rx="11.5" fill={c1} />
      <G clipPath="url(#clip6_24966_155338)">
        <Rect x="12" y="86" width="32" height="32" rx="16" fill={c6} />
      </G>
      <G clipPath="url(#clip7_24966_155338)">
        <Rect x="56" y="87.1543" width="75" height="12" rx="2" fill={c3} />
      </G>
      <G clipPath="url(#clip8_24966_155338)">
        <Rect x="56" y="110.154" width="117" height="10" rx="2" fill={c3} />
      </G>
      <Rect x="0.5" y="69.5" width="259" height="65" rx="11.5" stroke={c4} />
      <Defs>
        <ClipPath id="clip0_24966_155338">
          <Rect
            x="41.0767"
            y="15.6895"
            width="29.5385"
            height="29.5385"
            rx="14.7692"
            fill="white"
          />
        </ClipPath>
        <ClipPath id="clip1_24966_155338">
          <Rect
            x="81.6924"
            y="16.7617"
            width="69.2308"
            height="11.0769"
            rx="1.84615"
            fill="white"
          />
        </ClipPath>
        <ClipPath id="clip2_24966_155338">
          <Rect
            x="81.6924"
            y="37.9902"
            width="108"
            height="9.23077"
            rx="1.84615"
            fill="white"
          />
        </ClipPath>
        <ClipPath id="clip3_24966_155338">
          <Rect
            x="30.1533"
            y="44.3867"
            width="27.0769"
            height="27.0769"
            rx="13.5385"
            fill="white"
          />
        </ClipPath>
        <ClipPath id="clip4_24966_155338">
          <Rect
            x="67.3843"
            y="45.3604"
            width="63.4615"
            height="10.1538"
            rx="1.69231"
            fill="white"
          />
        </ClipPath>
        <ClipPath id="clip5_24966_155338">
          <Rect
            x="67.3843"
            y="64.8242"
            width="99"
            height="8.46154"
            rx="1.69231"
            fill="white"
          />
        </ClipPath>
        <ClipPath id="clip6_24966_155338">
          <Rect x="12" y="86" width="32" height="32" rx="16" fill="white" />
        </ClipPath>
        <ClipPath id="clip7_24966_155338">
          <Rect x="56" y="87.1543" width="75" height="12" rx="2" fill="white" />
        </ClipPath>
        <ClipPath id="clip8_24966_155338">
          <Rect
            x="56"
            y="110.154"
            width="117"
            height="10"
            rx="2"
            fill="white"
          />
        </ClipPath>
      </Defs>
    </Svg>
  );
}
