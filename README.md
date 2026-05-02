# implicit 4D grapher

**[live demo](https://4dgrapher.netlify.app/)** &nbsp;|&nbsp; **[blog post](https://mylittleinfinity.netlify.app/posts/4dgrapher/)**

Objects live in $\mathbb{R}^4$ with coordinates $(x,y,z,w)$. Since humans can only perceive 3D, the goal is to project 4D points down into something viewable - using a one-point projection along the $w$ axis, where the visible 3D space is one "slice" of the full 4D object.

---

## 1. Projection

Projection takes higher-dimensional points and turns them into lower-dimensional ones. With a camera at $(0,0,d)$ and a point at $(x,y,z)$, the projected point is:

$$x' = \frac{xd}{d-z}, \quad y' = \frac{yd}{d-z}$$

Points farther from the camera are scaled down (derived through similar triangles). Extending to 4D, the scale factor becomes $\frac{d}{d-w}$, giving:

$$x' = x \cdot \text{scale}, \quad y' = y \cdot \text{scale}, \quad z' = z \cdot \text{scale}$$

## 2. Rotations

In 4D, objects rotate around a **plane**. With 4 axes, there are $\binom{4}{2} = 6$ rotation planes: $xy, xz, xw, yz, yw, zw$ - three entirely within 3D space, and three involving the fourth dimension.

Starting from 2D: point $(a,b)$ in polar form rotated by $\theta$ gives:

$$a' = a\cos\theta - b\sin\theta, \quad b' = a\sin\theta + b\cos\theta$$

This generalizes cleanly. For an $xw$ rotation in 4D:

$$x' = x\cos\theta - w\sin\theta, \quad w' = x\sin\theta + w\cos\theta, \quad y' = y, \quad z' = z$$

## 3. Marching Cubes

To render the surface, we fix $w$ as a constant (the "slice"), evaluate $f(x,y,z,w)$ on a regular 3D grid, and run marching cubes to extract the isosurface at $f = c$.

Each voxel has 8 corners classified as inside/outside, encoded into an 8-bit index (256 cases). Edge intersections are found via linear interpolation:

$$p = p_1 + \frac{\text{iso} - v_1}{v_2 - v_1} \cdot (p_2 - p_1)$$

This is what allows the surface to appear smooth rather than aligned to the grid. A triangle lookup table then connects intersection points into triangles. Changing $w$ or any rotation angle reruns the whole algorithm and recomputes the surface.

---

## dev log

**Day 1** - coded a rotating cube in 2D to verify projection math. it works! YAYYYY!!!

**Day 2** - rendered a tesseract by defining hypercube points and edges manually. first full 4D → 3D → 2D pipeline. seeing it move correctly was very satisfying.

**Day 3** - added equation input. sampled random points, plugged them in, graphed them. produced a point cloud that sort-of resembled the function - if you squinted your eyes a little bit.

**Day 4** - tried connecting neighboring points with lines for more continuity. points only connected within the same $x$ value, producing a distorted mess.

**Day 5** - rewrote in three.js. tried triangulating neighbors directly → ~1.5 million triangles, GPU crash. this was supposed to take a day. (spoiler: it did not.)

**Day 6** - reverted to point cloud in three.js just to have something working. happy I got something to work.

**Day 7** - learned marching cubes. the algorithm classifies each voxel corner as inside/outside, interpolates edge intersections, and connects them into triangles using a lookup table. 256 total cases in 3D.

**Day 8** - implemented marching cubes from scratch in Python. super inefficient, triangles faded in and out when rotated.

**Day 9** - switched to three.js' built-in `MarchingCubes`. everything clicked. new pipeline: define $f(x,y,z,w)$ → choose $w$ slice → apply rotations → evaluate on 3D grid → run marching cubes → render. done!!!

**Day 10** - UI polish, added a bounding box (a lot harder than expected).

the actual code from each day (the broken-mesh attempts, the from-scratch marching cubes, etc) lives in [`archive/`](archive/) if you want to see how janky it was getting there.

---

## stack

- [three.js](https://threejs.org/) - rendering + built-in marching cubes
- Vite - dev/build
- Netlify - deploy

## running locally

```bash
git clone https://github.com/kpwdv0/4d-grapher.git
cd 4d-grapher/4dgrapher
npm install
npm run dev
```

opens at `localhost:5173`. type an equation in the input or grab a preset from the dropdown. scroll on the viewport to zoom (it scales the view range, not the camera distance). drag to orbit. the w slider sweeps through 4d slices, the xw/yw/zw sliders rotate in the planes that touch the 4th axis.

## equation syntax

variables: `x`, `y`, `z`, `w`. case insensitive.

| you can write           | what it means                  |
| ----------------------- | ------------------------------ |
| `x^2`                   | x squared                      |
| `\|x\|`                 | absolute value of x            |
| `sin(x)`, `cos(x)`, ... | trig functions                 |
| `sqrt(x)`, `log(x)`, `exp(x)`, `abs(x)`, `max(...)`, `min(...)` | the obvious thing |
| `pi`, `π`               | π (3.14159...)                 |
| `e`                     | e (2.71828...)                 |

anything from JavaScript's [Math object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math) works, so `atan2`, `hypot`, `cbrt`, `sinh`, etc are all fair game.

## license

MIT. do whatever you want with it.
