// Shared site layer: nav, footer, page transitions, reveal, content loading, Markdown and covers.
// Every page sets <html data-root="..."> to the relative path of the site root ("" or "../").

export const ROOT = document.documentElement.dataset.root || '';
document.documentElement.classList.add('js');

// Main navigation. Add a page here and it shows up everywhere.
export const NAV = [
    { label: 'Projects', href: 'projects/' },
    { label: 'Blog', href: 'blog/' },
    { label: 'Resume', href: 'resume/' },
    { label: 'Contact', href: 'index.html#contact' }
];

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = window.matchMedia('(pointer: fine)').matches;
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Resolve a root-relative content path ("assets/...", "projects/...") for the current page
export function url(path)
{
    if (!path)
        return '';
    if (/^(https?:|mailto:|tel:|#|\/|data:)/.test(path))
        return path;
    return ROOT + path;
}

export function esc(s)
{
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const jsonCache = new Map();
export function getJSON(path)
{
    if (!jsonCache.has(path))
        jsonCache.set(path, fetch(url(path), { cache: 'no-cache' }).then((r) =>
        {
            if (!r.ok)
                throw new Error(`${path}: ${r.status}`);
            return r.json();
        }));
    return jsonCache.get(path);
}

export async function getText(path)
{
    const r = await fetch(url(path), { cache: 'no-cache' });
    if (!r.ok)
        throw new Error(`${path}: ${r.status}`);
    return r.text();
}

export const getProfile = () => getJSON('content/profile.json');
export const getProjects = () => getJSON('content/projects.json');
export const getPosts = async () => (await getJSON('content/posts.json')).filter(p => !p.draft).sort((a, b) => b.date.localeCompare(a.date));
export const getResume = () => getJSON('content/resume.json');

// Where a project card leads: its own site, an external page, or the generic project page
export function projectHref(p)
{
    if (p.page)
        return url(p.page);
    if (p.external)
        return p.external;
    return url(`projects/project.html?id=${encodeURIComponent(p.slug)}`);
}

export function formatDate(iso, opts = { year: 'numeric', month: 'short', day: '2-digit' })
{
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-GB', opts);
}

// --- Generative covers --------------------------------------------------------------------------

function hash(str)
{
    let h = 2166136261;
    for (let i = 0; i < str.length; i++)
        h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
}

export function initials(title)
{
    const caps = title.replace(/[^A-Za-z0-9 ]/g, ' ').match(/[A-Z0-9]/g);
    if (caps && caps.length >= 2)
        return caps.slice(0, 2).join('');
    return title.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
}

// A voxel pattern unique to the project, for projects without a screenshot
export function generativeCover(seed, title, label = '')
{
    let s = hash(seed);
    const rand = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const cols = 16, rows = 10, c = 40;
    const ox = rand(), oy = rand(), freq = 0.15 + rand() * 0.25, mode = Math.floor(rand() * 3);
    const ambers = ['#ffa500', '#ff9100', '#ffb733', '#e88a00', '#ffc85a'];
    let cells = '';
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
        {
            const wave = mode === 0 ? Math.sin((x + ox * 10) * freq * 2) * Math.cos((y + oy * 10) * freq * 2)
                : mode === 1 ? Math.sin((x * 0.7 + y) * freq * 1.6 + ox * 6)
                    : Math.cos(Math.hypot(x - cols * ox, y - rows * oy) * freq * 2.2);
            const v = wave * 0.55 + (x / cols) * 0.5 + rand() * 0.35;
            if (v > 0.62)
                cells += `<rect x="${x * c + 2}" y="${y * c + 2}" width="${c - 4}" height="${c - 4}" fill="${ambers[Math.floor(rand() * ambers.length)]}" opacity="${(0.55 + rand() * 0.45).toFixed(2)}"/>`;
            else if (v > 0.35)
                cells += `<rect x="${x * c + 2}" y="${y * c + 2}" width="${c - 4}" height="${c - 4}" fill="#2a231a"/>`;
            else if (rand() < 0.05)
                cells += `<rect x="${x * c + 14}" y="${y * c + 14}" width="12" height="12" fill="#ffa500" opacity=".5"/>`;
        }
    return `<svg class="gen-cover" viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(title)}">
        <rect width="640" height="400" fill="#110d08"/>${cells}
        <rect x="24" y="268" width="132" height="108" fill="#ffa500"/>
        <text x="90" y="340" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="52" fill="#120c02">${esc(initials(title))}</text>
        <text x="28" y="44" font-family="JetBrains Mono, monospace" font-size="15" fill="#efe8dc" opacity=".85">${esc(label.toLowerCase())}/</text>
    </svg>`;
}

export function coverHTML(p, cls = '')
{
    if (p.cover)
        return `<img class="${cls}" src="${esc(url(p.cover))}" alt="${esc(p.title)}" loading="lazy" decoding="async">`;
    return generativeCover(p.slug, p.title, p.category || 'project');
}

// --- Markdown -------------------------------------------------------------------------------------

let mdTools = null;
async function loadMarkdown()
{
    if (mdTools)
        return mdTools;
    const [{ marked }, hljsMod, cpp, lua, matlab, glsl, csharp, bash, json] = await Promise.all([
        import('marked'), import('hljs/core.min.js'),
        import('hljs/languages/cpp.min.js'), import('hljs/languages/lua.min.js'), import('hljs/languages/matlab.min.js'),
        import('hljs/languages/glsl.min.js'), import('hljs/languages/csharp.min.js'), import('hljs/languages/bash.min.js'),
        import('hljs/languages/json.min.js')
    ]);
    const hljs = hljsMod.default;
    hljs.registerLanguage('cpp', cpp.default);
    hljs.registerLanguage('c', cpp.default);
    hljs.registerLanguage('lua', lua.default);
    hljs.registerLanguage('matlab', matlab.default);
    hljs.registerLanguage('glsl', glsl.default);
    hljs.registerLanguage('csharp', csharp.default);
    hljs.registerLanguage('bash', bash.default);
    hljs.registerLanguage('json', json.default);
    mdTools = { marked, hljs };
    return mdTools;
}

// README of a GitHub repo as { text, raw, blob }: raw and blob are the URLs its relative images and links
// resolve against. null when the repo has no README. Cached per tab, since the API allows 60 calls/hour.
export async function getReadme(repo)
{
    const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(repo || '');
    if (!m)
        return null;
    const name = `${m[1]}/${m[2].replace(/\.git$/, '')}`;
    try
    {
        const hit = sessionStorage.getItem(`readme:${name}`);
        if (hit)
            return JSON.parse(hit);
    }
    catch (e) {}
    const r = await fetch(`https://api.github.com/repos/${name}/readme`);
    if (r.status === 404)
        return null;
    if (!r.ok)
        throw new Error(`${name} README: ${r.status}`);
    const j = await r.json();
    const bytes = Uint8Array.from(atob(j.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    const readme = { text: new TextDecoder().decode(bytes), raw: j.download_url, blob: j.html_url };
    try { sessionStorage.setItem(`readme:${name}`, JSON.stringify(readme)); } catch (e) {}
    return readme;
}

const EMOJI = { heavy_check_mark: '✔️', white_check_mark: '✅', x: '❌', warning: '⚠️', construction: '🚧' };

// Paths inside Markdown are relative to the site root, like everywhere else in content/.
// For a README pass base (from getReadme) so they point back into the repo, and dropTitle to skip its # Title.
export async function renderMarkdown(text, { base, dropTitle = false } = {})
{
    const { marked, hljs } = await loadMarkdown();
    const box = document.createElement('div');
    box.innerHTML = marked.parse(text.replace(/^﻿/, ''), { gfm: true });
    const resolve = (h, dir) => base ? new URL(h, dir).href : url(h);
    $$('img', box).forEach((img) =>
    {
        img.src = resolve(img.getAttribute('src'), base?.raw);
        img.loading = 'lazy';
        img.decoding = 'async';
    });
    if (base)
        $$('source[srcset]', box).forEach(s => { s.srcset = resolve(s.getAttribute('srcset'), base.raw); });
    $$('a[href]', box).forEach((a) =>
    {
        const h = a.getAttribute('href');
        if (h.startsWith('#'))
            return;
        a.href = resolve(h, base?.blob);
        if (/^https?:/.test(a.getAttribute('href')))
        {
            a.target = '_blank';
            a.rel = 'noopener';
        }
    });
    // GitHub emoji shortcodes, outside code
    const walk = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n; (n = walk.nextNode());)
        if (!n.parentElement.closest('pre, code'))
            n.textContent = n.textContent.replace(/:([a-z_]+):/g, (s, k) => EMOJI[k] || s);
    if (dropTitle)
        $('h1', box)?.remove();
    // The page title is the only h1: demote headings inside the article
    if ($('h1', box))
        for (let lvl = 5; lvl >= 1; lvl--)
            $$(`h${lvl}`, box).forEach((h) =>
            {
                const n = document.createElement(`h${lvl + 1}`);
                n.innerHTML = h.innerHTML;
                h.replaceWith(n);
            });
    $$('pre code', box).forEach((c) =>
    {
        const lang = (c.className.match(/language-([\w+#-]+)/) || [])[1];
        const map = { 'c++': 'cpp', 'hpp': 'cpp', 'cs': 'csharp', 'c#': 'csharp', 'sh': 'bash' };
        const l = map[lang] || lang;
        if (l && hljs.getLanguage(l))
            c.innerHTML = hljs.highlight(c.textContent, { language: l }).value;
        else
            c.innerHTML = hljs.highlightAuto(c.textContent).value;
        c.parentElement.classList.add('code-block');
    });
    $$('table', box).forEach((t) =>
    {
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        t.replaceWith(wrap);
        wrap.appendChild(t);
    });
    return box;
}

// --- 3D world -------------------------------------------------------------------------------------

export function webglAvailable()
{
    try
    {
        return !!(window.WebGL2RenderingContext && document.createElement('canvas').getContext('webgl2'));
    }
    catch { return false; }
}

// Starts the voxel background. Returns the world, or null when WebGL2 or the CDN is unavailable.
export async function startWorld({ shape = 'planet', layout = {}, text, onStats } = {})
{
    const canvas = $('#world');
    if (!canvas || !webglAvailable())
    {
        document.documentElement.classList.add('no-webgl');
        return null;
    }
    try
    {
        const { VoxelWorld } = await import('./world.js');
        const world = new VoxelWorld(canvas, { text, onStats });
        await world.setShape(shape, layout);
        world.start();
        requestAnimationFrame(() => canvas.classList.add('ready'));
        return world;
    }
    catch (err)
    {
        console.warn('[site] 3D disabled:', err);
        document.documentElement.classList.add('no-webgl');
        return null;
    }
}

// --- Chrome ---------------------------------------------------------------------------------------

function currentSection()
{
    const path = location.pathname;
    for (const n of NAV)
    {
        const seg = n.href.split('/')[0];
        if (n.href.endsWith('/') && path.includes(`/${seg}/`))
            return n.href;
    }
    return null;
}

async function renderNav()
{
    const host = $('[data-nav]');
    if (!host)
        return;
    const active = currentSection();
    host.innerHTML = `
        <a class="brand" href="${url('index.html')}" aria-label="Home">
            <img src="${url('assets/img/mark.png')}" alt="" width="26" height="26">
            <span class="brand-name">FAHIM FUAD</span>
            <span class="brand-handle">/ridhwandll</span>
        </a>
        <nav class="nav-links" id="nav-links" aria-label="Main">
            ${NAV.map((n) => `<a href="${url(n.href)}"${n.href === active ? ' class="active" aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}
        </nav>
        <button class="nav-toggle" id="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav-links"><span></span><span></span></button>`;
    const toggle = $('#nav-toggle'), links = $('#nav-links');
    toggle.addEventListener('click', () =>
    {
        const open = !links.classList.contains('open');
        links.classList.toggle('open', open);
        host.classList.toggle('menu-open', open);
        toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', () =>
    {
        links.classList.remove('open');
        host.classList.remove('menu-open');
        toggle.setAttribute('aria-expanded', 'false');
    });
    const onScroll = () => host.classList.toggle('scrolled', window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
}

async function renderFooter()
{
    const host = $('[data-footer]');
    if (!host)
        return;
    let profile = null;
    try { profile = await getProfile(); } catch { /* offline file:// preview */ }
    const socials = profile?.socials ?? [];
    const lm = new Date(document.lastModified);
    const updated = isNaN(lm) ? '' : lm.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    host.innerHTML = `
        <div class="wrap footer-inner">
            <div class="footer-brand">
                <img src="${url('assets/img/mark.png')}" alt="" width="34" height="34" loading="lazy">
                <div><b>${esc(profile?.name ?? 'Fahim Fuad')}</b><span>${esc(profile?.role ?? '')}</span></div>
            </div>
            <nav class="footer-links" aria-label="Social">
                ${socials.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}
            </nav>
            <p class="footer-note">&copy; ${new Date().getFullYear()} ${esc(profile?.name ?? 'Fahim Fuad')}. Built by hand, the source is <a href="https://github.com/ridhwandll/ridhwandll.github.io" target="_blank" rel="noopener">on GitHub</a>.${updated ? ` Last updated ${updated}.` : ''}</p>
        </div>`;
}

// Voxel-tile page transitions between internal pages
function initTransitions()
{
    const overlay = document.createElement('div');
    overlay.className = 'pt';
    overlay.setAttribute('aria-hidden', 'true');
    const cols = 8, rows = 5;
    for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
        {
            const t = document.createElement('i');
            t.style.setProperty('--d', `${(x + y) * 28}ms`);
            overlay.appendChild(t);
        }
    document.body.appendChild(overlay);

    const enter = document.documentElement.classList.contains('pt-enter');
    if (enter)
    {
        overlay.classList.add('covered');
        requestAnimationFrame(() => requestAnimationFrame(() =>
        {
            overlay.classList.remove('covered');
            overlay.classList.add('reveal');
            document.documentElement.classList.remove('pt-enter');
            setTimeout(() => overlay.classList.remove('reveal'), 700);
        }));
    }
    try { sessionStorage.removeItem('pt'); } catch { /* storage blocked */ }

    document.addEventListener('click', (e) =>
    {
        const a = e.target.closest('a[href]');
        if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download') || reducedMotion)
            return;
        const dest = new URL(a.href, location.href);
        if (dest.origin !== location.origin || (dest.pathname === location.pathname && dest.search === location.search))
            return;
        e.preventDefault();
        try { sessionStorage.setItem('pt', '1'); } catch { /* storage blocked */ }
        overlay.classList.add('cover');
        setTimeout(() => { location.href = dest.href; }, 480);
    });
    // Coming back through the bfcache: drop the cover
    window.addEventListener('pageshow', (e) => { if (e.persisted) overlay.classList.remove('cover', 'covered'); });
}

export function initReveal(root = document)
{
    const io = new IntersectionObserver((entries) =>
    {
        for (const e of entries)
        {
            if (!e.isIntersecting)
                continue;
            e.target.classList.add('in');
            io.unobserve(e.target);
        }
    }, { rootMargin: '0px 0px -6% 0px' });
    $$('.reveal:not(.in)', root).forEach((el, i) =>
    {
        el.style.setProperty('--rd', `${(i % 4) * 70}ms`);
        io.observe(el);
    });
}

// 3D tilt for cards: the card gets its own perspective so inner layers (translateZ) stay aligned
export function initTilt(root = document)
{
    if (!finePointer || reducedMotion)
        return;
    $$('[data-tilt]:not([data-tilt-on])', root).forEach((el) =>
    {
        el.dataset.tiltOn = '';
        const max = parseFloat(el.dataset.tilt) || 9;
        el.addEventListener('pointermove', (e) =>
        {
            const r = el.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
            el.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`);
            el.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`);
            el.style.setProperty('--mx', `${x * 100}%`);
            el.style.setProperty('--my', `${y * 100}%`);
            el.classList.add('tilting');
        });
        el.addEventListener('pointerleave', () =>
        {
            el.style.setProperty('--rx', '0deg');
            el.style.setProperty('--ry', '0deg');
            el.classList.remove('tilting');
        });
    });
}

export function setTitle(t)
{
    document.title = t ? `${t} | Fahim Fuad` : 'Fahim Fuad';
}

renderNav();
renderFooter();
console.log('%cHey, you opened the console.', 'font: 700 14px sans-serif; color: #ffa500');
console.log('The cubes are three.js, one InstancedMesh: assets/js/world.js. The engine I actually care about is at github.com/ridhwandll/Surge_Expired');
initTransitions();
document.addEventListener('DOMContentLoaded', () => { initReveal(); initTilt(); });
if (document.readyState !== 'loading')
{
    initReveal();
    initTilt();
}
