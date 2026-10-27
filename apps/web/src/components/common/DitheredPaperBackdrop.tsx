'use client'

import { useEffect, useRef, useState } from 'react'

import { paperFragmentShader, paperVertexShader } from './paper-backdrop-shader'

function createScene(gl: WebGLRenderingContext) {
  const shaders: WebGLShader[] = []
  for (const [type, source] of [
    [gl.VERTEX_SHADER, paperVertexShader],
    [gl.FRAGMENT_SHADER, paperFragmentShader],
  ] as const) {
    const shader = gl.createShader(type)
    if (!shader) {
      shaders.forEach((item) => gl.deleteShader(item))
      return null
    }
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    shaders.push(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      shaders.forEach((item) => gl.deleteShader(item))
      return null
    }
  }
  const program = gl.createProgram()
  if (!program) {
    shaders.forEach((shader) => gl.deleteShader(shader))
    return null
  }
  shaders.forEach((shader) => gl.attachShader(program, shader))
  gl.linkProgram(program)
  shaders.forEach((shader) => gl.deleteShader(shader))
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }
  return program
}

export const DitheredPaperBackdrop = ({ quiet }: { quiet: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const panel = canvas?.parentElement
    if (!canvas || !panel) return

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: true,
      premultipliedAlpha: false,
      depth: false,
      powerPreference: 'low-power',
    })
    if (!gl) return
    const program = createScene(gl)
    if (!program) return

    const buffer = gl.createBuffer()
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    )
    const position = gl.getAttribLocation(program, 'position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const uniforms = {
      resolution: gl.getUniformLocation(program, 'resolution'),
      pointer: gl.getUniformLocation(program, 'pointer'),
      time: gl.getUniformLocation(program, 'time'),
      entrance: gl.getUniformLocation(program, 'entrance'),
      clearAreas: gl.getUniformLocation(program, 'clearAreas[0]'),
    }
    gl.uniform1f(gl.getUniformLocation(program, 'quiet'), quiet ? 1 : 0)

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cursor = { x: 0, y: 0, targetX: 0, targetY: 0 }
    let frame = 0
    let visible = false
    let elapsed = 0
    let lastFrame = 0
    let lastTick = 0
    let lost = false
    let layoutDirty = true

    const updateClearArea = () => {
      const hero = document.querySelector('.paper-hero')
      const heroRect = hero?.getBoundingClientRect()
      if (
        !hero ||
        !heroRect ||
        heroRect.bottom < 0 ||
        heroRect.top > innerHeight
      ) {
        gl.uniform4fv(
          uniforms.clearAreas,
          new Float32Array([0.18, 0, 0.82, 1, -2, -2, -1, -1, -2, -2, -1, -1]),
        )
        return
      }
      const groups = [
        '.paper-hero-avatar, .paper-hero > h1',
        '.paper-hero-heading, .paper-hero-description',
        '.paper-hero-footnote',
      ]
      const areas = groups.flatMap((selector) => {
        const bounds = [...hero.querySelectorAll(selector)].map((element) =>
          element.getBoundingClientRect(),
        )
        if (bounds.length === 0) return [-2, -2, -1, -1]
        const left = Math.min(...bounds.map((rect) => rect.left)) - 12
        const right = Math.max(...bounds.map((rect) => rect.right)) + 12
        const top = Math.min(...bounds.map((rect) => rect.top)) - 12
        const bottom = Math.max(...bounds.map((rect) => rect.bottom)) + 12
        return [
          left / innerWidth,
          1 - bottom / innerHeight,
          right / innerWidth,
          1 - top / innerHeight,
        ]
      })
      gl.uniform4fv(uniforms.clearAreas, new Float32Array(areas))
    }

    const render = () => {
      if (lost) return
      if (layoutDirty) {
        updateClearArea()
        layoutDirty = false
      }
      cursor.x += (cursor.targetX - cursor.x) * 0.065
      cursor.y += (cursor.targetY - cursor.y) * 0.065
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height)
      gl.uniform2f(uniforms.pointer, cursor.x, cursor.y)
      gl.uniform1f(uniforms.time, 4.5 + elapsed)
      gl.uniform1f(
        uniforms.entrance,
        motion.matches ? 1 : Math.min(1, elapsed / 1.8),
      )
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (now - lastFrame < 1000 / 30) return
      elapsed += Math.min((now - lastTick) / 1000, 0.1)
      lastTick = now
      lastFrame = now
      render()
    }
    const updatePlayback = () => {
      cancelAnimationFrame(frame)
      frame = 0
      if (lost) return
      if (motion.matches) {
        render()
      } else if (visible && !document.hidden) {
        lastTick = performance.now()
        lastFrame = 0
        frame = requestAnimationFrame(tick)
      }
    }
    const resize = () => {
      const { width, height } = panel.getBoundingClientRect()
      // Fixed CSS-pixel grid, independent of display density; no full-DPR GPU work.
      const cellSize = Math.max(3, Math.max(width, height) / 480)
      canvas.width = Math.max(1, Math.floor(width / cellSize))
      canvas.height = Math.max(1, Math.floor(height / cellSize))
      gl.viewport(0, 0, canvas.width, canvas.height)
      layoutDirty = true
      render()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (motion.matches || event.pointerType === 'touch') return
      cursor.targetX = event.clientX / innerWidth - 0.5
      cursor.targetY = 0.5 - event.clientY / innerHeight
    }
    const onPointerLeave = () => {
      cursor.targetX = 0
      cursor.targetY = 0
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      lost = true
      cancelAnimationFrame(frame)
    }
    const onContextRestored = () => {
      setGeneration((value) => value + 1)
    }
    const onLayoutChange = () => {
      layoutDirty = true
      if (motion.matches) render()
    }
    const updateColor = () => {
      const rgb = getComputedStyle(panel)
        .color.match(/[\d.]+/g)
        ?.map(Number)
      if (!rgb || rgb.length < 3) return
      gl.uniform3f(
        gl.getUniformLocation(program, 'foreground'),
        rgb[0] / 255,
        rgb[1] / 255,
        rgb[2] / 255,
      )
      render()
    }
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      updatePlayback()
    })
    const sizing = new ResizeObserver(resize)
    const copySizing = new ResizeObserver(onLayoutChange)
    document.querySelectorAll('.paper-hero > *').forEach((element) => {
      copySizing.observe(element)
    })
    const theme = new MutationObserver(updateColor)
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    })
    sizing.observe(panel)
    intersection.observe(panel)
    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('scroll', onLayoutChange, { passive: true })
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    document.addEventListener('visibilitychange', updatePlayback)
    motion.addEventListener('change', updatePlayback)
    updateColor()
    resize()

    return () => {
      cancelAnimationFrame(frame)
      sizing.disconnect()
      copySizing.disconnect()
      intersection.disconnect()
      theme.disconnect()
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('scroll', onLayoutChange)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      document.removeEventListener('visibilitychange', updatePlayback)
      motion.removeEventListener('change', updatePlayback)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    }
  }, [generation, quiet])

  return <canvas ref={canvasRef} />
}
