import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import rough from 'roughjs/bundled/rough.cjs.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root, 'public/diagrams')
const generator = rough.generator()
const palettes = {
  light: {
    background: '#fffdf7',
    ink: '#343a40',
    muted: '#656b72',
    blue: ['#1971c2', '#e7f5ff'],
    green: ['#2b8a3e', '#ebfbee'],
    purple: ['#7048e8', '#f3f0ff'],
    gold: ['#ad7200', '#fff9db'],
    red: ['#c92a2a', '#fff0f0'],
    neutral: ['#868e96', '#f5f4ef'],
  },
  dark: {
    background: '#242424',
    ink: '#ece9e4',
    muted: '#b5b4b0',
    blue: ['#79b9e6', '#1d4866'],
    green: ['#79ca90', '#254a32'],
    purple: ['#bfabec', '#483866'],
    gold: ['#e7b65b', '#594012'],
    red: ['#f2a1a1', '#623738'],
    neutral: ['#989ca2', '#2d2e30'],
  },
}
const escape = (text) =>
  String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

function draw(element, theme) {
  const { x, y, width, height, seed, type } = element
  const tone = theme[element.customData?.tone || 'neutral']
  const options = {
    seed,
    roughness: element.roughness,
    strokeWidth: element.strokeWidth,
    stroke: tone[0],
    fill: element.backgroundColor === 'transparent' ? undefined : tone[1],
    fillStyle: 'solid',
  }
  if (type === 'text') {
    const color = element.customData?.muted ? theme.muted : theme.ink
    const anchor = { left: 'start', center: 'middle', right: 'end' }[
      element.textAlign
    ]
    const textX =
      x +
      (element.textAlign === 'center'
        ? width / 2
        : element.textAlign === 'right'
          ? width
          : 0)
    return element.text
      .split('\n')
      .map(
        (line, i) =>
          `<text x="${textX}" y="${y + element.fontSize * 0.9 + i * element.fontSize * element.lineHeight}" text-anchor="${anchor}" font-size="${element.fontSize}" fill="${color}">${escape(line)}</text>`,
      )
      .join('')
  }
  const paths = []
  switch (type) {
    case 'rectangle': {
      const r = Math.min(14, height / 5, width / 5)
      paths.push(
        generator.path(
          `M${x + r} ${y} H${x + width - r} Q${x + width} ${y} ${x + width} ${y + r} V${y + height - r} Q${x + width} ${y + height} ${x + width - r} ${y + height} H${x + r} Q${x} ${y + height} ${x} ${y + height - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`,
          options,
        ),
      )

      break
    }
    case 'ellipse': {
      paths.push(
        generator.ellipse(
          x + width / 2,
          y + height / 2,
          width,
          height,
          options,
        ),
      )

      break
    }
    case 'arrow':
    case 'line': {
      const points = element.points.map(([px, py]) => [px + x, py + y])
      paths.push(
        generator.linearPath(points, {
          ...options,
          fill: undefined,
          roughness: 0.65,
        }),
      )
      if (element.endArrowhead === 'arrow') {
        const [ax, ay] = points.at(-2),
          [bx, by] = points.at(-1)
        const angle = Math.atan2(by - ay, bx - ax)
        const size = Math.min(10, Math.hypot(bx - ax, by - ay) * 0.35)
        paths.push(
          generator.linearPath(
            [
              [
                bx - size * Math.cos(angle - 0.55),
                by - size * Math.sin(angle - 0.55),
              ],
              [bx, by],
              [
                bx - size * Math.cos(angle + 0.55),
                by - size * Math.sin(angle + 0.55),
              ],
            ],
            { ...options, fill: undefined, roughness: 0.6 },
          ),
        )
      }

      break
    }
    default: {
      throw new Error(`Unsupported diagram element: ${type}`)
    }
  }
  return paths
    .flatMap((shape) => generator.toPaths(shape))
    .map(
      (p) =>
        `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')
}

await mkdir(output, { recursive: true })
const manifest = {}
for (const file of (await readdir(path.join(root, 'diagrams')))
  .filter((file) => file.endsWith('.excalidraw'))
  .sort()) {
  const id = file.replace('.excalidraw', '')
  const scene = JSON.parse(
    await readFile(path.join(root, 'diagrams', file), 'utf8'),
  )
  const font = await readFile(path.join(output, 'fonts', `${id}.woff`))
  const { width, height } = scene.canvas
  const drawing = scene.elements.filter((element) => !element.isDeleted)
  for (const [mode, theme] of Object.entries(palettes)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${escape(scene.title)}</title><style>@font-face{font-family:DiagramWenKai;src:url(data:font/woff;base64,${font.toString('base64')}) format('woff')}text{font-family:DiagramWenKai,'Kaiti SC',KaiTi,serif}</style><rect width="100%" height="100%" fill="${theme.background}"/>${drawing.map((element) => draw(element, theme)).join('')}</svg>\n`
    await writeFile(path.join(output, `${id}.${mode}.svg`), svg)
  }
  await writeFile(path.join(output, file), `${JSON.stringify(scene)}\n`)
  manifest[scene.blogImage] = {
    title: scene.title,
    width,
    height,
    light: `/diagrams/${id}.light.svg`,
    dark: `/diagrams/${id}.dark.svg`,
    source: `/diagrams/${file}`,
  }
}
await writeFile(
  path.join(root, 'src/components/ui/diagram/diagrams.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)
console.info(
  `Rendered ${Object.keys(manifest).length} diagrams in light and dark modes.`,
)
