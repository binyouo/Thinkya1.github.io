export const paperVertexShader = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

// Curved sheets are lit in 3D, then printed into a low-resolution Bayer grid.
// The canvas is transparent, so its empty cells retain the site's paper colour.
export const paperFragmentShader = `
precision highp float;

uniform vec2 resolution;
uniform vec2 pointer;
uniform float time;
uniform float entrance;
uniform float quiet;
uniform vec3 foreground;
uniform vec4 clearAreas[3];

mat2 rotate(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

float sheetScale() {
  return mix(0.66, 1.0, smoothstep(0.65, 1.0, resolution.x / resolution.y));
}

vec3 sheetPoint(vec3 p, float index) {
  float aspect = resolution.x / resolution.y;
  float spread = mix(0.44, 0.39, smoothstep(0.65, 1.2, aspect));
  float side = index < 0.5 ? -1.0 : 1.0;
  float phase = index * 2.8;
  float vertical = index < 0.5 ? 1.12 : -1.13;
  if (aspect < 0.7) vertical *= 1.7;
  vec3 centre = vec3(side * aspect * 6.0 * spread, vertical, 0.0);
  centre.xy += vec2(sin(time * 0.17 + phase), cos(time * 0.21 + phase)) * 0.17;
  centre.xy += pointer * 0.12;
  p -= centre;
  p /= sheetScale();
  p.xy = rotate(side * 0.38 + sin(time * 0.18 + phase) * 0.15) * p.xy;
  p.yz = rotate(0.36 + sin(time * 0.15 + phase) * 0.22 + pointer.y * 0.2) * p.yz;
  p.xz = rotate(side * 0.38 + cos(time * 0.13 + phase) * 0.27 + pointer.x * 0.3) * p.xz;
  return p;
}

float sheet(vec3 q, float index) {
  float curve = q.x * q.x * 0.29;
  curve += sin(q.y * 2.1 + time * 0.55 + index * 2.8) * 0.11;
  curve += abs(q.x + q.y * 0.17) * 0.24;
  float surface = abs(q.z - curve) * 0.6 - 0.012;
  vec2 bounds = abs(q.xy) - vec2(0.88, 1.10);
  return max(surface, max(bounds.x, bounds.y));
}

vec2 scene(vec3 p) {
  float first = sheet(sheetPoint(p, 0.0), 0.0);
  float second = sheet(sheetPoint(p, 1.0), 1.0);
  return first < second
    ? vec2(first * sheetScale(), 0.0)
    : vec2(second * sheetScale(), 1.0);
}

float threshold(vec2 pixel) {
  vec2 cell = floor(pixel);
  float value = 0.0;
  float scale = 0.25;
  for (int bit = 0; bit < 3; bit++) {
    vec2 pair = mod(cell, 2.0);
    value += (2.0 * pair.x + 3.0 * pair.y - 4.0 * pair.x * pair.y) * scale;
    cell = floor(cell * 0.5);
    scale *= 0.25;
  }
  return value + 0.0078125;
}

void main() {
  vec2 screen = gl_FragCoord.xy / resolution;
  vec2 uv = (gl_FragCoord.xy - resolution * 0.5) / resolution.y;
  vec3 origin = vec3(uv * 6.0, 4.0);
  vec3 direction = vec3(0.0, 0.0, -1.0);
  float travel = 0.0;
  float material = 0.0;
  bool found = false;
  for (int stepIndex = 0; stepIndex < 58; stepIndex++) {
    vec2 samplePoint = scene(origin + direction * travel);
    if (samplePoint.x < 0.003) {
      material = samplePoint.y;
      found = true;
      break;
    }
    travel += samplePoint.x * 0.75;
    if (travel > 8.0) break;
  }

  float breeze = sin(uv.x * 5.0 + sin(uv.y * 4.0 - time * 0.14) * 1.7 + time * 0.18);
  float ribbon = pow(0.5 + 0.5 * breeze, 8.0);
  float edges = smoothstep(0.10, 0.45, abs(screen.x - 0.5));
  float light = (0.012 + ribbon * 0.095) * edges;
  float opacity = 0.34;

  if (found) {
    vec3 hit = origin + direction * travel;
    vec2 offset = vec2(0.004, 0.0);
    vec3 normal = normalize(vec3(
      scene(hit + offset.xyy).x - scene(hit - offset.xyy).x,
      scene(hit + offset.yxy).x - scene(hit - offset.yxy).x,
      scene(hit + offset.yyx).x - scene(hit - offset.yyx).x
    ));
    float diffuse = abs(dot(normal, normalize(vec3(-0.6, 0.8, 1.2))));
    float rim = pow(1.0 - abs(normal.z), 1.6);
    light = 0.18 + diffuse * 0.52 + rim * 0.3;
    // A handful of broken ink lines makes each sheet read as a written page.
    vec3 local = sheetPoint(hit, material);
    float line = 1.0 - smoothstep(0.025, 0.055, abs(fract((local.y + 0.55) * 5.0) - 0.5));
    float lineLength = 0.57 + sin(floor((local.y + 0.55) * 5.0) * 2.4) * 0.095;
    line *= 1.0 - smoothstep(lineLength, lineLength + 0.025, abs(local.x));
    line *= step(-0.55, local.y) * step(local.y, 0.58);
    light *= 1.0 - line * 0.62;
    opacity = mix(0.62, 0.78, smoothstep(0.65, 1.0, resolution.x / resolution.y));
  }

  // Separate masks keep the individual copy blocks clear without flattening
  // the whole centre of the composition into an empty rectangle.
  float keepClear = 1.0;
  for (int area = 0; area < 3; area++) {
    vec4 bounds = clearAreas[area];
    float inX = smoothstep(bounds.x - 0.035, bounds.x, screen.x)
      * (1.0 - smoothstep(bounds.z, bounds.z + 0.035, screen.x));
    float inY = smoothstep(bounds.y - 0.035, bounds.y, screen.y)
      * (1.0 - smoothstep(bounds.w, bounds.w + 0.035, screen.y));
    keepClear *= 1.0 - inX * inY;
  }
  float appear = smoothstep(0.0, 1.0, entrance);
  float on = step(threshold(gl_FragCoord.xy), clamp(light, 0.0, 1.0));
  gl_FragColor = vec4(foreground, on * opacity * keepClear * appear * mix(1.0, 0.36, quiet));
}
`
