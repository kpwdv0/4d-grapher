import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js"

// resolution, box size, colors
const cfg = { res: 50, box: 30, col: 0xff66cc, bg: 0x000000 }

const scn = new THREE.Scene()
scn.background = new THREE.Color(cfg.bg)

const viewport = document.getElementById("viewport")
const cam = new THREE.PerspectiveCamera(50, viewport.clientWidth / viewport.clientHeight, 0.1, 1000)
cam.position.set(45, 35, 45)

const rndr = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" })
rndr.setSize(viewport.clientWidth, viewport.clientHeight)
rndr.setPixelRatio(Math.min(window.devicePixelRatio, 2))
viewport.appendChild(rndr.domElement)

const ctrls = new OrbitControls(cam, rndr.domElement)
ctrls.enableDamping = true
ctrls.dampingFactor = 0.05
ctrls.enableZoom = false

// lights
scn.add(new THREE.AmbientLight(0xffffff, 0.6))
const d1 = new THREE.DirectionalLight(0xffffff, 0.8)
d1.position.set(50, 100, 50)
scn.add(d1)
const d2 = new THREE.DirectionalLight(0xffffff, 0.3)
d2.position.set(-50, -20, -50)
scn.add(d2)

// bounding box + grid so you can orient yourself
const boxE = new THREE.EdgesGeometry(new THREE.BoxGeometry(cfg.box * 2, cfg.box * 2, cfg.box * 2))
scn.add(new THREE.LineSegments(boxE, new THREE.LineBasicMaterial({ color: 0xcccccc })))
scn.add(new THREE.GridHelper(cfg.box * 2, 20))
scn.add(new THREE.AxesHelper(cfg.box + 5))

const mat = new THREE.MeshStandardMaterial({
  color: cfg.col,
  roughness: 0.2,
  metalness: 0.1,
  side: THREE.DoubleSide
})

// 5th arg is the triangle buffer cap. default is 10000, which complex
// surfaces blow past easily. overflow writes silently drop, so half
// the shape goes missing. 100000 covers anything we'd realistically draw.
const mc = new MarchingCubes(cfg.res, mat, true, true, 100000)
mc.scale.set(cfg.box, cfg.box, cfg.box)
scn.add(mc)

// app state
const st = {
  expr: "x^2 + y^2 + z^2 + w^2 - 100",
  fn: null, rng: 20, iso: 0,
  wPos: 0, xw: 0, yw: 0, zw: 0
}

// grab all the ui elements upfront
const ui = {
  inp: document.getElementById("func-input"),
  err: document.getElementById("error-msg"),
  pre: document.getElementById("preset-select"),
  rngTxt: document.getElementById("val-range"),
  sl: {
    iso: document.getElementById("iso"),
    wPos: document.getElementById("w-pos"),
    xw: document.getElementById("xw"),
    yw: document.getElementById("yw"),
    zw: document.getElementById("zw")
  },
  out: {
    iso: document.getElementById("val-iso"),
    wPos: document.getElementById("val-w-pos"),
    xw: document.getElementById("val-xw"),
    yw: document.getElementById("val-yw"),
    zw: document.getElementById("val-zw")
  },
  colSurf: document.getElementById("col-surface"),
  pause: {
    iso: document.getElementById("pause-iso"),
    wPos: document.getElementById("pause-w-pos"),
    xw: document.getElementById("pause-xw"),
    yw: document.getElementById("pause-yw"),
    zw: document.getElementById("pause-zw"),
    all: document.getElementById("pause-all")
  }
}

ui.colSurf.addEventListener("input", e => mat.color.set(e.target.value))

// animation state. each slider has its own on/off flag; pause-all is just
// a shortcut that flips them together. rotations wrap (0 to 2pi loop),
// iso and w-pos ping-pong off the ends.
const SLIDERS = ["iso", "wPos", "xw", "yw", "zw"]
const anim = {
  on: { iso: false, wPos: false, xw: false, yw: false, zw: false },
  speed: { iso: 12, wPos: 6, xw: 1.0, yw: 1.3, zw: 1.6 },
  dir: { iso: 1, wPos: 1, xw: 1, yw: 1, zw: 1 },
  wrap: { iso: false, wPos: false, xw: true, yw: true, zw: true }
}

const PLAY = "▶"
const PAUSE = "⏸"

function refreshPauseUI() {
  for (const k of SLIDERS) {
    ui.pause[k].textContent = anim.on[k] ? PAUSE : PLAY
    ui.pause[k].classList.toggle("paused", !anim.on[k])
  }
  const anyPlaying = SLIDERS.some(k => anim.on[k])
  ui.pause.all.textContent = anyPlaying ? `${PAUSE} pause all` : `${PLAY} play all`
}

for (const k of SLIDERS) {
  ui.pause[k].addEventListener("click", () => {
    anim.on[k] = !anim.on[k]
    refreshPauseUI()
  })
}

ui.pause.all.addEventListener("click", () => {
  const anyPlaying = SLIDERS.some(k => anim.on[k])
  for (const k of SLIDERS) anim.on[k] = !anyPlaying
  refreshPauseUI()
})

let lastT = performance.now()

