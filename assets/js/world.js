// Voxel world: the 3D background of every page.
// Thousands of cubes in ONE instanced draw call, each a little spring-damper chasing a target
// point. Pages (or scrolled sections) pick a shape and the cubes fly over to build it.
// Mobile gets fewer cubes, a lower render scale and no bloom; the loop sleeps when the tab is hidden.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const BG = 0x070605;
const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

export function isMobileDevice()
{
    return window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;
}

// Deterministic RNG so shapes look the same on every visit
function rng(seed)
{
    let s = seed >>> 0;
    return () =>
    {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// --- Shapes ----------------------------------------------------------------------------------
// Each returns { points: Float32Array(xyz...), cube, spin, tilt, align, width, height, dynamic? }

function textShape(lines, budget, depth, maxWidth, maxHeight = Infinity)
{
    const fs = 180;
    const font = `800 ${fs}px "Encode Sans", system-ui, sans-serif`;
    const c = document.createElement('canvas');
    let ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.font = font;
    const widths = lines.map(l => ctx.measureText(l).width);
    const lineH = fs * 0.98;
    const W = Math.ceil(Math.max(...widths)) + 24;
    const H = Math.ceil(lineH * lines.length) + 24;
    c.width = W;
    c.height = H;
    ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.font = font;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, W / 2, 12 + lineH * (i + 0.56)));
    const alpha = ctx.getImageData(0, 0, W, H).data;

    const sample = (step) =>
    {
        const out = [];
        for (let y = step / 2; y < H; y += step)
            for (let x = step / 2; x < W; x += step)
                if (alpha[(Math.floor(y) * W + Math.floor(x)) * 4 + 3] > 140)
                    out.push(x, y);
        return out;
    };
    // Smallest step whose cell count fits the budget
    let lo = 2, hi = 40, best = sample(hi), bestStep = hi;
    while (hi - lo > 0.25)
    {
        const mid = (lo + hi) / 2;
        const s = sample(mid);
        if ((s.length / 2) * depth <= budget) { best = s; bestStep = mid; hi = mid; }
        else lo = mid;
    }
    const wpp = Math.min(maxWidth / Math.max(...widths), maxHeight / H);
    const cell = bestStep * wpp;
    const pts = new Float32Array((best.length / 2) * depth * 3);
    let k = 0;
    for (let i = 0; i < best.length; i += 2)
        for (let d = 0; d < depth; d++)
        {
            pts[k++] = (best[i] - W / 2) * wpp;
            pts[k++] = -(best[i + 1] - H / 2) * wpp;
            pts[k++] = (d - (depth - 1) / 2) * cell;
        }
    return { points: pts, cube: cell * 0.9, spin: 0, tilt: 0, align: true, width: W * wpp, height: H * wpp, sweep: true };
}

function planetShape(n)
{
    const r = rng(7);
    const sphereN = Math.floor(n * 0.55), ringN = n - sphereN;
    const pts = new Float32Array(n * 3);
    const R = 8.5, golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < sphereN; i++)
    {
        const y = 1 - (i / (sphereN - 1)) * 2, rad = Math.sqrt(1 - y * y), th = golden * i;
        pts[i * 3] = Math.cos(th) * rad * R;
        pts[i * 3 + 1] = y * R;
        pts[i * 3 + 2] = Math.sin(th) * rad * R;
    }
    for (let i = 0; i < ringN; i++)
    {
        const a = r() * TAU, rr = 12 + Math.pow(r(), 0.7) * 6;
        const j = (sphereN + i) * 3;
        pts[j] = Math.cos(a) * rr;
        pts[j + 1] = (r() - 0.5) * 0.5;
        pts[j + 2] = Math.sin(a) * rr;
    }
    return { points: pts, cube: 0.5, spin: 0.16, tilt: 0.42, roll: -0.25, align: false, width: 36, height: 20 };
}

