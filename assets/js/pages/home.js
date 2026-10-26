// Home: engine startup log, a vector-display asteroid field, featured project, project grid.
import { $, esc, url, getProfile, getProjects, getPosts, getResume, projectHref, projectCard, coverHTML, formatDate, initReveal, reducedMotion } from '../site.js';

async function main()
{
    asteroids($('#hero-canvas'), $('#hud'), $('#hero-hint'));
    const [profile, projects, posts, resume] = await Promise.all([getProfile(), getProjects(), getPosts(), getResume()]);

    boot($('#boot'), projects, posts);
    renderAbout(profile);
    const current = projects.find(x => x.featured) || projects[0];
    renderFeature(current);
    $('#featured-grid').innerHTML = projects.filter(p => p.featured && p !== current).map(projectCard).join('');
    renderSkills(resume.skills || []);
    renderPosts(posts.slice(0, 3));
    renderContact(profile);
    initReveal();
}

// --- Hero: engine startup log -----------------------------------------------------------------------
// Typed out once per visit; the numbers that can be real (clock, window, threads, load time, content) are.

async function boot(pre, projects, posts)
{
    let fast = reducedMotion;
    try
    {
        fast ||= !!sessionStorage.getItem('booted');
        sessionStorage.setItem('booted', '1');
    }
    catch (e) {}
    const wait = (ms) => fast ? null : new Promise(r => setTimeout(r, ms));
    const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    const stamp = () => `<span class="t">[${clock.format(new Date())}]</span>`;
    const log = (channel, msg, cls = 'ch') => `${stamp()} <span class="${cls}">${channel.padEnd(9)}</span> ${msg}`;
    const ok = ' <span class="ok">OK</span>';
    const caret = '<span class="caret"></span>';
    const prompt = '<span class="ps">PS D:\\Dev\\Surge&gt;</span> ';
    const nav = performance.getEntriesByType('navigation')[0];
    const loadMs = Math.round(nav?.domContentLoadedEventEnd || performance.now());

    const lines = [
        () => log('Core', 'Surge Engine | Windows x64 | Release'),
        () => log('Platform', `Window ${window.innerWidth}x${window.innerHeight} @ ${window.devicePixelRatio || 1}x`),
        () => log('Jobs', `${navigator.hardwareConcurrency || 4} worker threads`),
        () => log('Vulkan', `Instance 1.1 ..............${ok}`),
        () => log('Renderer', `Render graph: 9 passes, 2 culled${ok}`),
        () => log('Physics', `Jolt ready${ok}`),
        () => log('Script', `Lua 5.4 VM ready${ok}`),
        () => log('Asset', `Loaded ${projects.length} projects, ${posts.length} posts`),
        () => log('Scene', `Portfolio.surge loaded in ${loadMs} ms`),
        () => log('Warn', '<span class="warn">Developer is a professional dumbass</span>', 'warn')
    ];

    let html = '';
    const cmd = '.\\SurgePlayer.exe --scene Portfolio.surge';
    for (let i = 0; i <= cmd.length && !fast; i++)
    {
        pre.innerHTML = prompt + esc(cmd.slice(0, i)) + caret;
        await wait(24);
    }
    html += prompt + esc(cmd) + '\n';
    for (const line of lines)
    {
        await wait(70 + Math.random() * 110);
        html += line() + '\n';
        pre.innerHTML = html + caret;
    }
    await wait(200);
    pre.innerHTML = html + prompt + caret;
}

// --- Hero: a vector-display asteroid field. Click a rock to shatter it -------------------------------
// Plain 2D canvas. Lines leave a short phosphor trail; the loop only runs while the hero is on screen.

