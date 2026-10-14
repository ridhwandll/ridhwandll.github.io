// Surge website - physics stage
// One Three.js renderer + one cannon-es world per canvas. Blocks are a single InstancedMesh
// (one draw call, like Surge's automatic instancing), physics runs on a fixed 1/60 step with
// render interpolation (like Surge's Jolt integration), and the loop stops when the canvas
// is off screen or the tab is hidden (like Surge suspending a minimized window).

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const FIXED_STEP = 1 / 60;
const BLOCK_HALF = 0.495;
const BALL_RADIUS = 0.5;
const MAX_BALLS = 16;
const MAX_SPARKS = 700;
const BG = 0x060606;

export const QUALITY = {
    mobile:  { label: 'Mobile',  renderScale: 0.8, shadowMap: 1024, bloom: false, depth: 1, iterations: 7 },
    desktop: { label: 'Desktop', renderScale: 1.0, shadowMap: 2048, bloom: true,  depth: 2, iterations: 10 }
};

export function detectQuality()
{
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 600;
    return coarse || small ? 'mobile' : 'desktop';
}

const tmpObj = new THREE.Object3D();
const tmpVec = new THREE.Vector3();
const tmpColor = new THREE.Color();

function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

export class Stage
{
    // options:
    //   canvas, layout(quality, aspect) -> { blocks: [{ x, y, z, color, group }], target: Vector3, size: { w, h }, view: { dir, fov } }
    //   hover: bool (pointer pushes blocks), autoRebuild: seconds idle before rebuilding (0 = never)
    //   onStats(stats) every 250 ms, quality: 'mobile' | 'desktop'
    constructor(options)
    {
        this.opts = options;
        this.canvas = options.canvas;
        this.qualityName = options.quality || detectQuality();
        this.quality = QUALITY[this.qualityName];
        this.timeScale = 1;
        this.running = false;
        this.visible = false;
        this.assembling = null;
        this.lastInteraction = 0;
        this.pointer = { x: 0, y: 0, inside: false, ndc: new THREE.Vector2(), hasMoved: false };
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this._initRenderer();
        this._initScene();
        this._initPhysics();
        this._initSparks();
        this._initInput();
        this.build();

        this.clock = new THREE.Clock(false);
        this.frames = 0;
        this.statTimer = 0;
        this._loop = this._loop.bind(this);

        const io = new IntersectionObserver((entries) =>
        {
            this.visible = entries[0].isIntersecting;
            this._updateRunning();
        }, { threshold: 0.01 });
        io.observe(this.canvas);
        document.addEventListener('visibilitychange', () => this._updateRunning());

        this._resizeObserver = new ResizeObserver(() => this.resize());
        this._resizeObserver.observe(this.canvas.parentElement);
        this.resize();
    }

    // --- Setup ---------------------------------------------------------------------------