function cubeShape(n)
{
    // Hollow cube shell, side chosen to fit the budget
    let side = 4;
    while (Math.pow(side + 1, 3) - Math.pow(side - 1, 3) <= n * 0.92)
        side++;
    const cell = 16 / side;
    const pts = [];
    for (let x = 0; x < side; x++)
        for (let y = 0; y < side; y++)
            for (let z = 0; z < side; z++)
            {
                if (x > 0 && y > 0 && z > 0 && x < side - 1 && y < side - 1 && z < side - 1)
                    continue;
                pts.push((x - (side - 1) / 2) * cell, (y - (side - 1) / 2) * cell, (z - (side - 1) / 2) * cell);
            }
    return { points: new Float32Array(pts), cube: cell * 0.82, spin: 0.22, tilt: 0.5, roll: 0.3, align: true, width: 24, height: 24 };
}

function latticeShape(n)
{
    let side = 3;
    while (Math.pow(side + 1, 3) <= n * 0.7)
        side++;
    const gap = 20 / side;
    const pts = [];
    for (let x = 0; x < side; x++)
        for (let y = 0; y < side; y++)
            for (let z = 0; z < side; z++)
                pts.push((x - (side - 1) / 2) * gap, (y - (side - 1) / 2) * gap, (z - (side - 1) / 2) * gap);
    return { points: new Float32Array(pts), cube: gap * 0.32, spin: 0.1, tilt: 0.55, roll: 0.62, align: true, width: 30, height: 30 };
}

function ringShape(n)
{
    const pts = new Float32Array(n * 3);
    const R = 15, rr = 2.4;
    const v = Math.max(8, Math.round(Math.sqrt(n / 9))), u = Math.floor(n / v);
    let k = 0;
    for (let i = 0; i < u; i++)
        for (let j = 0; j < v; j++)
        {
            const a = (i / u) * TAU, b = (j / v) * TAU + i * 0.21;
            pts[k++] = (R + rr * Math.cos(b)) * Math.cos(a);
            pts[k++] = rr * Math.sin(b);
            pts[k++] = (R + rr * Math.cos(b)) * Math.sin(a);
        }
    return { points: pts.subarray(0, k), cube: 0.55, spin: 0.08, tilt: 1.15, roll: 0, align: false, width: 36, height: 16 };
}

function knotShape(n)
{
    const p = 2, q = 3, tube = Math.max(6, Math.round(Math.sqrt(n / 30)));
    const segs = Math.floor(n / tube);
    const pts = new Float32Array(segs * tube * 3);
    const curve = (t, out) =>
    {
        const r = 2 + Math.cos(q * t);
        out.set(r * Math.cos(p * t), r * Math.sin(p * t), Math.sin(q * t) * 1.2);
        return out.multiplyScalar(3.6);
    };
    const a = new THREE.Vector3(), b = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    let k = 0;
    for (let i = 0; i < segs; i++)
    {
        const t = (i / segs) * TAU;
        curve(t, a);
        curve(t + 0.01, b);
        T.subVectors(b, a).normalize();
        N.set(0, 0, 1).cross(T).normalize();
        B.crossVectors(T, N);
        for (let j = 0; j < tube; j++)
        {
            const ang = (j / tube) * TAU;
            const rad = 1.3;
            pts[k++] = a.x + (N.x * Math.cos(ang) + B.x * Math.sin(ang)) * rad;
            pts[k++] = a.y + (N.y * Math.cos(ang) + B.y * Math.sin(ang)) * rad;
            pts[k++] = a.z + (N.z * Math.cos(ang) + B.z * Math.sin(ang)) * rad;
        }
    }
    return { points: pts, cube: 0.48, spin: 0.2, tilt: 0.3, roll: 0, align: false, width: 26, height: 26 };
}