function asteroids(canvas, hud, hint)
{
    const ctx = canvas.getContext('2d');
    const rocks = [], sparks = [], rings = [];
    let w = 0, h = 0, score = 0, fps = 60, running = false, last = 0, respawn = 0, hudAt = 0;

    const rock = (x, y, r, vx, vy) =>
    {
        const n = 8 + Math.floor(Math.random() * 5);
        const pts = Array.from({ length: n }, (_, i) =>
        {
            const a = (i / n) * Math.PI * 2, d = r * (0.68 + Math.random() * 0.36);
            return [Math.cos(a) * d, Math.sin(a) * d];
        });
        return { x, y, r, vx, vy, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.7, pts };
    };
    const target = () => Math.round(Math.min(13, Math.max(5, (w * h) / 110000)));
    const spawn = (fromEdge) =>
    {
        const r = 22 + Math.random() * 40, ang = Math.random() * Math.PI * 2, sp = 12 + Math.random() * 26;
        let x = Math.random() * w, y = Math.random() * h;
        if (fromEdge)
        {
            if (Math.random() < 0.5)
                x = Math.random() < 0.5 ? -r : w + r;
            else
                y = Math.random() < 0.5 ? -r : h + r;
        }
        rocks.push(rock(x, y, r, Math.cos(ang) * sp, Math.sin(ang) * sp));
    };

    const resize = () =>
    {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(1);
    };

    const update = (dt) =>
    {
        for (const r of rocks)
        {
            r.x += r.vx * dt;
            r.y += r.vy * dt;
            r.a += r.va * dt;
            // Wrap around the screen edges, like the real thing
            if (r.x < -r.r) r.x = w + r.r;
            else if (r.x > w + r.r) r.x = -r.r;
            if (r.y < -r.r) r.y = h + r.r;
            else if (r.y > h + r.r) r.y = -r.r;
        }
        for (const s of sparks)
        {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.life -= dt;
        }
        for (const g of rings)
            g.t += dt;
        for (let i = sparks.length - 1; i >= 0; i--)
            if (sparks[i].life <= 0)
                sparks.splice(i, 1);
        for (let i = rings.length - 1; i >= 0; i--)
            if (rings[i].t > 0.45)
                rings.splice(i, 1);
        respawn -= dt;
        if (rocks.length < target() && respawn <= 0)
        {
            spawn(true);
            respawn = 1.2;
        }
    };

    // fade < 1 leaves the previous frames showing through: the phosphor trail
    const draw = (fade) =>
    {
        ctx.fillStyle = `rgba(26, 26, 26, ${fade})`;
        ctx.fillRect(0, 0, w, h);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (const r of rocks)
        {
            const c = Math.cos(r.a), s = Math.sin(r.a);
            r.pts.forEach(([px, py], i) =>
            {
                const x = r.x + px * c - py * s, y = r.y + px * s + py * c;
                if (i === 0)
                    ctx.moveTo(x, y);
                else
                    ctx.lineTo(x, y);
            });
            ctx.closePath();
        }
        for (const sp of sparks)
        {
            ctx.moveTo(sp.x, sp.y);
            ctx.lineTo(sp.x - sp.vx * 0.04, sp.y - sp.vy * 0.04);
        }
        // Two strokes fake the glow: a wide dim one, then a thin bright core
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.1)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 196, 110, 0.62)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        for (const g of rings)
        {
            ctx.beginPath();
            ctx.arc(g.x, g.y, 8 + g.t * 260, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 165, 0, ${(0.5 * (1 - g.t / 0.45)).toFixed(3)})`;
            ctx.stroke();
        }
    };

    const showHud = () =>
    {
        hud.innerHTML = `<b>FPS</b> ${Math.round(fps)} | ${(1000 / fps).toFixed(1)} ms\n<b>ENTITIES</b> ${rocks.length + sparks.length}\n<b>SCORE</b> ${String(score).padStart(6, '0')}`;
    };

    const frame = (now) =>
    {
        if (!running)
            return;
        const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
        last = now;
        fps += (1 / dt - fps) * 0.05;
        update(dt);
        draw(0.3);
        if (now - hudAt > 500)
        {
            hudAt = now;
            showHud();
        }
        requestAnimationFrame(frame);
    };
    const setRunning = (on) =>
    {
        if (on === running)
            return;
        running = on;
        if (on)
        {
            last = performance.now();
            requestAnimationFrame(frame);
        }
    };

    canvas.addEventListener('pointerdown', (e) =>
    {
        const b = canvas.getBoundingClientRect();
        const x = e.clientX - b.left, y = e.clientY - b.top;
        let hit = null, best = Infinity;
        for (const r of rocks)
        {
            const d = Math.hypot(r.x - x, r.y - y);
            if (d < r.r * 1.1 && d < best)
            {
                best = d;
                hit = r;
            }
        }
        if (hit)
        {
            rocks.splice(rocks.indexOf(hit), 1);
            score += hit.r > 40 ? 20 : hit.r > 22 ? 50 : 100;
            if (hit.r > 18)
                for (let i = 0; i < 2 + (hit.r > 40 ? 1 : 0); i++)
                {
                    const ang = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 50;
                    rocks.push(rock(hit.x, hit.y, hit.r * 0.55, hit.vx + Math.cos(ang) * sp, hit.vy + Math.sin(ang) * sp));
                }
            for (let i = 0; i < 16; i++)
            {
                const ang = Math.random() * Math.PI * 2, sp = 80 + Math.random() * 220;
                sparks.push({ x: hit.x, y: hit.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0.3 + Math.random() * 0.4 });
            }
            if (score === 20 || score === 50 || score === 100)
                hint.textContent = '(nice. keep going, nobody is watching)';
        }
        else
            rings.push({ x, y, t: 0 });
        if (!running)
        {
            draw(1);
            showHud();
        }
    });

    resize();
    for (let i = 0; i < target(); i++)
        spawn(false);
    draw(1);
    showHud();
    window.addEventListener('resize', resize);
    if (!reducedMotion)
        new IntersectionObserver(([e]) => setRunning(e.isIntersecting)).observe(canvas);
}

// --- About, featured -----------------------------------------------------------------------------------

function renderAbout(profile)
{
    $('#bio').innerHTML = profile.bio.map(p => `<p>${esc(p)}</p>`).join('');
    $('#now').innerHTML = `<b>Now${profile.nowUpdated ? ` <span>(${esc(profile.nowUpdated)})</span>` : ''}:</b> ${esc(profile.now)}`;
}

function renderFeature(p)
{
    if (!p)
        return;
    $('#feature').innerHTML = `
        <div>
            <p class="feature-label">Currently working on</p>
            <h2 class="h-sec">${esc(p.title)}</h2>
            <p class="lede">${esc(p.summary)}</p>
            <div class="btns">
                <a class="btn btn-amber" href="${esc(projectHref(p))}">Read about Surge</a>
                ${p.repo ? `<a class="btn" href="${esc(p.repo)}" target="_blank" rel="noopener">Source</a>` : ''}
            </div>
        </div>
        <div>
            <a class="feature-art tile phosphor" data-title="Scene | Toytown" href="${esc(projectHref(p))}" aria-label="${esc(p.title)}">${coverHTML(p)}</a>
            <p class="caption">Toytown, one of the test scenes: a cannon barrage vs. a block castle, 500+ Jolt bodies.</p>
        </div>`;
}

// --- Skills, posts, contact ------------------------------------------------------------------------------

function renderSkills(groups)
{
    $('#skills').innerHTML = groups.map(g => `<dt>${esc(g.group)}</dt><dd>${g.items.map(esc).join(', ')}</dd>`).join('');
}

function renderPosts(posts)
{
    $('#posts').innerHTML = posts.length ? posts.map(p => `
        <li><a href="${url(`blog/post.html?p=${encodeURIComponent(p.slug)}`)}">
            <time datetime="${esc(p.date)}">${esc(formatDate(p.date, { year: 'numeric', month: 'short' }))}</time>
            <span><b>${esc(p.title)}</b>${p.summary ? `<i>${esc(p.summary)}</i>` : ''}</span>
        </a></li>`).join('') : '<li class="note">Nothing yet.</li>';
}

function renderContact(profile)
{
    // Absolute URL: a url() inside a custom property resolves against the stylesheet, not the page
    const icon = (name) => name ? `<i class="ico" style="--ico:url(${new URL(url(`assets/img/icons/${name}.svg`), location.href).href})"></i>` : '<i class="ico ico-link"></i>';
    const insta = profile.socials.find(s => s.icon === 'instagram');
    if (insta)
        $('#contact-cta').innerHTML = `<a class="btn btn-amber" href="${esc(insta.url)}" target="_blank" rel="noopener">${icon('instagram')}DM me on Instagram</a>`;

    const links = profile.socials.map(s => ({ label: s.label, href: s.url, icon: icon(s.icon) }));
    if (profile.email)
        links.push({ label: 'Email', href: `mailto:${profile.email}`, icon: '' });
    $('#socials').innerHTML = links.map(l => `
        <li><a href="${esc(l.href)}" ${/^https?:/.test(l.href) ? 'target="_blank" rel="noopener"' : ''}>${l.icon}${esc(l.label)}</a></li>`).join('');
}

main().catch((err) =>
{
    console.error(err);
    document.querySelectorAll('.loading').forEach(el => { el.classList.remove('loading'); el.textContent = 'Could not load content. Serve the site over http (see README).'; });
});
