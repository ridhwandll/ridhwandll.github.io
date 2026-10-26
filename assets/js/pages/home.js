// Home: big name, scroll-driven world shapes, featured project, 3D project ring.
import { $, $$, esc, url, getProfile, getProjects, getPosts, getResume, startWorld, projectHref, coverHTML, formatDate, initReveal, initTilt, reducedMotion, finePointer } from '../site.js';

const sections = $$('section[data-shape]');
const narrow = window.matchMedia('(max-width: 640px)');
const yOf = (s) => parseFloat((narrow.matches && s.dataset.yMobile) || s.dataset.y) || 0;

async function main()
{
    const [profile, projects, posts, resume] = await Promise.all([getProfile(), getProjects(), getPosts(), getResume()]);

    const statsEl = $('#world-stats');
    const worldPromise = startWorld({
        shape: sections[0].dataset.shape,
        layout: { x: 0, y: yOf(sections[0]) },
        onStats: (s) => { statsEl.textContent = `${s.cubes} cubes, 1 draw call, ${Math.round(s.fps)}fps`; }
    });

    if (!finePointer)
        $('#hero-meta').textContent = '(psst, tap the empty space)';
    renderHeroName(profile);
    renderAbout(profile);
    renderFeature(projects);
    const main = projects.find(x => x.featured) || projects[0];
    buildRail(projects.filter(p => p.featured && p !== main));
    renderSkills(resume.skills || []);
    renderPosts(posts.slice(0, 3));
    renderContact(profile);
    initReveal();
    initTilt();

    const world = await worldPromise;
    trackSections(world);
}

// --- Sections drive the world -------------------------------------------------------------------

