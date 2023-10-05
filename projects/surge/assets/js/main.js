// Surge website - page behaviour. The 3D stages load lazily so the page works without WebGL.

document.documentElement.classList.add('js');

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(pointer: fine)').matches;

// --- Nav ------------------------------------------------------------------------------------

const nav = $('#nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const toggle = $('#nav-toggle');
const links = $('#nav-links');
toggle.addEventListener('click', () =>
{
    const open = !links.classList.contains('open');
    links.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
});
links.addEventListener('click', (e) =>
{
    if (e.target.closest('a'))
    {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
    }
});

const sectionLinks = new Map($$('.nav-links a').map(a => [a.getAttribute('href').slice(1), a]));
const sectionObserver = new IntersectionObserver((entries) =>
{
    for (const e of entries)
    {
        if (!e.isIntersecting)
            continue;
        $$('.nav-links a.active').forEach(a => a.classList.remove('active'));
        sectionLinks.get(e.target.id)?.classList.add('active');
    }
}, { rootMargin: '-45% 0px -50% 0px' });
sectionLinks.forEach((_, id) => { const el = document.getElementById(id); if (el) sectionObserver.observe(el); });

// --- Reveal ---------------------------------------------------------------------------------

const revealObserver = new IntersectionObserver((entries) =>
{
    for (const e of entries)
    {
        if (!e.isIntersecting)
            continue;
        const siblings = $$('.reveal', e.target.parentElement);
        const delay = Math.min(6, Math.max(0, siblings.indexOf(e.target))) * 70;
        e.target.style.transitionDelay = `${delay}ms`;
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
    }
}, { rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach(el => revealObserver.observe(el));

// --- Budget meters --------------------------------------------------------------------------

const BUDGET = [
    { label: 'Shadow cascades', android: 2, desktop: 3, max: 3, note: { android: 'Each cascade is a full shadow pass', desktop: 'Per-cascade caster culling' } },
    { label: 'Lights per frame', android: 8, desktop: 64, max: 64, note: { android: 'Culled, most relevant first', desktop: 'Forward, culled per frame' } },
    { label: 'Live particles', android: 8, desktop: 128, max: 128, unit: 'k', note: { android: 'SoA pools, allocated once', desktop: 'Radix sort optional' } },
    { label: 'Render scale', android: 0.8, desktop: 1.0, max: 1, unit: '×', decimals: 1, note: { android: 'UI stays at native res', desktop: 'Native resolution' } },
    { label: 'GTAO', android: 'Off', desktop: 'Ultra', bar: { android: 0, desktop: 1 }, note: { android: 'Opt-in: 4 extra passes', desktop: '4 slices × 8 steps, full res' } },
    { label: 'Bloom mips', android: 3, desktop: 8, max: 8, note: { android: 'Fragment path, dual filter', desktop: 'Compute path, anti-flicker' } },
    { label: 'Frames in flight', android: 2, desktop: 2, max: 3, note: { android: 'Mobile default', desktop: 'Same on every platform' } },
    { label: 'Physics step', android: 60, desktop: 60, max: 60, unit: ' Hz', note: { android: 'Fixed, interpolated', desktop: 'Fixed, interpolated' } }
];

const meters = $('#meters');
meters.innerHTML = BUDGET.map((m, i) => `
    <div class="meter" data-i="${i}">
        <span class="meter-label">${m.label}</span>
        <span class="meter-value"></span>
        <span class="meter-note"></span>
        <span class="meter-bar"><i></i></span>
    </div>`).join('');

function animateNumber(el, from, to, decimals, suffix)
{
    if (reducedMotion || from === to)
    {
        el.innerHTML = `${to.toFixed(decimals)}<small>${suffix}</small>`;
        return;
    }
    const start = performance.now();
    const step = (now) =>
    {
        const t = Math.min(1, (now - start) / 650);
        const k = 1 - Math.pow(1 - t, 3);
        el.innerHTML = `${(from + (to - from) * k).toFixed(decimals)}<small>${suffix}</small>`;
        if (t < 1)
            requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

let platform = null;
function setPlatform(p)
{
    if (p === platform)
        return;
    const prev = platform;
    platform = p;
    $$('.budget-switch button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.platform === p)));
    $('.budget-switch').dataset.on = p;
    $$('.meter', meters).forEach((el) =>
    {
        const m = BUDGET[+el.dataset.i];
        const v = m[p];
        const value = $('.meter-value', el);
        if (typeof v === 'number')
            animateNumber(value, prev ? m[prev] : 0, v, m.decimals ?? 0, m.unit ?? '');
        else
            value.textContent = v;
        const fill = m.bar ? m.bar[p] : v / m.max;
        $('.meter-bar i', el).style.width = `${Math.max(2, fill * 100)}%`;
        $('.meter-note', el).textContent = m.note[p];
    });
}
$$('.budget-switch button').forEach(b => b.addEventListener('click', () => setPlatform(b.dataset.platform)));
// Start the meters when they scroll into view
new IntersectionObserver((entries, obs) =>
{
    if (entries[0].isIntersecting)
    {
        setPlatform('android');
        obs.disconnect();
    }
}, { threshold: 0.3 }).observe(meters);

// --- Render graph ---------------------------------------------------------------------------

const GROUPS = [
    { name: 'SHADOW', passes: 'ShadowPass', own: true },
    { name: 'MAIN_SCENE', passes: 'SkyPass, GeometryPass, Renderer2DPass, ParticlePass' },
    { name: 'AMBIENT_OCCLUSION', passes: 'AmbientOcclusionPass', own: true, off: true },
    { name: 'BLOOM', passes: 'BloomPass', own: true },
    { name: 'OUTLINE_MASK', passes: 'OutlinePass', off: true },
    { name: 'POST_PROCESS', passes: 'PostProcessPass' },
    { name: 'UI_OVERLAY', passes: 'UIOverlayPass' },
    { name: 'SWAPCHAIN', passes: 'SwapchainPass', locked: true }
];
const rgNodes = $('#rg-nodes');
rgNodes.innerHTML = GROUPS.map((g, i) => `
    <button class="rg-node ${g.off ? 'off' : 'on'}" data-i="${i}" aria-pressed="${!g.off}" ${g.locked ? 'disabled' : ''}>
        ${g.own ? '<span class="rg-own" title="Manages own execution"></span>' : ''}
        <span class="rg-idx">GROUP ${String(i).padStart(2, '0')}</span>
        <span class="rg-name">${g.name.replace(/_/g, '_<wbr>')}</span>
        <span class="rg-passes">${g.passes.split(', ').join('<br>')}</span>
        <span class="rg-state">${g.off ? 'Skipped' : 'Executes'}</span>
    </button>`).join('');

function updateGraphStats()
{
    const on = GROUPS.filter(g => !g.off).length;
    $('#rg-stats').innerHTML = `Groups executed <b>${on}</b> / ${GROUPS.length} &nbsp;·&nbsp; Skipped <b>${GROUPS.length - on}</b>`;
}
rgNodes.addEventListener('click', (e) =>
{
    const node = e.target.closest('.rg-node');
    if (!node || node.disabled)
        return;
    const g = GROUPS[+node.dataset.i];
    g.off = !g.off;
    node.classList.toggle('off', g.off);
    node.classList.toggle('on', !g.off);
    node.setAttribute('aria-pressed', String(!g.off));
    $('.rg-state', node).textContent = g.off ? 'Skipped' : 'Executes';
    updateGraphStats();
});
updateGraphStats();

// --- Card tilt ------------------------------------------------------------------------------

if (finePointer && !reducedMotion)
{
    $$('[data-tilt]').forEach((card) =>
    {
        card.addEventListener('pointermove', (e) =>
        {
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
            card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
            card.style.setProperty('--rx', `${(0.5 - y) * 10}deg`);
            card.style.setProperty('--mx', `${x * 100}%`);
            card.style.setProperty('--my', `${y * 100}%`);
        });
        card.addEventListener('pointerleave', () =>
        {
            card.style.setProperty('--rx', '0deg');
            card.style.setProperty('--ry', '0deg');
        });
    });
}

// --- Editor screenshot tilt -----------------------------------------------------------------

const shot = $('#editor-shot');
const updateShot = () =>
{
    const r = shot.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.75)));
    shot.style.setProperty('--p', reducedMotion ? 1 : p.toFixed(3));
};
window.addEventListener('scroll', updateShot, { passive: true });
window.addEventListener('resize', updateShot);
updateShot();

// --- Lua code -------------------------------------------------------------------------------

const CODE = {
    cannon: `local State = require("Scripts.Game.State")

Properties = {
    Speed  = Property.Float(6.5, 0, 20, "Meters per second"),
    Impact = Property.Asset("PARTICLE_EFFECT", "Effects/Impact.spfx"),
}

function OnCollisionEnter(entity, other)
    Particles.Play(Properties.Impact, entity.TransformC.Position)
    State.Score = State.Score + 1
end

function OnUpdate(entity, dt)
    if Input.WasKeyPressed(Key.Space) then
        entity.RigidbodyC:AddImpulse(Math.Vec3.new(0, Properties.Speed, 0))
    end
end`,
    hud: `local State = require("Scripts.Game.State")

local score

function OnCreate(entity)
    local canvas = entity.UICanvasC
    score = canvas:FindWidget("Score")

    -- Slider drives the global time scale (physics + script dt)
    canvas:FindWidget("SlowMotion"):OnValueChanged(function(self)
        Time.SetTimeScale(self.Value)
    end)

    canvas:FindWidget("Restart"):OnClick(function(self)
        Scene.Load("Scenes/Toytown.srg")
    end)
end

function OnUpdate(entity, dt)
    score.Text = "SCORE  " .. State.Score
end`,
    save: `-- Scripts/Game/State.lua : a module, shared without _G
local State = { Score = 0, Best = Storage.Load("Best", 0) }

function State.Commit()
    if State.Score > State.Best then
        State.Best = State.Score
        -- Saved to app storage, survives restarts. Save on events, not every frame.
        Storage.Save("Best", State.Best)
    end
end

return State`
};

const KEYWORDS = new Set(['local', 'function', 'end', 'if', 'then', 'else', 'elseif', 'return', 'for', 'in', 'do', 'while', 'repeat', 'until', 'and', 'or', 'not', 'nil', 'true', 'false']);
const GLOBALS = new Set(['Properties', 'Property', 'Particles', 'Input', 'Key', 'Math', 'Time', 'Scene', 'Storage', 'Physics', 'require', 'State']);

function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function highlightLine(line)
{
    const re = /(--.*$)|("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)(\s*\()?|([^A-Za-z0-9_"-]+|-)/g;
    let out = '', m;
    while ((m = re.exec(line)))
    {
        if (m[1]) out += `<span class="tk-c">${escapeHtml(m[1])}</span>`;
        else if (m[2]) out += `<span class="tk-s">${escapeHtml(m[2])}</span>`;
        else if (m[3]) out += `<span class="tk-n">${m[3]}</span>`;
        else if (m[4])
        {
            const w = m[4];
            if (KEYWORDS.has(w)) out += `<span class="tk-k">${w}</span>`;
            else if (GLOBALS.has(w)) out += `<span class="tk-g">${w}</span>`;
            else if (m[5]) out += `<span class="tk-f">${w}</span>`;
            else out += w;
            if (m[5]) out += escapeHtml(m[5]);
        }
        else out += escapeHtml(m[6]);
    }
    return out;
}

let currentFile = 'cannon';
function showCode(file)
{
    currentFile = file;
    $('#code-view').innerHTML = CODE[file].split('\n').map(l => `<span class="ln">${highlightLine(l) || ' '}</span>`).join('');
    $$('.code-tabs [role="tab"]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.file === file)));
}
$$('.code-tabs [role="tab"]').forEach(t => t.addEventListener('click', () => showCode(t.dataset.file)));
showCode('cannon');

// --- Copy buttons ---------------------------------------------------------------------------

async function copyText(text, btn)
{
    try
    {
        await navigator.clipboard.writeText(text);
        const old = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = old; }, 1300);
    }
    catch { /* Clipboard unavailable (insecure context) */ }
}
$('#code-copy').addEventListener('click', (e) => copyText(CODE[currentFile], e.currentTarget));
$$('[data-copy]').forEach(b => b.addEventListener('click', () => copyText(b.previousElementSibling.textContent, b)));

// --- Lightbox -------------------------------------------------------------------------------

const lightbox = $('#lightbox');
const lbImg = $('img', lightbox);
const lbCap = $('p', lightbox);
let lastFocus = null;
$$('.shot button').forEach((b) => b.addEventListener('click', () =>
{
    lastFocus = b;
    lbImg.src = b.dataset.full;
    lbImg.alt = $('img', b).alt;
    lbCap.textContent = b.parentElement.querySelector('figcaption')?.textContent ?? '';
    lightbox.hidden = false;
    $('.lightbox-close', lightbox).focus();
}));
const closeLightbox = () => { lightbox.hidden = true; lastFocus?.focus(); };
lightbox.addEventListener('click', (e) => { if (e.target !== lbImg) closeLightbox(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });

// --- 3D stages ------------------------------------------------------------------------------

function webglAvailable()
{
    try
    {
        const c = document.createElement('canvas');
        return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
    }
    catch { return false; }
}

async function initStages()
{
    if (!webglAvailable())
        throw new Error('WebGL2 unavailable');

    const { Stage, wordLayout, castleLayout, detectQuality } = await import('./stage.js');
    const quality = detectQuality();

    // Hero ------------------------------------------------------------------------------
    const hud = $('#hud');
    const statEls = { fps: $('#s-fps'), ms: $('#s-ms'), res: $('#s-res'), calls: $('#s-calls'), inst: $('#s-inst'), tris: $('#s-tris'), awake: $('#s-awake'), mini: $('#s-mini') };
    const hero = new Stage({
        canvas: $('#hero-canvas'),
        quality,
        hover: true,
        autoRebuild: 9,
        layout: wordLayout({ landscape: ['SURGE'], portrait: ['SUR', 'GE'] }),
        layoutKey: (aspect) => aspect < 0.85,
        onStats: (s) =>
        {
            statEls.fps.textContent = s.fps.toFixed(0);
            statEls.ms.textContent = `${s.ms.toFixed(2)} ms`;
            statEls.res.textContent = `${s.width} × ${s.height}`;
            statEls.calls.textContent = s.calls;
            statEls.inst.textContent = `${s.instances} blocks`;
            statEls.tris.textContent = s.tris >= 1000 ? `${(s.tris / 1000).toFixed(1)}k` : s.tris;
            statEls.awake.textContent = `${s.awake} / ${s.bodies}`;
            statEls.mini.textContent = `${s.fps.toFixed(0)} FPS`;
        }
    });

    const setHeroQuality = (q) =>
    {
        hero.setQuality(q);
        $$('.seg button', hud).forEach(b => b.classList.toggle('on', b.dataset.quality === q));
    };
    $$('.seg button', hud).forEach(b => b.addEventListener('click', () => setHeroQuality(b.dataset.quality)));
    setHeroQuality(quality);

    $('#hero-fire').addEventListener('click', () => hero.barrage(3, 18));
    $('#hero-rebuild').addEventListener('click', () => hero.rebuild());

    const hudToggle = $('#hud-toggle');
    const setHudCollapsed = (c) => { hud.classList.toggle('collapsed', c); hudToggle.setAttribute('aria-expanded', String(!c)); };
    hudToggle.addEventListener('click', () => setHudCollapsed(!hud.classList.contains('collapsed')));
    setHudCollapsed(window.innerWidth < 900);

    if (!finePointer)
        $('#hero-hint').innerHTML = '<kbd>Tap</kbd> the blocks to fire <span>·</span> they rebuild on their own';

    window.addEventListener('keydown', (e) =>
    {
        if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey)
            return;
        if (e.key === 'r' || e.key === 'R')
        {
            hero.rebuild();
            castle?.rebuild();
        }
    });

    // Castle ----------------------------------------------------------------------------
    const castleStats = $('#castle-stats');
    const castle = new Stage({
        canvas: $('#castle-canvas'),
        quality,
        hover: false,
        autoRebuild: 0,
        layout: castleLayout(),
        onStats: (s) => { castleStats.textContent = `${s.fps.toFixed(0)} FPS · ${s.awake}/${s.bodies} awake · ${s.calls} draw calls · ${s.timeScale.toFixed(2)}×`; }
    });

    const ts = $('#castle-timescale');
    const tsLabel = $('#castle-ts');
    const slowBtn = $('#castle-slowmo');
    const setTimeScale = (v) =>
    {
        castle.timeScale = v;
        ts.value = v;
        ts.style.setProperty('--fill', `${((v - 0.1) / 0.9) * 100}%`);
        tsLabel.textContent = `${v.toFixed(2)}×`;
        slowBtn.classList.toggle('active', v < 0.99);
    };
    ts.addEventListener('input', () => setTimeScale(parseFloat(ts.value)));
    slowBtn.addEventListener('click', () => setTimeScale(castle.timeScale < 0.99 ? 1 : 0.25));
    $('#castle-fire').addEventListener('click', () => castle.barrage(1, 3));
    $('#castle-barrage').addEventListener('click', () => castle.barrage(8, 9));
    $('#castle-reset').addEventListener('click', () => castle.rebuild());
    setTimeScale(1);
}

initStages().catch((err) =>
{
    console.warn('[Surge] 3D disabled:', err);
    document.documentElement.classList.add('no-webgl');
    $('#hud').hidden = true;
    $('#hero-hint').hidden = true;
    $('.playground')?.classList.add('no-3d');
    const view = $('.playground-view');
    if (view)
        view.innerHTML = '<img src="assets/img/Player-RuntimeToon2.webp" alt="Toytown physics playground in Surge" style="width:100%;height:100%;object-fit:cover">';
    $('.playground-panel')?.remove();
});