    _initRenderer()
    {
        const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: this.qualityName === 'desktop', powerPreference: 'high-performance' });
        r.toneMapping = THREE.ACESFilmicToneMapping; // Surge tonemaps with ACES too
        r.toneMappingExposure = 1.05;
        r.outputColorSpace = THREE.SRGBColorSpace;
        r.shadowMap.enabled = true;
        r.shadowMap.type = THREE.PCFSoftShadowMap;
        r.info.autoReset = false;
        this.renderer = r;
    }

    _initScene()
    {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(BG);
        scene.fog = new THREE.Fog(BG, 38, 95);
        this.scene = scene;

        this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 300);

        scene.add(new THREE.HemisphereLight(0xffe7c2, 0x140d04, 0.6));

        const sun = new THREE.DirectionalLight(0xffdcae, 3.2);
        sun.position.set(-14, 26, 18);
        sun.castShadow = true;
        sun.shadow.bias = -0.0004;
        sun.shadow.normalBias = 0.02;
        const sc = sun.shadow.camera;
        sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
        scene.add(sun);
        scene.add(sun.target);
        this.sun = sun;

        const rim = new THREE.DirectionalLight(0xff8a00, 1.6);
        rim.position.set(16, 10, -20);
        scene.add(rim);

        // Light following the newest cannonball (always present so the shader never recompiles)
        this.ballLight = new THREE.PointLight(0xff9d1a, 0, 14, 1.6);
        scene.add(this.ballLight);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x0d0c0a, roughness: 0.92, metalness: 0 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
        this.ground = ground;

        const grid = new THREE.GridHelper(240, 240, 0x4a3000, 0x1d1608);
        grid.position.y = 0.003;
        grid.material.transparent = true;
        grid.material.opacity = 0.7;
        scene.add(grid);

        // Blocks: one instanced draw
        const geo = new RoundedBoxGeometry(0.97, 0.97, 0.97, 3, 0.11);
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.06 });
        this.blockMesh = new THREE.InstancedMesh(geo, mat, 1);
        this.blockMesh.castShadow = true;
        this.blockMesh.receiveShadow = true;
        scene.add(this.blockMesh);

        // Cannonballs: HDR emissive so they feed the bloom, like Surge's glowing albedo > 1
        const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 28, 18);
        const ballMat = new THREE.MeshStandardMaterial({ color: 0x1a1000, emissive: 0xff9500, emissiveIntensity: 2.6, roughness: 0.3 });
        this.ballMesh = new THREE.InstancedMesh(ballGeo, ballMat, MAX_BALLS);
        this.ballMesh.castShadow = true;
        this.ballMesh.count = 0;
        this.ballMesh.frustumCulled = false;
        scene.add(this.ballMesh);

        this.composer = null;
    }

    _initPhysics()
    {
        const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
        world.broadphase = new CANNON.SAPBroadphase(world);
        world.allowSleep = true;
        world.solver.iterations = this.quality.iterations;
        world.defaultContactMaterial.friction = 0.55;
        world.defaultContactMaterial.restitution = 0.08;
        world.defaultContactMaterial.contactEquationStiffness = 5e7;
        world.defaultContactMaterial.contactEquationRelaxation = 4;

        const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
        ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(ground);

        this.blockShape = new CANNON.Box(new CANNON.Vec3(BLOCK_HALF, BLOCK_HALF, BLOCK_HALF));
        this.ballShape = new CANNON.Sphere(BALL_RADIUS);

        this.pusher = new CANNON.Body({ type: CANNON.Body.KINEMATIC, shape: new CANNON.Sphere(0.85) });
        this.pusher.allowSleep = false;
        this.pusher.position.set(0, -50, 0);
        world.addBody(this.pusher);

        this.world = world;
        this.blocks = [];
        this.balls = [];
        this.groups = new Map();
        this.pendingWakes = [];
        this.physicsTime = 0;
    }

    _initSparks()
    {
        const geo = new THREE.BufferGeometry();
        this.sparkPos = new Float32Array(MAX_SPARKS * 3).fill(-1000);
        this.sparkCol = new Float32Array(MAX_SPARKS * 3);
        this.sparkVel = new Float32Array(MAX_SPARKS * 3);
        this.sparkLife = new Float32Array(MAX_SPARKS);
        this.sparkCursor = 0;
        geo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('color', new THREE.BufferAttribute(this.sparkCol, 3).setUsage(THREE.DynamicDrawUsage));
        const mat = new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
        this.sparks = new THREE.Points(geo, mat);
        this.sparks.frustumCulled = false;
        this.scene.add(this.sparks);
    }

    _initInput()
    {
        const c = this.canvas;
        this.raycaster = new THREE.Raycaster();
        let down = null;

        const toNdc = (e) =>
        {
            const r = c.getBoundingClientRect();
            this.pointer.x = (e.clientX - r.left) / r.width;
            this.pointer.y = (e.clientY - r.top) / r.height;
            this.pointer.ndc.set(this.pointer.x * 2 - 1, -(this.pointer.y * 2 - 1));
            return r;
        };

        window.addEventListener('pointermove', (e) =>
        {
            if (!this.running || e.pointerType !== 'mouse')
                return;
            const r = toNdc(e);
            const overUi = e.target.closest?.('[data-ui], a, button');
            const inside = !overUi && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
            if (inside && !this.pointer.inside)
                this.pointer.teleport = true;
            this.pointer.inside = inside;
            this.pointer.hasMoved = true;
        }, { passive: true });

        c.addEventListener('pointerleave', () => { this.pointer.inside = false; });

        c.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
        c.addEventListener('pointerup', (e) =>
        {
            if (!down)
                return;
            const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
            const quick = performance.now() - down.t < 600;
            down = null;
            if (moved < 12 && quick && !e.target.closest('[data-ui]'))
            {
                toNdc(e);
                this.fireAt(this.pointer.ndc);
            }
        });
    }

    // --- Layout / blocks ----------------------------------------------------------------

    build()
    {
        const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight) || 1.6;
        this.layout = this.opts.layout(this.qualityName, aspect);
        const defs = this.layout.blocks;

        for (const b of this.blocks)
            this.world.removeBody(b.body);
        this.blocks = [];
        this.groups.clear();
        this.pendingWakes.length = 0;
        this.clearBalls();

        if (this.blockMesh.instanceMatrix.count < defs.length)
        {
            const old = this.blockMesh;
            this.blockMesh = new THREE.InstancedMesh(old.geometry, old.material, Math.ceil(defs.length * 1.2));
            this.blockMesh.castShadow = true;
            this.blockMesh.receiveShadow = true;
            this.scene.remove(old);
            old.dispose();
            this.scene.add(this.blockMesh);
        }
        this.blockMesh.count = defs.length;

        defs.forEach((d, i) =>
        {
            const body = new CANNON.Body({ mass: 1, shape: this.blockShape, linearDamping: 0.04, angularDamping: 0.08 });
            body.allowSleep = true;
            body.sleepSpeedLimit = 0.25;
            body.sleepTimeLimit = 0.4;
            const home = new CANNON.Vec3(d.x, d.y, d.z);
            this._place(body, home, new CANNON.Quaternion());
            this.world.addBody(body);
            body.sleep();

            const block = { body, home, group: d.group ?? 0, index: i };
            body.addEventListener('wakeup', () => this._onWake(block));
            this.blocks.push(block);

            if (!this.groups.has(block.group))
                this.groups.set(block.group, { blocks: [], awake: false });
            this.groups.get(block.group).blocks.push(block);

            tmpColor.set(d.color);
            this.blockMesh.setColorAt(i, tmpColor);
        });
        this.blockMesh.instanceColor.needsUpdate = true;
        this._writeBlockMatrices();

        const t = this.layout.target;
        this.sun.target.position.copy(t);
        this.sun.position.set(t.x - 14, 26, t.z + 18);
        this.resize();
    }

    _place(body, pos, quat)
    {
        body.position.copy(pos);
        body.previousPosition.copy(pos);
        body.interpolatedPosition.copy(pos);
        body.quaternion.copy(quat);
        body.previousQuaternion.copy(quat);
        body.interpolatedQuaternion.copy(quat);
        body.velocity.setZero();
        body.angularVelocity.setZero();
        body.aabbNeedsUpdate = true;
    }

    _onWake(block)
    {
        const group = this.groups.get(block.group);
        if (!group || group.awake || this.assembling)
            return;
        group.awake = true;
        // A woken block wakes the rest of its group a moment later so unsupported blocks fall too
        this.pendingWakes.push({ group, at: this.physicsTime + 0.06 });
    }

    rebuild()
    {
        if (this.assembling || !this.blocks.length)
            return;
        this.clearBalls();
        const minX = Math.min(...this.blocks.map(b => b.home.x));
        const now = this.physicsTime;
        this.assembling = { start: now, items: [] };
        for (const b of this.blocks)
        {
            const body = b.body;
            const from = body.interpolatedPosition.clone();
            const fromQ = body.interpolatedQuaternion.clone();
            body.type = CANNON.Body.STATIC;
            body.mass = 0;
            body.updateMassProperties();
            body.collisionResponse = false;
            body.velocity.setZero();
            body.angularVelocity.setZero();
            const delay = (b.home.x - minX) * 0.018 + b.home.y * 0.012 + Math.random() * 0.12;
            this.assembling.items.push({ b, from, fromQ, delay, dur: 0.75 + Math.random() * 0.2 });
        }
        this.assembling.end = now + Math.max(...this.assembling.items.map(i => i.delay + i.dur));
    }

    _updateAssembly()
    {
        const a = this.assembling;
        const t = this.physicsTime - a.start;
        const q = new CANNON.Quaternion();
        const p = new CANNON.Vec3();
        for (const it of a.items)
        {
            const k = easeInOutCubic(Math.min(1, Math.max(0, (t - it.delay) / it.dur)));
            it.from.lerp(it.b.home, k, p);
            p.y += Math.sin(k * Math.PI) * 2.2;
            it.fromQ.slerp(q.set(0, 0, 0, 1), k, q);
            this._place(it.b.body, p, q);
        }
        if (this.physicsTime >= a.end)
        {
            for (const it of a.items)
            {
                const body = it.b.body;
                this._place(body, it.b.home, new CANNON.Quaternion());
                body.type = CANNON.Body.DYNAMIC;
                body.mass = 1;
                body.updateMassProperties();
                body.collisionResponse = true;
                body.sleep();
            }
            for (const g of this.groups.values())
                g.awake = false;
            this.pendingWakes.length = 0;
            this.assembling = null;
        }
    }

    displacedRatio()
    {
        let n = 0;
        for (const b of this.blocks)
            if (b.body.position.distanceTo(b.home) > 0.6)
                n++;
        return this.blocks.length ? n / this.blocks.length : 0;
    }

    // --- Cannonballs ---------------------------------------------------------------------

    clearBalls()
    {
        for (const ball of this.balls)
            this.world.removeBody(ball.body);
        this.balls = [];
        this.ballMesh.count = 0;
        this.ballLight.intensity = 0;
    }

    fireAt(ndc, speed = 40)
    {
        if (this.assembling)
            return;
        this.lastInteraction = this.physicsTime;
        this.raycaster.setFromCamera(ndc, this.camera);
        const hits = this.raycaster.intersectObjects([this.blockMesh, this.ground], false);
        const target = hits.length ? hits[0].point : this.raycaster.ray.at(40, tmpVec).clone();
        this.fireTo(target, speed);
    }

    fireTo(target, speed = 40)
    {
        if (this.assembling)
            return;
        this.lastInteraction = this.physicsTime;
        const origin = this.camera.position.clone();
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
        origin.addScaledVector(right, (Math.random() - 0.5) * 1.5);
        origin.y -= 1.2;
        const dir = target.clone().sub(origin).normalize();
        origin.addScaledVector(dir, 3);
        // Ballistic aim: reach the target in dist / speed seconds despite gravity
        const delta = target.clone().sub(origin);
        const T = Math.max(0.25, delta.length() / speed);
        const vel = delta.multiplyScalar(1 / T);
        vel.y -= 0.5 * this.world.gravity.y * T;

        let ball;
        if (this.balls.length >= MAX_BALLS)
        {
            ball = this.balls.shift();
            this.world.removeBody(ball.body);
        }
        else
        {
            const body = new CANNON.Body({ mass: 7, shape: this.ballShape, linearDamping: 0.01, angularDamping: 0.2 });
            body.allowSleep = true;
            body.sleepSpeedLimit = 0.3;
            ball = { body, born: 0 };
            body.addEventListener('collide', (e) =>
            {
                const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
                if (v < 5)
                    return;
                const c = e.contact;
                const p = c.bi === body ? c.bi.position.vadd(c.ri) : c.bj.position.vadd(c.rj);
                this.emitSparks(p, Math.min(40, Math.floor(v * 0.9)), v * 0.25);
            });
        }
        this._place(ball.body, origin, new CANNON.Quaternion());
        ball.body.velocity.set(vel.x, vel.y, vel.z);
        ball.body.angularVelocity.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
        ball.born = this.physicsTime;
        this.world.addBody(ball.body);
        ball.body.wakeUp();
        this.balls.push(ball);
        this.ballMesh.count = this.balls.length;
        this.ballLight.intensity = 0;
    }

    barrage(count = 8, spread = 6)
    {
        const t = this.layout.target;
        for (let i = 0; i < count; i++)
        {
            setTimeout(() =>
            {
                const p = new THREE.Vector3(t.x + (Math.random() - 0.5) * spread, 1 + Math.random() * (this.layout.size.h * 0.7), t.z + (Math.random() - 0.5) * spread * 0.5);
                this.fireTo(p, 38 + Math.random() * 8);
            }, i * 110);
        }
    }

    // --- Sparks ----------------------------------------------------------------------------

    emitSparks(p, count, power)
    {
        for (let i = 0; i < count; i++)
        {
            const k = this.sparkCursor;
            this.sparkCursor = (this.sparkCursor + 1) % MAX_SPARKS;
            this.sparkPos[k * 3] = p.x; this.sparkPos[k * 3 + 1] = p.y; this.sparkPos[k * 3 + 2] = p.z;
            const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
            const s = power * (0.4 + Math.random() * 0.8);
            this.sparkVel[k * 3] = Math.sin(ph) * Math.cos(th) * s;
            this.sparkVel[k * 3 + 1] = Math.abs(Math.cos(ph)) * s + 2;
            this.sparkVel[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
            this.sparkLife[k] = 0.5 + Math.random() * 0.6;
        }
    }

    _updateSparks(dt)
    {
        const pos = this.sparkPos, vel = this.sparkVel, col = this.sparkCol, life = this.sparkLife;
        for (let i = 0; i < MAX_SPARKS; i++)
        {
            if (life[i] <= 0)
                continue;
            life[i] -= dt;
            const j = i * 3;
            if (life[i] <= 0)
            {
                pos[j + 1] = -1000;
                col[j] = col[j + 1] = col[j + 2] = 0;
                continue;
            }
            vel[j + 1] -= 18 * dt;
            pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
            if (pos[j + 1] < 0.05) { pos[j + 1] = 0.05; vel[j + 1] *= -0.35; vel[j] *= 0.7; vel[j + 2] *= 0.7; }
            const l = Math.min(1, life[i] * 1.6);
            col[j] = 3.0 * l; col[j + 1] = 1.55 * l * l; col[j + 2] = 0.25 * l * l * l;
        }
        this.sparks.geometry.attributes.position.needsUpdate = true;
        this.sparks.geometry.attributes.color.needsUpdate = true;
    }

    // --- Quality / sizing ------------------------------------------------------------------

    setQuality(name)
    {
        if (!QUALITY[name] || name === this.qualityName)
            return;
        this.qualityName = name;
        this.quality = QUALITY[name];
        this.world.solver.iterations = this.quality.iterations;
        this.build();
    }

    resize()
    {
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        if (!w || !h)
            return;
        const q = this.quality;
        const dpr = Math.min(window.devicePixelRatio || 1, 2) * q.renderScale;
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h, false);

        if (this.sun.shadow.mapSize.x !== q.shadowMap)
        {
            this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
        }

        if (q.bloom)
        {
            if (!this.composer)
            {
                this.composer = new EffectComposer(this.renderer);
                this.composer.addPass(new RenderPass(this.scene, this.camera));
                this.bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.4, 1.0);
                this.composer.addPass(this.bloom);
                this.composer.addPass(new OutputPass());
            }
            this.composer.setPixelRatio(dpr);
            this.composer.setSize(w, h);
        }

        this.camera.aspect = w / h;
        this.camera.fov = this.layout.view.fov;
        this.camera.updateProjectionMatrix();

        // Fit the layout's bounds
        const vFov = THREE.MathUtils.degToRad(this.camera.fov);
        const fitH = (this.layout.size.h * 0.5) / Math.tan(vFov / 2);
        const fitW = (this.layout.size.w * 0.5) / (Math.tan(vFov / 2) * this.camera.aspect);
        this.camDistance = Math.max(fitH, fitW) * (this.layout.view.margin ?? 1.15);
        this.scene.fog.near = this.camDistance * 0.85;
        this.scene.fog.far = this.camDistance * 2.3;
        this.camera.far = this.camDistance * 4;
        this.camera.updateProjectionMatrix();

        // Rebuild the letters when the aspect flips between portrait and landscape layouts
        const aspectKey = this.opts.layoutKey ? this.opts.layoutKey(w / h) : null;
        if (aspectKey !== null && this._aspectKey !== undefined && aspectKey !== this._aspectKey)
        {
            this._aspectKey = aspectKey;
            this.build();
            return;
        }
        this._aspectKey = aspectKey;

        this._updateCamera(0);
        if (!this.running)
            this._render();
    }

    _updateCamera(time)
    {
        const v = this.layout.view;
        const t = this.layout.target;
        const sway = this.reducedMotion ? 0 : 1;
        const orbit = (v.orbit ?? 0) * sway;
        const yaw = (v.yaw ?? 0) + Math.sin(time * 0.12) * 0.06 * sway + orbit * time + (this.pointer.inside ? (this.pointer.x - 0.5) * 0.12 : 0);
        const pitch = (v.pitch ?? 0.18) + (this.pointer.inside ? (this.pointer.y - 0.5) * 0.05 : 0) + Math.sin(time * 0.17) * 0.015 * sway;
        const d = this.camDistance;
        this.camera.position.set(t.x + Math.sin(yaw) * Math.cos(pitch) * d, t.y + Math.sin(pitch) * d, t.z + Math.cos(yaw) * Math.cos(pitch) * d);
        this.camera.lookAt(t.x, t.y + (v.lookOffsetY ?? 0), t.z);
        this.camera.updateMatrixWorld();
    }

    // --- Loop ------------------------------------------------------------------------------

    _updateRunning()
    {
        const should = this.visible && !document.hidden;
        if (should === this.running)
            return;
        this.running = should;
        if (should)
        {
            this.clock.start();
            requestAnimationFrame(this._loop);
        }
        else
        {
            this.clock.stop();
            this.pointer.inside = false;
        }
    }

    _updatePusher(dt)
    {
        const p = this.pusher;
        if (!this.opts.hover || !this.pointer.inside || !this.pointer.hasMoved || this.assembling)
        {
            if (p.position.y > -40)
            {
                p.position.set(0, -50, 0);
                p.velocity.setZero();
            }
            return;
        }
        this.raycaster.setFromCamera(this.pointer.ndc, this.camera);
        const ray = this.raycaster.ray;
        // Pointer plane through the blocks' center, facing the camera
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.layout.target.z);
        if (!ray.intersectPlane(plane, tmpVec) || tmpVec.y < 0.3)
            tmpVec.y = Math.max(0.3, tmpVec.y || 0.3);
        if (this.pointer.teleport || p.position.y < -40)
        {
            p.position.set(tmpVec.x, tmpVec.y, tmpVec.z);
            p.velocity.setZero();
            this.pointer.teleport = false;
            return;
        }
        const max = 28;
        let vx = (tmpVec.x - p.position.x) / Math.max(dt, FIXED_STEP), vy = (tmpVec.y - p.position.y) / Math.max(dt, FIXED_STEP), vz = (tmpVec.z - p.position.z) / Math.max(dt, FIXED_STEP);
        const len = Math.hypot(vx, vy, vz);
        if (len > max) { vx *= max / len; vy *= max / len; vz *= max / len; }
        p.velocity.set(vx, vy, vz);
        if (len > 1.5)
            this.lastInteraction = this.physicsTime;
    }

    _loop()
    {
        if (!this.running)
            return;
        requestAnimationFrame(this._loop);

        const rawDt = Math.min(this.clock.getDelta(), 0.1);
        const dt = rawDt * this.timeScale;
        this.physicsTime += dt;

        this._updatePusher(rawDt);

        for (let i = this.pendingWakes.length - 1; i >= 0; i--)
        {
            const w = this.pendingWakes[i];
            if (this.physicsTime >= w.at)
            {
                for (const b of w.group.blocks)
                    if (b.body.sleepState === CANNON.Body.SLEEPING)
                        b.body.wakeUp();
                this.pendingWakes.splice(i, 1);
            }
        }

        this.world.step(FIXED_STEP, dt, 5);
        if (this.assembling)
            this._updateAssembly();

        this._updateSparks(dt);
        this._writeBlockMatrices();
        this._writeBalls();

        // Idle auto rebuild
        const auto = this.opts.autoRebuild ?? 0;
        if (auto > 0 && !this.assembling && this.physicsTime - this.lastInteraction > auto && this.displacedRatio() > 0.08)
            this.rebuild();

        this._updateCamera(this.clock.elapsedTime);
        this._render();
        this._stats(rawDt);
    }

    _writeBlockMatrices()
    {
        const m = this.blockMesh;
        for (let i = 0; i < this.blocks.length; i++)
        {
            const b = this.blocks[i].body;
            tmpObj.position.copy(b.interpolatedPosition);
            tmpObj.quaternion.copy(b.interpolatedQuaternion);
            tmpObj.updateMatrix();
            m.setMatrixAt(i, tmpObj.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
    }

    _writeBalls()
    {
        const m = this.ballMesh;
        for (let i = 0; i < this.balls.length; i++)
        {
            const b = this.balls[i].body;
            tmpObj.position.copy(b.interpolatedPosition);
            tmpObj.quaternion.copy(b.interpolatedQuaternion);
            tmpObj.updateMatrix();
            m.setMatrixAt(i, tmpObj.matrix);
        }
        m.instanceMatrix.needsUpdate = true;
        if (this.balls.length)
        {
            const last = this.balls[this.balls.length - 1];
            const age = this.physicsTime - last.born;
            this.ballLight.position.copy(last.body.interpolatedPosition);
            this.ballLight.intensity = Math.max(0, 40 * (1 - age / 2.5));
        }
    }

    _render()
    {
        this.renderer.info.reset();
        if (this.quality.bloom && this.composer)
            this.composer.render();
        else
            this.renderer.render(this.scene, this.camera);
    }

    _stats(dt)
    {
        this.frames++;
        this.statTimer += dt;
        if (this.statTimer < 0.25 || !this.opts.onStats)
            return;
        let awake = 0;
        for (const b of this.blocks)
            if (b.body.sleepState !== CANNON.Body.SLEEPING)
                awake++;
        for (const b of this.balls)
            if (b.body.sleepState !== CANNON.Body.SLEEPING)
                awake++;
        const fps = this.frames / this.statTimer;
        const size = this.renderer.getDrawingBufferSize(tmpVec2);
        this.opts.onStats({
            fps, ms: 1000 / fps, awake, bodies: this.blocks.length + this.balls.length,
            calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles,
            instances: this.blocks.length, quality: this.qualityName, width: size.x, height: size.y,
            timeScale: this.timeScale
        });
        this.frames = 0;
        this.statTimer = 0;
    }
}

const tmpVec2 = new THREE.Vector2();

// --- Layouts -------------------------------------------------------------------------------

const GLYPHS = {
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####']
};

const AMBERS = [0xffa500, 0xff9400, 0xffb21f, 0xf08c00, 0xffbe3d, 0xe67e00];

export function wordLayout(lines)
{
    return (quality, aspect) =>
    {
        const rows = aspect < 0.85 ? lines.portrait : lines.landscape;
        const depth = QUALITY[quality].depth;
        const blocks = [];
        const lineH = 7, gap = 2;
        let maxW = 0;
        rows.forEach((word) => { maxW = Math.max(maxW, word.length * 6 - 1); });
        const totalH = rows.length * lineH + (rows.length - 1) * gap;
        let group = 0;
        rows.forEach((word, li) =>
        {
            const w = word.length * 6 - 1;
            const x0 = -w / 2 + 0.5;
            const yBase = totalH - (li + 1) * lineH - li * gap; // bottom of this line
            [...word].forEach((ch, ci) =>
            {
                const g = GLYPHS[ch];
                for (let r = 0; r < 7; r++)
                    for (let c = 0; c < 5; c++)
                    {
                        if (g[r][c] !== '#')
                            continue;
                        for (let z = 0; z < depth; z++)
                        {
                            blocks.push({
                                x: x0 + ci * 6 + c, y: yBase + (6 - r) + 0.5, z: (z - (depth - 1) / 2),
                                color: AMBERS[(r * 7 + c * 3 + ci * 5 + z) % AMBERS.length], group
                            });
                        }
                    }
                group++;
            });
        });
        const portrait = aspect < 0.85;
        return {
            blocks,
            target: new THREE.Vector3(0, totalH / 2, 0),
            size: { w: maxW + 2, h: totalH + 2 },
            view: { fov: 30, pitch: 0.2, margin: portrait ? 1.2 : 1.32, lookOffsetY: portrait ? -totalH * 0.48 : -4 }
        };
    };
}

export function castleLayout()
{
    return (quality) =>
    {
        const big = quality === 'desktop';
        const n = big ? 9 : 7;            // footprint
        const wallH = big ? 4 : 3;
        const towerH = wallH + 2;
        const blocks = [];
        const stone = [0x2a2826, 0x232120, 0x302d2a, 0x1d1c1b];
        const half = (n - 1) / 2;
        const isCorner = (x, z) => (x === 0 || x === n - 1) && (z === 0 || z === n - 1);
        for (let x = 0; x < n; x++)
            for (let z = 0; z < n; z++)
            {
                const edge = x === 0 || z === 0 || x === n - 1 || z === n - 1;
                if (!edge)
                    continue;
                const corner = isCorner(x, z);
                const h = corner ? towerH : wallH;
                for (let y = 0; y < h; y++)
                    blocks.push({ x: x - half, y: y + 0.5, z: z - half, color: corner && y >= wallH ? 0xffa500 : stone[(x * 3 + y * 5 + z * 7) % stone.length] });
                // Crenellations on the walls
                if (!corner && (x + z) % 2 === 0)
                    blocks.push({ x: x - half, y: wallH + 0.5, z: z - half, color: 0xff9400 });
            }
        // Keep in the middle
        const keepH = big ? 7 : 5;
        for (let y = 0; y < keepH; y++)
            for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]])
                blocks.push({ x: dx - 0.5, y: y + 0.5, z: dz - 0.5, color: y === keepH - 1 ? 0xffb21f : stone[(dx + dz + y) % stone.length] });
        return {
            blocks: blocks.map(b => ({ ...b, group: 0 })),
            target: new THREE.Vector3(0, 2.2, 0),
            size: { w: n + 6, h: towerH + 6 },
            view: { fov: 34, pitch: 0.42, yaw: 0.65, orbit: 0.05, margin: 1.05, lookOffsetY: -0.5 }
        };
    };
}