function trackSections(world)
{
    let current = null, ticking = false;
    const update = () =>
    {
        ticking = false;
        const mid = window.innerHeight * 0.5;
        let best = sections[0];
        for (const s of sections)
        {
            const r = s.getBoundingClientRect();
            if (r.top <= mid && r.bottom > mid)
            {
                best = s;
                break;
            }
        }
        if (best === current)
            return;
        current = best;
        document.body.dataset.section = best.id;
        if (world)
            world.setShape(best.dataset.shape, { x: parseFloat(best.dataset.x) || 0, y: yOf(best) });
    };
    window.addEventListener('scroll', () =>
    {
        if (!ticking)
        {
            ticking = true;
            requestAnimationFrame(update);
        }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
}

// --- Hero: big 3D name ----------------------------------------------------------------------------

function renderHeroName(profile)
{
    const h1 = $('#hero-name');
    const words = profile.name.toUpperCase().split(' ');
    h1.setAttribute('aria-label', profile.name);
    // One span per letter: they flip in one by one and share the extrusion
    let n = 0;
    h1.innerHTML = words.map((w, wi) => `<span class="word${wi === words.length - 1 && words.length > 1 ? ' accent' : ''}" aria-hidden="true">${[...w].map(c => `<span class="ch" style="--i:${n++}">${esc(c)}</span>`).join('')}</span>`).join(' ');

    // The extrusion leans away from the cursor, the whole name tilts toward it
    if (!reducedMotion && finePointer)
    {
        let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
        const step = () =>
        {
            cx += (tx - cx) * 0.12;
            cy += (ty - cy) * 0.12;
            h1.style.setProperty('--ex', (-cx * 1.4).toFixed(3));
            h1.style.setProperty('--ey', (1 - cy * 1.2).toFixed(3));
            h1.style.setProperty('--hy', `${(cx * 9).toFixed(2)}deg`);
            h1.style.setProperty('--hx', `${(-cy * 7).toFixed(2)}deg`);
            raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(step) : 0;
        };
        window.addEventListener('pointermove', (e) =>
        {
            if (window.scrollY > window.innerHeight)
                return;
            tx = (e.clientX / window.innerWidth) * 2 - 1;
            ty = (e.clientY / window.innerHeight) * 2 - 1;
            if (!raf)
                raf = requestAnimationFrame(step);
        }, { passive: true });
    }
}

// --- About ----------------------------------------------------------------------------------------------

function renderAbout(profile)
{
    $('#bio').innerHTML = profile.bio.map(p => `<p>${esc(p)}</p>`).join('');
    $('#now').innerHTML = `<b>Now${profile.nowUpdated ? ` <span>(${esc(profile.nowUpdated)})</span>` : ''}:</b> ${esc(profile.now)}`;
}

// --- Featured -------------------------------------------------------------------------------------------

function renderFeature(projects)
{
    const p = projects.find(x => x.featured) || projects[0];
    if (!p)
        return;
    $('#feature').innerHTML = `
        <p class="feature-label">Currently working on</p>
        <h2 class="h-sec">${esc(p.title)}</h2>
        <p class="lede">${esc(p.summary)}</p>
        <a class="feature-art" href="${esc(projectHref(p))}" data-tilt="4" aria-label="${esc(p.title)}">${coverHTML(p)}</a>
        <p class="caption">Toytown, one of the test scenes: a cannon barrage vs. a block castle, 500+ Jolt bodies.</p>
        <div class="btns">
            <a class="btn btn-amber" href="${esc(projectHref(p))}">Read about Surge</a>
            ${p.repo ? `<a class="btn" href="${esc(p.repo)}" target="_blank" rel="noopener">Source</a>` : ''}
        </div>`;
}

// --- Project rail ---------------------------------------------------------------------------------------
// Desktop: the section pins and vertical scrolling slides the cards sideways.
// Touch / small screens: a native swipe row with snapping. Both curve the cards in 3D toward the center.

function buildRail(projects)
{
    const section = $('#projects'), viewport = $('#rail-viewport'), track = $('#rail-track');
    const bar = $('#rail-progress'), count = $('#rail-count');
    const n = projects.length;
    if (!n)
        return;
    track.innerHTML = projects.map((p, i) => `
        <a class="rail-card" href="${esc(projectHref(p))}">
            <div class="rc-cover">${coverHTML(p)}<span class="rc-idx">${String(i + 1).padStart(2, '0')}</span></div>
            <div class="rc-body">
                <span class="rc-meta">${esc(p.category)} · ${esc(p.year)}</span>
                <h3>${esc(p.title)}</h3>
                <p>${esc(p.summary)}</p>
                <div class="tags">${(p.tags || []).slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
            </div>
        </a>`).join('');
    const cards = $$('.rail-card', track);
    let mode = 'swipe', overflow = 0, offset = 0, ticking = false;

    const usePin = () => finePointer && !reducedMotion && window.innerWidth > 900;

    const layout = () =>
    {
        mode = usePin() ? 'pin' : 'swipe';
        section.classList.toggle('rail-pinned', mode === 'pin');
        track.style.transform = '';
        overflow = Math.max(0, track.scrollWidth - viewport.clientWidth);
        // The pinned section is as tall as the sideways distance, so scrolling feels 1:1
        section.style.height = mode === 'pin' ? `${window.innerHeight + overflow}px` : '';
        update();
    };

    const update = () =>
    {
        ticking = false;
        let progress;
        if (mode === 'pin')
        {
            const travel = section.offsetHeight - window.innerHeight;
            progress = travel > 0 ? Math.min(1, Math.max(0, -section.getBoundingClientRect().top / travel)) : 0;
            offset = progress * overflow;
            track.style.transform = `translate3d(${-offset}px, 0, 0)`;
        }
        else
        {
            const max = viewport.scrollWidth - viewport.clientWidth;
            offset = viewport.scrollLeft;
            progress = max > 0 ? offset / max : 0;
        }
        // Curve: cards turn to face the middle of the screen (from layout, not from their transformed rects)
        const mid = viewport.clientWidth / 2;
        let nearest = 0, best = Infinity;
        cards.forEach((c, i) =>
        {
            const center = c.offsetLeft + c.offsetWidth / 2 - offset;
            const d = (center - mid) / viewport.clientWidth;
            const ad = Math.min(1, Math.abs(d));
            if (Math.abs(d) < best) { best = Math.abs(d); nearest = i; }
            if (reducedMotion)
                return;
            c.style.transform = `perspective(1300px) translateZ(${(-ad * 140).toFixed(1)}px) rotateY(${(Math.max(-1, Math.min(1, d)) * -32).toFixed(2)}deg)`;
            c.style.setProperty('--lit', (1 - ad * 0.55).toFixed(3));
        });
        cards.forEach((c, i) => c.classList.toggle('current', i === nearest));
        bar.style.transform = `scaleX(${Math.max(0.02, progress)})`;
        count.textContent = `${String(nearest + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    };

    const request = () =>
    {
        if (!ticking)
        {
            ticking = true;
            requestAnimationFrame(update);
        }
    };
    window.addEventListener('scroll', request, { passive: true });
    viewport.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', layout);
    // Keyboard: tabbing to a card scrolls the page to the spot where that card is centered
    track.addEventListener('focusin', (e) =>
    {
        const c = e.target.closest('.rail-card');
        if (!c || mode !== 'pin')
            return;
        const want = Math.min(overflow, Math.max(0, c.offsetLeft + c.offsetWidth / 2 - viewport.clientWidth / 2));
        const top = section.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top: top + (overflow ? want / overflow : 0) * (section.offsetHeight - window.innerHeight), behavior: 'smooth' });
    });
    // Covers can change the layout once they load
    $$('img', track).forEach(img => img.addEventListener('load', layout, { once: true }));
    layout();
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
    $('#cc-name').textContent = profile.name;
    $('#cc-role').textContent = profile.role.toLowerCase();
    $('#cc-handle').textContent = `@${profile.handle}`;
    $('#cc-foot').textContent = [profile.location, profile.affiliation].filter(Boolean).join(' / ');
    $('#socials').innerHTML = profile.socials.map(s => `
        <li><a href="${esc(s.url)}" target="_blank" rel="noopener">
            ${icon(s.icon)}
            <b>${esc(s.label)}</b>
            <span>${esc(s.handle || '')}</span>
            <em aria-hidden="true">&#8599;</em>
        </a></li>`).join('');

    const discord = profile.socials.find(s => s.icon === 'discord');
    const github = profile.socials.find(s => s.icon === 'github');
    $('#contact-cta').innerHTML = [
        discord && `<a class="btn btn-amber" href="${esc(discord.url)}" target="_blank" rel="noopener">${icon('discord')}Message me on Discord</a>`,
        github && `<a class="btn" href="${esc(github.url)}" target="_blank" rel="noopener">${icon('github')}GitHub</a>`
    ].filter(Boolean).join('');
    if (profile.email)
        $('#mail').innerHTML = `<p class="note">or email <a class="text-link" href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></p>`;

    // Local time where I am, so people know whether I'm likely awake
    if (profile.timezone)
    {
        const clock = $('#clock'), text = $('#clock-text');
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: profile.timezone, hour: 'numeric', minute: '2-digit' });
        const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: profile.timezone, hour: 'numeric', hourCycle: 'h23' });
        const tick = () =>
        {
            const now = new Date();
            const h = parseInt(hourFmt.format(now), 10);
            const awake = h >= 9 || h < 2;
            clock.classList.toggle('asleep', !awake);
            text.innerHTML = `It's <b>${esc(fmt.format(now))}</b> in ${esc(profile.location)} right now, so I'm ${awake ? 'probably awake' : 'probably asleep'}.`;
        };
        tick();
        clock.hidden = false;
        setInterval(tick, 30000);
    }
}

main().catch((err) =>
{
    console.error(err);
    document.querySelectorAll('.loading').forEach(el => { el.classList.remove('loading'); el.textContent = 'Could not load content. Serve the site over http (see README).'; });
});