function helixShape(n)
{
    const strands = Math.floor(n * 0.8), rungs = n - strands;
    const pts = new Float32Array(n * 3);
    const len = 30, R = 5, turns = 3.2;
    const per = Math.floor(strands / 2);
    let k = 0;
    for (let s = 0; s < 2; s++)
        for (let i = 0; i < per; i++)
        {
            const t = i / per, a = t * turns * TAU + s * Math.PI;
            const jitter = ((i * 7919) % 13) / 13 - 0.5;
            pts[k++] = Math.cos(a) * (R + jitter * 0.9);
            pts[k++] = (t - 0.5) * len;
            pts[k++] = Math.sin(a) * (R + jitter * 0.9);
        }
    const rungCount = 26, perRung = Math.max(1, Math.floor(rungs / rungCount));
    for (let r = 0; r < rungCount && k < pts.length - 2; r++)
    {
        const t = (r + 0.5) / rungCount, a = t * turns * TAU, y = (t - 0.5) * len;
        for (let j = 0; j < perRung && k < pts.length - 2; j++)
        {
            const f = j / Math.max(1, perRung - 1) * 2 - 1;
            pts[k++] = Math.cos(a) * R * f;
            pts[k++] = y;
            pts[k++] = Math.sin(a) * R * f;
        }
    }
    return { points: pts.subarray(0, k), cube: 0.5, spin: 0.35, tilt: 0.12, roll: -0.35, align: false, width: 16, height: 32 };
}

function galaxyShape(n)
{
    const r = rng(42);
    const pts = new Float32Array(n * 3);
    for (let i = 0; i < n; i++)
    {
        const arm = i % 3, t = Math.pow(r(), 0.65);
        const rad = 1.5 + t * 17;
        const a = arm * (TAU / 3) + rad * 0.32 + (r() - 0.5) * (0.9 - t * 0.5);
        pts[i * 3] = Math.cos(a) * rad;
        pts[i * 3 + 1] = (r() - 0.5) * (2.6 - t * 2) ;
        pts[i * 3 + 2] = Math.sin(a) * rad;
    }
    return { points: pts, cube: 0.42, spin: 0.07, tilt: 1.0, roll: 0.2, align: false, width: 38, height: 22 };
}

function waveShape(n)
{
    const cols = Math.round(Math.sqrt(n * 2.2)), rows = Math.floor(n / cols);
    const gap = 0.95;
    const pts = new Float32Array(cols * rows * 3);
    const base = new Float32Array(cols * rows * 2);
    let k = 0;
    for (let z = 0; z < rows; z++)
        for (let x = 0; x < cols; x++)
        {
            const i = z * cols + x;
            base[i * 2] = (x - (cols - 1) / 2) * gap;
            base[i * 2 + 1] = (z - (rows - 1) / 2) * gap;
            pts[k++] = base[i * 2];
            pts[k++] = 0;
            pts[k++] = base[i * 2 + 1];
        }
    return {
        points: pts, cube: gap * 0.78, spin: 0, tilt: 0.55, roll: 0, align: true, width: cols * gap, height: 14,
        dynamic: (time, out) =>
        {
            for (let i = 0, m = out.length / 3; i < m; i++)
            {
                const x = base[i * 2], z = base[i * 2 + 1];
                out[i * 3 + 1] = Math.sin(x * 0.28 + time * 1.1) * 1.6 + Math.cos(z * 0.35 + time * 0.8) * 1.2 + Math.sin((x + z) * 0.12 - time * 0.6) * 1.4;
            }
        }
    };
}

// --- World -----------------------------------------------------------------------------------

