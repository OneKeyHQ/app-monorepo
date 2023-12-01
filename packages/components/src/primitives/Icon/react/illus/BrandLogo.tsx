import Svg, {
  SvgProps,
  G,
  Mask,
  Path,
  Defs,
  LinearGradient,
  Stop,
  RadialGradient,
  ClipPath,
} from 'react-native-svg';
/* SVGR has dropped some elements not supported by react-native-svg: filter */
const SvgBrandLogo = (props: SvgProps) => (
  <Svg viewBox="0 0 27 27" fill="none" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <Mask
        id="b"
        maskUnits="userSpaceOnUse"
        x={0}
        y={0}
        width={27}
        height={27}
      >
        <Path d="M27 0H0v27h27V0Z" fill="#fff" />
      </Mask>
      <G mask="url(#b)">
        <Path
          d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
          fill="#0F0F0F"
        />
        <Path
          d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
          fill="url(#c)"
        />
        <Path
          d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
          fill="url(#d)"
        />
        <Path
          d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
          fill="url(#e)"
        />
        <G opacity={0.2}>
          <Path
            d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
            fill="#1B1B1B"
          />
          <Path
            d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
            fill="url(#f)"
          />
          <Path
            d="M27 13.5C27 22.82 22.82 27 13.5 27S0 22.82 0 13.5 4.18 0 13.5 0 27 4.18 27 13.5Z"
            fill="url(#g)"
          />
        </G>
        <Mask
          id="h"
          maskUnits="userSpaceOnUse"
          x={-1}
          y={-1}
          width={28}
          height={28}
        >
          <Path d="M26.5-.5h-27v27h27v-27Z" fill="#fff" />
        </Mask>
        <G mask="url(#h)">
          <G filter="url(#i)">
            <Path
              d="M14.231 5.248h-3.755l-.66 1.992.147.317h1.94v3.88l.11.158h2.11l.108-.158V5.248Z"
              fill="url(#j)"
            />
            <Path
              d="M14.231 5.248h-3.755l-.66 1.992.147.317h1.94v3.88l.11.158h2.11l.108-.158V5.248Z"
              fill="url(#k)"
              fillOpacity={0.6}
            />
            <Path
              d="M14.231 5.248h-3.755l-.66 1.992.147.317h1.94v3.88l.11.158h2.11l.108-.158V5.248Z"
              fill="url(#l)"
              fillOpacity={0.4}
            />
          </G>
          <G filter="url(#m)" fillRule="evenodd" clipRule="evenodd">
            <Path
              d="M16.767 16.147c0 2.365-1.39 4.283-3.755 4.283-2.366 0-3.756-1.918-3.756-4.283 0-2.366 1.39-3.228 3.756-3.228 2.365 0 3.755.862 3.755 3.228Zm-1.417 0a2.339 2.339 0 1 1-4.677 0 2.339 2.339 0 0 1 4.677 0Z"
              fill="url(#n)"
            />
            <Path
              d="M16.767 16.147c0 2.365-1.39 4.283-3.755 4.283-2.366 0-3.756-1.918-3.756-4.283 0-2.366 1.39-3.228 3.756-3.228 2.365 0 3.755.862 3.755 3.228Zm-1.417 0a2.339 2.339 0 1 1-4.677 0 2.339 2.339 0 0 1 4.677 0Z"
              fill="url(#o)"
            />
            <Path
              d="M16.767 16.147c0 2.365-1.39 4.283-3.755 4.283-2.366 0-3.756-1.918-3.756-4.283 0-2.366 1.39-3.228 3.756-3.228 2.365 0 3.755.862 3.755 3.228Zm-1.417 0a2.339 2.339 0 1 1-4.677 0 2.339 2.339 0 0 1 4.677 0Z"
              fill="url(#p)"
            />
          </G>
          <G filter="url(#q)">
            <G filter="url(#r)">
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10.687 5.564h3.755v6.19l-2.55-.125.222-4.072H9.963l-.153-.331.877-1.662Zm2.536 15.551a4.283 4.283 0 1 0 0-8.566 4.283 4.283 0 0 0 0 8.566Zm0-1.944a2.339 2.339 0 0 0 0-4.677c-1.292 0-2.807.985-2.807 2.276 0 1.292 1.515 2.401 2.807 2.401Z"
                fill="#000"
              />
            </G>
            <G filter="url(#s)">
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10.476 5.248h3.755v6.189h-2.328V7.24H9.817l.659-1.992ZM13.012 20.8a4.283 4.283 0 1 0 0-8.566 4.283 4.283 0 0 0 0 8.566Zm0-1.944a2.339 2.339 0 1 0 0-4.678 2.339 2.339 0 0 0 0 4.678Z"
                fill="url(#t)"
              />
            </G>
            <Mask
              id="u"
              maskUnits="userSpaceOnUse"
              x={8}
              y={5}
              width={10}
              height={16}
            >
              <Path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M10.476 5.248h3.755v6.189h-2.328V7.24H9.817l.659-1.992ZM13.012 20.8a4.283 4.283 0 1 0 0-8.566 4.283 4.283 0 0 0 0 8.566Zm0-1.944a2.339 2.339 0 1 0 0-4.678 2.339 2.339 0 0 0 0 4.678Z"
                fill="#fff"
              />
            </Mask>
            <G mask="url(#u)">
              <Path
                d="M14.231 5.248h.08v-.08h-.08v.08Zm-3.755 0v-.08h-.058l-.017.055.075.025Zm3.755 6.189v.08h.08v-.08h-.08Zm-2.328 0h-.08v.08h.08v-.08Zm0-4.197h.079v-.079h-.08v.08Zm-2.086 0-.075-.024-.035.103h.11V7.24ZM14.23 5.17h-3.755v.158h3.755V5.17Zm.08 6.268V5.248h-.159v6.189h.158Zm-2.408.08h2.328v-.16h-2.328v.16Zm-.08-4.277v4.197h.159V7.24h-.158Zm-2.006.08h2.086V7.16H9.817v.158Zm.584-2.097-.66 1.993.15.05.66-1.993-.15-.05Zm6.815 11.293a4.204 4.204 0 0 1-4.204 4.204v.158a4.362 4.362 0 0 0 4.362-4.362h-.158Zm-4.204-4.204a4.204 4.204 0 0 1 4.204 4.204h.158a4.362 4.362 0 0 0-4.362-4.362v.158Zm-4.204 4.204a4.204 4.204 0 0 1 4.204-4.204v-.158a4.362 4.362 0 0 0-4.363 4.362h.159Zm4.204 4.204a4.204 4.204 0 0 1-4.204-4.204h-.159a4.362 4.362 0 0 0 4.363 4.362v-.158Zm2.26-4.204a2.26 2.26 0 0 1-2.26 2.26v.158a2.418 2.418 0 0 0 2.417-2.418h-.158Zm-2.26-2.26a2.26 2.26 0 0 1 2.26 2.26h.157a2.418 2.418 0 0 0-2.417-2.418v.158Zm-2.26 2.26a2.26 2.26 0 0 1 2.26-2.26v-.158a2.418 2.418 0 0 0-2.418 2.418h.158Zm2.26 2.26a2.26 2.26 0 0 1-2.26-2.26h-.158a2.418 2.418 0 0 0 2.418 2.418v-.159Z"
                fill="url(#v)"
              />
            </G>
          </G>
        </G>
      </G>
    </G>
    <Defs>
      <LinearGradient
        id="e"
        x1={-0.317}
        y1={0}
        x2={5.34}
        y2={23.31}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#fff" stopOpacity={0.26} />
        <Stop offset={0.471} stopColor="#fff" stopOpacity={0.078} />
        <Stop offset={1} stopColor="#fff" stopOpacity={0} />
      </LinearGradient>
      <LinearGradient
        id="j"
        x1={12.075}
        y1={6.584}
        x2={11.94}
        y2={11.593}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#F2F6F7" />
        <Stop offset={0.473} stopColor="#DADADA" />
        <Stop offset={1} stopColor="#BCBCBC" />
      </LinearGradient>
      <LinearGradient
        id="k"
        x1={12.018}
        y1={7.078}
        x2={11.916}
        y2={11.593}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopOpacity={0} />
        <Stop offset={1} />
      </LinearGradient>
      <LinearGradient
        id="l"
        x1={12.075}
        y1={9.34}
        x2={11.94}
        y2={11.59}
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset={0.33} stopOpacity={0} />
        <Stop offset={1} />
      </LinearGradient>
      <LinearGradient
        id="n"
        x1={13.099}
        y1={14.5}
        x2={12.987}
        y2={20.43}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#F2F6F7" />
        <Stop offset={0.473} stopColor="#DADADA" />
        <Stop offset={1} stopColor="#BCBCBC" />
      </LinearGradient>
      <LinearGradient
        id="o"
        x1={13.001}
        y1={15.084}
        x2={12.918}
        y2={20.428}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopOpacity={0} />
        <Stop offset={1} />
      </LinearGradient>
      <LinearGradient
        id="p"
        x1={13}
        y1={18.458}
        x2={12.992}
        y2={19.328}
        gradientUnits="userSpaceOnUse"
      >
        <Stop offset={0.33} stopOpacity={0} />
        <Stop offset={1} />
      </LinearGradient>
      <LinearGradient
        id="t"
        x1={9.994}
        y1={4.668}
        x2={16.692}
        y2={21.042}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#fff" />
        <Stop offset={1} stopColor="#565656" />
      </LinearGradient>
      <LinearGradient
        id="v"
        x1={10.909}
        y1={4.018}
        x2={21.974}
        y2={14.922}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#fff" />
        <Stop offset={1} stopColor="#fff" stopOpacity={0.06} />
      </LinearGradient>
      <RadialGradient
        id="c"
        cx={0}
        cy={0}
        r={1}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(0 11.0238 -14.3348 0 13.5 16.933)"
      >
        <Stop stopOpacity={0.35} />
        <Stop offset={1} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient
        id="d"
        cx={0}
        cy={0}
        r={1}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(0 27 -27 0 13.5 0)"
      >
        <Stop stopColor="#fff" stopOpacity={0.05} />
        <Stop offset={1} stopColor="#fff" stopOpacity={0} />
      </RadialGradient>
      <RadialGradient
        id="f"
        cx={0}
        cy={0}
        r={1}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(0 11.0238 -14.3348 0 13.5 16.933)"
      >
        <Stop stopOpacity={0.35} />
        <Stop offset={1} stopOpacity={0} />
      </RadialGradient>
      <RadialGradient
        id="g"
        cx={0}
        cy={0}
        r={1}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(0 27 -27 0 13.5 0)"
      >
        <Stop stopColor="#fff" stopOpacity={0.05} />
        <Stop offset={1} stopColor="#fff" stopOpacity={0} />
      </RadialGradient>
      <ClipPath id="a">
        <Path fill="#fff" d="M0 0h27v27H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgBrandLogo;