// advance any animating sliders by dt seconds. returns true if anything moved
// so the render loop knows whether to rebuild the surface.
function tickAnim() {
  const now = performance.now()
  const dt = Math.min((now - lastT) / 1000, 0.1)
  lastT = now

  let changed = false
  for (const k of SLIDERS) {
    if (!anim.on[k]) continue
    const sl = ui.sl[k]
    const min = parseFloat(sl.min), max = parseFloat(sl.max)
    let v = parseFloat(st[k])

    const step = anim.speed[k] * dt
    if (anim.wrap[k]) {
      v += step
      if (v > max) v -= (max - min)
      if (v < min) v += (max - min)
    } else {
      v += step * anim.dir[k]
      if (v >= max) { v = max; anim.dir[k] = -1 }
      if (v <= min) { v = min; anim.dir[k] = 1 }
    }

    st[k] = v
    sl.value = v
    ui.out[k].innerText = v.toFixed(2)
    changed = true
  }
  return changed
}

// compile the user's string into an actual function.
// handles:
//   ^ for exponents
//   |expr| for absolute value
//   π for pi
//   any Math fn or constant (sin, cos, abs, max, sqrt, log, pi, e, ...)
//   case-insensitive, so PI/pi and SQRT2/sqrt2 both work
function makeFn(s) {
  try {
    let c = s.toLowerCase()
      .replace(/\^/g, "**")
      .replace(/π/g, "Math.PI")

    // turn |expr| pairs into abs(expr). odd-indexed pipes open,
    // even-indexed close. write plain abs() so the Math loop below
    // wraps it once (otherwise we'd end up with Math.Math.abs).
    // doesn't handle nested |a|b|| but that's rare, and abs() works.
    let pipeIdx = 0
    c = c.replace(/\|/g, () => (pipeIdx++ % 2 === 0) ? "abs(" : ")")

    // wrap any Math property name (functions and constants) with Math.
    Object.getOwnPropertyNames(Math).forEach(n => {
      c = c.replace(new RegExp(`\\b${n}\\b`, "gi"), `Math.${n}`)
    })

    const f = new Function("x", "y", "z", "w", `return ${c}`)
    f(0, 0, 0, 0) // test call, catches bad syntax early
    ui.inp.classList.remove("error")
    ui.err.innerText = ""
    return f
  } catch {
    ui.inp.classList.add("error")
    ui.err.innerText = "invalid syntax"
    return null
  }
}

// 2d plane rotation, used for all the 4d rotation combos
function rot(a, b, t) {
  const c = Math.cos(t), s = Math.sin(t)
  return [a * c - b * s, a * s + b * c]
}

function rebuild() {
  if (!st.fn) return

  mc.reset()
  const fld = mc.field
  const R = cfg.res
  let p = 0

  for (let k = 0; k < R; k++)
    for (let j = 0; j < R; j++)
      for (let i = 0; i < R; i++) {
        // map grid index to [-1,1] then scale by view range
        let ax = (i / (R - 1) * 2 - 1) * st.rng
        let ay = (j / (R - 1) * 2 - 1) * st.rng
        let az = (k / (R - 1) * 2 - 1) * st.rng
        let aw = parseFloat(st.wPos)

        // rotate in each 4d plane
        if (st.xw != 0) [ax, aw] = rot(ax, aw, st.xw)
        if (st.yw != 0) [ay, aw] = rot(ay, aw, st.yw)
        if (st.zw != 0) [az, aw] = rot(az, aw, st.zw)

        fld[p++] = st.fn(ax, ay, az, aw)
      }

  mc.isolation = parseFloat(st.iso)
  mc.update()

  if (ui.rngTxt) ui.rngTxt.innerText = st.rng.toFixed(1)
}

// scroll zooms the view range, not the camera
rndr.domElement.addEventListener("wheel", e => {
  e.preventDefault()
  const z = 0.05
  st.rng *= e.deltaY > 0 ? (1 + z) : (1 - z)
  st.rng = Math.max(0.1, Math.min(st.rng, 500))
  rebuild()
}, { passive: false })

// debounce so it doesn't recompute on every single keypress
let tmr
ui.inp.addEventListener("input", () => {
  clearTimeout(tmr)
  tmr = setTimeout(() => {
    st.fn = makeFn(ui.inp.value)
    rebuild()
  }, 300)
})

// wire up all the sliders at once. dragging a slider auto-pauses its
// animation so user input doesn't immediately get overridden.
Object.keys(ui.sl).forEach(k => {
  ui.sl[k].addEventListener("input", e => {
    st[k] = e.target.value
    ui.out[k].innerText = st[k]
    if (anim.on[k]) {
      anim.on[k] = false
      refreshPauseUI()
    }
    rebuild()
  })
})

ui.pre.addEventListener("change", e => {
  ui.inp.value = e.target.value
  st.fn = makeFn(ui.inp.value)
  // play all sliders on preset load
  for (const k of SLIDERS) anim.on[k] = true
  refreshPauseUI()
  rebuild()
})

window.addEventListener("resize", () => {
  cam.aspect = viewport.clientWidth / viewport.clientHeight
  cam.updateProjectionMatrix()
  rndr.setSize(viewport.clientWidth, viewport.clientHeight)
})

function loop() {
  requestAnimationFrame(loop)
  if (tickAnim()) rebuild()
  ctrls.update()
  rndr.render(scn, cam)
}

refreshPauseUI()
st.fn = makeFn(ui.inp.value)
rebuild()
loop()