export class VoxelWorld
{
    constructor(canvas, options = {})
    {
        this.canvas = canvas;
        this.mobile = options.mobile ?? isMobileDevice();
        const lowEnd = (navigator.hardwareConcurrency || 8) <= 4;
        this.count = options.count ?? (this.mobile ? 1400 : lowEnd ? 2400 : 3600);
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.textLines = options.text || ['HELLO'];
        this.shapeName = null;
        this.layout = { x: 0, y: 0, scale: 1 };
        this.currentLayout = { x: 0, y: 0 };
        this.pointer = { ndc: new THREE.Vector2(), active: 0, x: 0.5, y: 0.5 };
        this.time = 0;
        this.running = false;
        this.onStats = options.onStats || null;

        this._initRenderer();
        this._initInstances();
        this._initInput();
        this.resize();

        document.addEventListener('visibilitychange', () => this._updateRunning());
        window.addEventListener('resize', () =>
        {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => this.resize(), 120);
        });
    }

    _initRenderer()
    {
        const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.mobile, powerPreference: 'high-performance' });
        r.setClearColor(BG);
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.toneMappingExposure = 1.1;
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.info.autoReset = false;
        this.renderer = r;

        const scene = new THREE.Scene();
        scene.fog = new THREE.Fog(BG, 48, 120);
        this.scene = scene;
        this.camera = new THREE.PerspectiveCamera(35, 1, 1, 300);
        this.camera.position.set(0, 0, 60);

        scene.add(new THREE.HemisphereLight(0xffe2b8, 0x0d0906, 0.55));
        const key = new THREE.DirectionalLight(0xffd8a8, 2.4);
        key.position.set(-20, 26, 30);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xff7a00, 2.2);
        rim.position.set(24, -6, -26);
        scene.add(rim);
        this.cursorLight = new THREE.PointLight(0xffa64d, 0, 26, 1.4);
        scene.add(this.cursorLight);

        if (!this.mobile)
        {
            this.composer = new EffectComposer(r);
            this.composer.addPass(new RenderPass(scene, this.camera));
            this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.32, 1.0);
            this.composer.addPass(this.bloom);
            this.composer.addPass(new OutputPass());
        }
    }

    _initInstances()
    {
        const n = this.count;
        const geo = this.mobile ? new THREE.BoxGeometry(1, 1, 1) : new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: 0.15 });
        // Instance colors above 1.0 also glow (fed to the bloom on desktop)
        mat.onBeforeCompile = (shader) =>
        {
            shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
                '#include <emissivemap_fragment>\n#if defined( USE_COLOR )\n totalEmissiveRadiance += max( vColor.rgb - 1.0, 0.0 ) * 1.1;\n#endif');
        };
        const mesh = new THREE.InstancedMesh(geo, mat, n);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        this.mesh = mesh;
        this.scene.add(mesh);

        this.pos = new Float32Array(n * 3);
        this.vel = new Float32Array(n * 3);
        this.tgt = new Float32Array(n * 3);
        this.next = new Float32Array(n * 3);
        this.dust = new Float32Array(n * 3);
        this.switchAt = new Float32Array(n).fill(-1);
        this.axis = new Uint8Array(n);
        this.angle = new Float32Array(n);
        this.spinRate = new Float32Array(n);
        this.size = new Float32Array(n);
        this.tgtSize = new Float32Array(n);
        this.nextSize = new Float32Array(n);
        this.phase = new Float32Array(n);
        this.inShape = new Uint8Array(n);

        const r = rng(1337);
        const color = new THREE.Color();
        const ambers = ['#ffa500', '#ff9100', '#ffb733', '#e88a00', '#ffc85a', '#f07c00'];
        const darks = ['#2c2824', '#38322b', '#201d1a', '#4a3a26'];
        const deep = ['#b35c00', '#8a4a10', '#c96f00'];
        for (let i = 0; i < n; i++)
        {
            const roll = r();
            if (roll < 0.5) color.set(ambers[Math.floor(r() * ambers.length)]);
            else if (roll < 0.78) color.set(darks[Math.floor(r() * darks.length)]);
            else if (roll < 0.96) color.set(deep[Math.floor(r() * deep.length)]);
            else color.setRGB(2.4 + r(), 1.15 + r() * 0.4, 0.2);
            mesh.setColorAt(i, color);

            // Dust: a loose shell around and behind everything
            const a = r() * TAU, rad = 30 + r() * 34, y = (r() - 0.5) * 60;
            this.dust[i * 3] = Math.cos(a) * rad;
            this.dust[i * 3 + 1] = y;
            this.dust[i * 3 + 2] = Math.sin(a) * rad * 0.8 - 22;
            this.pos[i * 3] = this.dust[i * 3] * 1.6;
            this.pos[i * 3 + 1] = this.dust[i * 3 + 1] * 1.6;
            this.pos[i * 3 + 2] = this.dust[i * 3 + 2] - 40;
            this.axis[i] = Math.floor(r() * 3);
            this.angle[i] = r() * TAU;
            this.spinRate[i] = (r() < 0.5 ? -1 : 1) * (0.6 + r() * 1.8);
            this.phase[i] = r() * TAU;
            this.size[i] = 0.01;
        }
        mesh.instanceColor.needsUpdate = true;
        this.dustSize = (i) => 0.14 + (this.phase[i] / TAU) * 0.22;
    }

    _initInput()
    {
        window.addEventListener('pointermove', (e) =>
        {
            if (e.pointerType !== 'mouse')
                return;
            this.pointer.x = e.clientX / window.innerWidth;
            this.pointer.y = e.clientY / window.innerHeight;
            this.pointer.ndc.set(this.pointer.x * 2 - 1, -(this.pointer.y * 2 - 1));
            this.pointer.active = 1.6;
        }, { passive: true });

        window.addEventListener('click', (e) =>
        {
            if (e.defaultPrevented || e.button !== 0)
                return;
            if (e.target.closest('a, button, input, textarea, select, label, img, video, pre, code, p, li, h1, h2, h3, h4, dd, dt, td, th, .tile, .no-pulse'))
                return;
            this.pointer.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
            this.pulse(this.pointer.ndc);
        });
    }

    // --- Public API ---------------------------------------------------------------------------

    async setShape(name, layout)
    {
        if (layout)
            this.setLayout(layout);
        if (name === this.shapeName)
            return;
        this.shapeName = name;
        const shape = await this._buildShape(name);
        if (name !== this.shapeName)
            return; // superseded while the font was loading
        this._applyShape(shape);
    }

    setLayout({ x = 0, y = 0, scale = 1 } = {})
    {
        this.layout = { x: this.mobile ? 0 : x, y, scale };
        if (this.shape && this.vis)
            this._fitShape(this.shape);
    }

    setText(lines)
    {
        this.textLines = lines;
    }

    pulse(ndc)
    {
        const ray = this._localRay(ndc);
        if (!ray)
            return;
        // Closest point on the ray to the shape's center
        const c = ray.origin.clone().addScaledVector(ray.dir, -ray.origin.dot(ray.dir));
        const R = 11 / this.mesh.scale.x;
        for (let i = 0; i < this.count; i++)
        {
            const j = i * 3;
            const dx = this.pos[j] - c.x, dy = this.pos[j + 1] - c.y, dz = this.pos[j + 2] - c.z;
            const d = Math.hypot(dx, dy, dz);
            if (d > R || d < 1e-4)
                continue;
            const f = (1 - d / R) * 55 / d;
            this.vel[j] += dx * f;
            this.vel[j + 1] += dy * f;
            this.vel[j + 2] += dz * f + 8 * (1 - d / R);
        }
    }

    start()
    {
        this.started = true;
        this._updateRunning();
    }

    resize()
    {
        const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2) * (this.mobile ? 0.85 : 1);
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h, false);
        if (this.composer)
        {
            this.composer.setPixelRatio(dpr);
            this.composer.setSize(w, h);
        }
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        const visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
        this.vis = { w: visH * this.camera.aspect, h: visH };
        // Text depends on the viewport, rebuild it
        if (this.shapeName && this.shapeName.startsWith('text'))
        {
            const name = this.shapeName;
            this.shapeName = null;
            this.setShape(name);
        }
        else if (this.shape)
            this._fitShape(this.shape);
        if (!this.running)
            this._render();
    }

    // --- Internals ----------------------------------------------------------------------------

    async _buildShape(name)
    {
        const n = this.count;
        switch (name)
        {
        case 'planet': return planetShape(Math.floor(n * 0.9));
        case 'cube': return cubeShape(n);
        case 'lattice': return latticeShape(n);
        case 'ring': return ringShape(Math.floor(n * 0.85));
        case 'knot': return knotShape(Math.floor(n * 0.88));
        case 'helix': return helixShape(Math.floor(n * 0.7));
        case 'galaxy': return galaxyShape(Math.floor(n * 0.92));
        case 'wave': return waveShape(Math.floor(n * 0.9));
        case 'none': return { points: new Float32Array(0), cube: 1, spin: 0.03, tilt: 0, align: false, width: 1, height: 1 };
        default:
            if (name.startsWith('text'))
            {
                try { await document.fonts.load('800 100px "Encode Sans"'); } catch { /* fallback font */ }
                const portrait = this.vis.w / this.vis.h < 0.9;
                const custom = name.includes(':') ? name.slice(5).split('|') : null;
                const lines = custom || (portrait && this.textLines.length === 1 && this.textLines[0].includes(' ') ? this.textLines[0].split(' ') : this.textLines);
                const maxW = Math.min(this.vis.w * (portrait ? 0.86 : 0.8), 64);
                return textShape(lines, Math.floor(n * 0.88), this.mobile ? 1 : 2, maxW, this.vis.h * 0.52);
            }
            return planetShape(Math.floor(n * 0.9));
        }
    }

    _fitShape(shape)
    {
        // Shapes pushed to the side only get the free half of the screen
        const side = Math.abs(this.layout.x) > 0.3;
        const fit = Math.min(1, (this.vis.w * (side ? 0.6 : 0.92)) / shape.width, (this.vis.h * 0.86) / shape.height);
        this.targetScale = (shape.sweep ? 1 : fit) * (this.layout.scale || 1);
    }

    _applyShape(shape)
    {
        this.shape = shape;
        this._fitShape(shape);
        const n = this.count, m = Math.min(n, shape.points.length / 3);
        const now = this.time;
        let minX = Infinity, maxX = -Infinity;
        if (shape.sweep)
            for (let i = 0; i < m; i++) { minX = Math.min(minX, shape.points[i * 3]); maxX = Math.max(maxX, shape.points[i * 3]); }
        const r = rng(Math.floor(Math.random() * 1e9));
        for (let i = 0; i < n; i++)
        {
            const j = i * 3;
            if (i < m)
            {
                this.next[j] = shape.points[j];
                this.next[j + 1] = shape.points[j + 1];
                this.next[j + 2] = shape.points[j + 2];
                this.nextSize[i] = shape.cube * (0.86 + (this.phase[i] / TAU) * 0.14);
                this.inShape[i] = 1;
            }
            else
            {
                this.next[j] = this.dust[j];
                this.next[j + 1] = this.dust[j + 1];
                this.next[j + 2] = this.dust[j + 2];
                this.nextSize[i] = this.dustSize(i);
                this.inShape[i] = 0;
            }
            const sweep = shape.sweep ? ((shape.points[j] - minX) / Math.max(1, maxX - minX)) * 0.55 : 0;
            this.switchAt[i] = this.reducedMotion ? now : now + (i < m ? r() * 0.45 + sweep : r() * 0.7);
        }
        this.pendingSwitch = true;
        if (this.reducedMotion)
        {
            this._flushSwitches(Infinity);
            this.pos.set(this.tgt);
            this.size.set(this.tgtSize);
        }
    }

    _flushSwitches(now)
    {
        let pending = false;
        for (let i = 0, n = this.count; i < n; i++)
        {
            const s = this.switchAt[i];
            if (s < 0)
                continue;
            if (now >= s)
            {
                const j = i * 3;
                this.tgt[j] = this.next[j];
                this.tgt[j + 1] = this.next[j + 1];
                this.tgt[j + 2] = this.next[j + 2];
                this.tgtSize[i] = this.nextSize[i];
                this.switchAt[i] = -1;
                // A kick so cubes leave their old spot with some life
                this.vel[j] += (Math.random() - 0.5) * 6;
                this.vel[j + 1] += (Math.random() - 0.5) * 6 + 2;
                this.vel[j + 2] += (Math.random() - 0.5) * 6;
            }
            else
                pending = true;
        }
        this.pendingSwitch = pending;
    }

    _localRay(ndc)
    {
        if (!this.mesh)
            return null;
        this.mesh.updateMatrixWorld();
        const inv = this._inv || (this._inv = new THREE.Matrix4());
        inv.copy(this.mesh.matrixWorld).invert();
        const ray = (this._ray || (this._ray = new THREE.Raycaster()));
        ray.setFromCamera(ndc, this.camera);
        const o = ray.ray.origin.clone().applyMatrix4(inv);
        const p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 10).applyMatrix4(inv);
        return { origin: o, dir: p.sub(o).normalize() };
    }

    _updateRunning()
    {
        const should = this.started && !document.hidden;
        if (should === this.running)
            return;
        this.running = should;
        if (should)
        {
            this.last = performance.now();
            requestAnimationFrame(() => this._loop());
        }
    }

    _loop()
    {
        if (!this.running)
            return;
        requestAnimationFrame(() => this._loop());
        const nowMs = performance.now();
        const dt = Math.min(0.05, (nowMs - this.last) / 1000);
        this.last = nowMs;
        this.time += dt;
        this._simulate(dt);
        this._render();

        this._frames = (this._frames || 0) + 1;
        this._statT = (this._statT || 0) + dt;
        if (this._statT > 0.5 && this.onStats)
        {
            this.onStats({ fps: this._frames / this._statT, cubes: this.count, calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles });
            this._frames = 0;
            this._statT = 0;
        }
    }

    _simulate(dt)
    {
        const shape = this.shape;
        if (!shape)
            return;
        if (this.pendingSwitch)
            this._flushSwitches(this.time);
        if (shape.dynamic && !this.reducedMotion)
        {
            const m = Math.min(this.count, shape.points.length / 3);
            shape.dynamic(this.time, shape.points);
            for (let i = 0; i < m; i++)
                if (this.switchAt[i] < 0 && this.inShape[i])
                    this.tgt[i * 3 + 1] = shape.points[i * 3 + 1];
        }

        // Mesh transform: layout offset, fit scale, spin and tilt
        const mesh = this.mesh;
        const k = 1 - Math.exp(-dt * 2.2);
        const lx = this.layout.x * this.vis.w * 0.5, ly = this.layout.y * this.vis.h * 0.5;
        mesh.position.x += (lx - mesh.position.x) * k;
        mesh.position.y += (ly - mesh.position.y) * k;
        const s = mesh.scale.x + ((this.targetScale || 1) - mesh.scale.x) * k;
        mesh.scale.setScalar(s);
        const motion = this.reducedMotion ? 0 : 1;
        if (shape.spin)
            mesh.rotation.y += shape.spin * dt * motion;
        else
        {
            const goal = Math.round(mesh.rotation.y / TAU) * TAU + (this.pointer.active > 0 ? (this.pointer.x - 0.5) * 0.35 : 0);
            mesh.rotation.y += (goal - mesh.rotation.y) * k;
        }
        mesh.rotation.x += ((shape.tilt || 0) + (shape.spin ? Math.sin(this.time * 0.2) * 0.08 * motion : 0) - mesh.rotation.x) * k;
        mesh.rotation.z += ((shape.roll || 0) - mesh.rotation.z) * k;

        // Pointer ray in shape space
        this.pointer.active = Math.max(0, this.pointer.active - dt);
        let ray = null, R = 0, R2 = 0;
        if (this.pointer.active > 0 && !this.reducedMotion)
        {
            ray = this._localRay(this.pointer.ndc);
            R = 3.6 / mesh.scale.x;
            R2 = R * R;
            // Cursor light sits where the ray passes the shape
            const c = ray.origin.clone().addScaledVector(ray.dir, -ray.origin.dot(ray.dir) - 4).applyMatrix4(mesh.matrixWorld);
            this.cursorLight.position.copy(c);
        }
        this.cursorLight.intensity += ((ray ? 110 * Math.min(1, this.pointer.active) : 0) - this.cursorLight.intensity) * k * 3;

        const pos = this.pos, vel = this.vel, tgt = this.tgt;
        const stiff = 24, damp = 6.8;
        const ox = ray ? ray.origin.x : 0, oy = ray ? ray.origin.y : 0, oz = ray ? ray.origin.z : 0;
        const dx0 = ray ? ray.dir.x : 0, dy0 = ray ? ray.dir.y : 0, dz0 = ray ? ray.dir.z : 0;
        const t = this.time, floatAmp = (shape.align ? 0.025 : 0.1) * motion;
        const arr = mesh.instanceMatrix.array;
        const sizeK = 1 - Math.exp(-dt * 5);

        for (let i = 0, n = this.count; i < n; i++)
        {
            const j = i * 3;
            const ph = this.phase[i];
            const fx = tgt[j] + Math.sin(t * 0.9 + ph) * floatAmp;
            const fy = tgt[j + 1] + Math.cos(t * 0.7 + ph * 1.3) * floatAmp;
            const fz = tgt[j + 2] + (this.inShape[i] ? 0 : Math.sin(t * 0.3 + ph) * 1.5);
            let ax = (fx - pos[j]) * stiff - vel[j] * damp;
            let ay = (fy - pos[j + 1]) * stiff - vel[j + 1] * damp;
            let az = (fz - pos[j + 2]) * stiff - vel[j + 2] * damp;

            if (ray)
            {
                const wx = pos[j] - ox, wy = pos[j + 1] - oy, wz = pos[j + 2] - oz;
                const proj = wx * dx0 + wy * dy0 + wz * dz0;
                const qx = wx - dx0 * proj, qy = wy - dy0 * proj, qz = wz - dz0 * proj;
                const d2 = qx * qx + qy * qy + qz * qz;
                if (d2 < R2 && d2 > 1e-6)
                {
                    const d = Math.sqrt(d2), f = (1 - d / R) * (1 - d / R) * 900 / d;
                    ax += qx * f;
                    ay += qy * f;
                    az += qz * f + 40 * (1 - d / R);
                }
            }
            vel[j] += ax * dt; vel[j + 1] += ay * dt; vel[j + 2] += az * dt;
            pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;

            const speed = Math.abs(vel[j]) + Math.abs(vel[j + 1]) + Math.abs(vel[j + 2]);
            const agitation = Math.min(1, speed * 0.12);
            let ang = this.angle[i] + this.spinRate[i] * dt * (shape.align ? agitation * 3 : 0.25 + agitation * 3) * motion;
            if (shape.align && this.inShape[i] && agitation < 0.3)
            {
                const snap = Math.round(ang / HALF_PI) * HALF_PI;
                ang += (snap - ang) * Math.min(1, dt * 5);
            }
            this.angle[i] = ang;
            this.size[i] += (this.tgtSize[i] - this.size[i]) * sizeK;

            // Compose: rotation about one principal axis, uniform scale, translation (column-major)
            const sc = this.size[i], c = Math.cos(ang) * sc, sn = Math.sin(ang) * sc;
            const o = i * 16;
            if (this.axis[i] === 0)
            {
                arr[o] = sc; arr[o + 1] = 0; arr[o + 2] = 0;
                arr[o + 4] = 0; arr[o + 5] = c; arr[o + 6] = sn;
                arr[o + 8] = 0; arr[o + 9] = -sn; arr[o + 10] = c;
            }
            else if (this.axis[i] === 1)
            {
                arr[o] = c; arr[o + 1] = 0; arr[o + 2] = -sn;
                arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0;
                arr[o + 8] = sn; arr[o + 9] = 0; arr[o + 10] = c;
            }
            else
            {
                arr[o] = c; arr[o + 1] = sn; arr[o + 2] = 0;
                arr[o + 4] = -sn; arr[o + 5] = c; arr[o + 6] = 0;
                arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = sc;
            }
            arr[o + 3] = 0; arr[o + 7] = 0; arr[o + 11] = 0;
            arr[o + 12] = pos[j]; arr[o + 13] = pos[j + 1]; arr[o + 14] = pos[j + 2]; arr[o + 15] = 1;
        }
        mesh.instanceMatrix.needsUpdate = true;

        // Camera parallax
        const px = (this.pointer.x - 0.5) * 3 * motion, py = (this.pointer.y - 0.5) * -2 * motion;
        this.camera.position.x += (px - this.camera.position.x) * k;
        this.camera.position.y += (py - this.camera.position.y) * k;
        this.camera.lookAt(0, 0, 0);
    }

    _render()
    {
        this.renderer.info.reset();
        if (this.composer)
            this.composer.render();
        else
            this.renderer.render(this.scene, this.camera);
    }
}
