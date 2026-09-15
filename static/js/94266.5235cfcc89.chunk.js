"use strict";(self.rspackChunkweb=self.rspackChunkweb||[]).push([[94266],{603937(e,t,o){o.r(t);var a=o(831085),n=o(514041),i=o(290719),r=o(733098),s=o(258946);let c=`
uniform vec3 uResolution;
uniform float uTime;
uniform float uHue;
uniform float uRot;
uniform float uIntensity;
uniform float uBreath;

vec3 rgb2yiq(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  float i = dot(c, vec3(0.596, -0.274, -0.322));
  float q = dot(c, vec3(0.211, -0.523, 0.312));
  return vec3(y, i, q);
}

vec3 yiq2rgb(vec3 c) {
  float r = c.x + 0.956 * c.y + 0.621 * c.z;
  float g = c.x - 0.272 * c.y - 0.647 * c.z;
  float b = c.x - 1.106 * c.y + 1.703 * c.z;
  return vec3(r, g, b);
}

vec3 adjustHue(vec3 color, float hueDeg) {
  float hueRad = hueDeg * 3.14159265 / 180.0;
  vec3 yiq = rgb2yiq(color);
  float cosA = cos(hueRad);
  float sinA = sin(hueRad);
  float ii = yiq.y * cosA - yiq.z * sinA;
  float qq = yiq.y * sinA + yiq.z * cosA;
  yiq.y = ii;
  yiq.z = qq;
  return yiq2rgb(yiq);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(
    p3.x + p3.y,
    p3.x + p3.z,
    p3.y + p3.z
  ) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(
    dot(d0, d0),
    dot(d1, d1),
    dot(d2, d2),
    dot(d3, d3)
  ), 0.0);
  vec4 n = h * h * h * h * vec4(
    dot(d0, hash33(i)),
    dot(d1, hash33(i + i1)),
    dot(d2, hash33(i + i2)),
    dot(d3, hash33(i + 1.0))
  );
  return dot(vec4(31.316), n);
}

vec4 extractAlpha(vec3 colorIn) {
  float a = max(max(colorIn.r, colorIn.g), colorIn.b);
  return vec4(colorIn.rgb / (a + 1e-5), a);
}

const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
const float innerRadius = 0.45;
const float noiseScale = 0.5;

float light1(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * attenuation);
}

float light2(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * dist * attenuation);
}

vec4 draw(vec2 uv, float breath) {
  vec3 color1 = adjustHue(baseColor1, uHue);
  vec3 color2 = adjustHue(baseColor2, uHue);
  vec3 color3 = adjustHue(baseColor3, uHue);
  float ang = atan(uv.y, uv.x);
  float len = length(uv);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;
  len /= (1.0 - breath * 0.02);
  float n0 = snoise3(vec3(uv * noiseScale, uTime * 1.0)) * 0.5 + 0.5;
  float iRadius = innerRadius - innerRadius * uIntensity;
  float r0 = mix(mix(iRadius, 1.0, 0.4), mix(iRadius, 1.0, 0.6), n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 1.0, d0);
  v0 *= smoothstep(r0 * 0.4, r0, len);
  float cl = cos(ang + uTime * 1.0) * 0.5 + 0.5;
  float glowingDots = ang * 0.0;
  float a = uTime * 2.0 + glowingDots;
  vec2 pos = vec2(cos(a), sin(a)) * r0 * uIntensity;
  float d = distance(uv, pos);
  float v1 = light2(1.4, 3.0, d);
  v1 *= light1(1.0, 20.0, d0);
  float v2 = smoothstep(1.0, mix(iRadius, 1.0, n0 * 0.3), len);
  float v3 = smoothstep(iRadius, mix(iRadius, 1.0, 0.5), len);
  vec3 col = mix(color1, color2, cl);
  col = mix(color3, col, v0);
  col = (col + v1) * v2 * v3;
  col = clamp(col, 0.0, 1.0);
  return extractAlpha(col);
}

vec4 main(vec2 fragCoord) {
  vec2 center = uResolution.xy * 0.5;
  float size = min(uResolution.x, uResolution.y);
  vec2 uv = (fragCoord - center) / size * 2.0;
  uv.x *= uResolution.x / uResolution.y;
  uv += 0.01 * vec2(
    sin(uTime * 0.6 + uv.y * 0.5),
    cos(uTime * 0.8 + uv.x * 0.5)
  );
  float angle = uRot;
  float s = sin(angle);
  float c = cos(angle);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
  uv.x += uIntensity * 0.07 * sin(uv.y * 8.0 + uTime);
  uv.y += uIntensity * 0.07 * sin(uv.x * 8.0 + uTime);
  vec4 col = draw(uv, uBreath);
  float glowFactor = 1.0 + uIntensity * 0.3;
  col *= glowFactor;
  return vec4(col.rgb * col.a, col.a);
}
`,u={code:"function OrbShaderNativeTsx1(){const{clock,autoRotate,paused,size,hue,hueByIntensity,intensity}=this.__closure;const t=clock.value/1000;const rot=autoRotate&&!paused?t*0.2:0;const breath=(Math.sin(t*0.1)*0.5+0.5)**2;return{uResolution:[size,size,1],uTime:t,uHue:hue+(hueByIntensity?Math.sin(t*0.6)*300*intensity.value:0),uRot:rot,uIntensity:intensity.value*(0.8+breath*0.2),uBreath:breath};}"};function OrbShader({intensity:e,paused:t,autoRotate:o=!0,hueByIntensity:l=!0,hue:v=140,size:d=240}){let h=(0,n.useMemo)(()=>i.Skia.RuntimeEffect.Make(c),[]),f=(0,i.useClock)(),y=(0,r.useDerivedValue)(function({_worklet_16021997119795_init_data:e,clock:t,autoRotate:o,paused:a,size:n,hue:i,hueByIntensity:r,intensity:s}){let OrbShaderNativeTsx1=function(){let e=t.value/1e3,c=o&&!a?.2*e:0,u=(.5*Math.sin(.1*e)+.5)**2;return{uResolution:[n,n,1],uTime:e,uHue:i+(r?300*Math.sin(.6*e)*s.value:0),uRot:c,uIntensity:s.value*(.8+.2*u),uBreath:u}};return OrbShaderNativeTsx1.__closure={clock:t,autoRotate:o,paused:a,size:n,hue:i,hueByIntensity:r,intensity:s},OrbShaderNativeTsx1.__workletHash=0xe9269726933,OrbShaderNativeTsx1.__initData=e,OrbShaderNativeTsx1}({_worklet_16021997119795_init_data:u,clock:f,autoRotate:o,paused:t,size:d,hue:v,hueByIntensity:l,intensity:e}),[d,v,o,l,t]);return h?(0,a.jsx)(i.Canvas,{style:{width:d,height:d},"data-sentry-element":"Canvas","data-sentry-component":"OrbShader","data-sentry-source-file":"/home/runner/work/app-monorepo/app-monorepo/packages/kit/src/views/Onboardingv2/components/OrbShader.native.tsx",children:(0,a.jsx)(i.Fill,{"data-sentry-element":"Fill","data-sentry-source-file":"/home/runner/work/app-monorepo/app-monorepo/packages/kit/src/views/Onboardingv2/components/OrbShader.native.tsx",children:(0,a.jsx)(i.Shader,{source:h,uniforms:y,"data-sentry-element":"Shader","data-sentry-source-file":"/home/runner/work/app-monorepo/app-monorepo/packages/kit/src/views/Onboardingv2/components/OrbShader.native.tsx"})})}):(0,a.jsx)(s.Se,{width:d,height:d,borderRadius:d/2,bg:"$brand10"})}let l=OrbShader;o.d(t,{OrbShader:()=>OrbShader},{default:l})}}]);
//# sourceMappingURL=94266.5235cfcc89.chunk.js.map