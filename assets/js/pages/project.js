// Generic project page: projects/project.html?id=<slug>, filled from content/projects.json (+ Markdown body or GitHub README).
import { $, $$, esc, url, getProjects, getText, getReadme, startWorld, projectHref, coverHTML, renderMarkdown, setTitle, initReveal, initTilt } from '../site.js';

async function main()
{
    const id = new URLSearchParams(location.search).get('id');
    const projects = await getProjects();
    const index = projects.findIndex(p => p.slug === id);
    const p = projects[index];
    if (!p)
    {
        startWorld({ shape: 'text:404', layout: { x: 0.5 } });
        $('#project-head').innerHTML = `<p class="crumbs"><a href="${url('projects/')}">projects</a> / ${esc(id || '?')}</p>
            <h1 class="h-sec big">No project called that.</h1><a class="btn btn-amber" href="${url('projects/')}">All projects</a>`;
        return;
    }
    setTitle(p.title);
    startWorld({ shape: p.shape || 'cube', layout: { x: 0.72, y: 0.12 } });

    const links = [];
    if (p.page)
        links.push(`<a class="btn btn-amber" href="${esc(url(p.page))}">Open project site <span class="arr">-&gt;</span></a>`);
    if (p.external)
        links.push(`<a class="btn btn-amber" href="${esc(p.external)}" target="_blank" rel="noopener">Open <span class="arr">-&gt;</span></a>`);
    if (p.repo)
        links.push(`<a class="btn ${links.length ? '' : 'btn-amber'}" href="${esc(p.repo)}" target="_blank" rel="noopener">Source on GitHub <span class="arr">-&gt;</span></a>`);
    for (const l of p.links || [])
        links.push(`<a class="btn" href="${esc(url(l.url))}" ${/^https?:/.test(l.url) ? 'target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`);

    const facts = [['Year', p.year], ['Role', p.role], ['Kind', p.category], ['Status', p.status]].filter(f => f[1]);
    $('#project-head').innerHTML = `<div class="scrim">
        <p class="crumbs reveal"><a href="${url('index.html')}">~</a> / <a href="${url('projects/')}">projects</a> / ${esc(p.slug)}</p>
        <h1 class="h-sec big project-title">${esc(p.title)}</h1>
        <p class="lede reveal">${esc(p.summary)}</p>
        <div class="facts">${facts.map(([k, v], i) => `<div class="fact tile ${i === 0 ? 'tile-amber' : ''} reveal"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
        <div class="tags reveal" style="margin-bottom:26px">${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="btns reveal">${links.join('')}</div></div>`;

    // Cover in a tilted 3D frame that straightens as you scroll
    $('#project-art').innerHTML = `
        <figure class="hero-art reveal" id="art"><div class="frame">${coverHTML(p)}</div></figure>
        ${p.gallery?.length ? `<div class="gallery">${p.gallery.map(g => `<button class="reveal" data-full="${esc(url(g))}"><img src="${esc(url(g))}" alt="${esc(p.title)} screenshot" loading="lazy"></button>`).join('')}</div>` : ''}`;
    const art = $('#art');
    const tilt = () =>
    {
        const r = art.getBoundingClientRect();
        const k = Math.min(1, Math.max(0, (window.innerHeight - r.top) / (window.innerHeight * 0.8)));
        art.style.setProperty('--art-tilt', `${(1 - k) * 18}deg`);
        art.style.setProperty('--art-scale', (0.92 + k * 0.08).toFixed(3));
    };
    window.addEventListener('scroll', tilt, { passive: true });
    tilt();

    const lb = $('#lightbox');
    $$('.gallery button').forEach(b => b.addEventListener('click', () => { $('img', lb).src = b.dataset.full; lb.hidden = false; }));
    lb.addEventListener('click', () => { lb.hidden = true; });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.hidden = true; });

    // Body: the local write-up if there is one, otherwise the repo's README straight from GitHub
    try
    {
        const readme = !p.body && await getReadme(p.repo);
        const box = p.body ? await renderMarkdown(await getText(p.body))
            : readme ? await renderMarkdown(readme.text, { base: readme, dropTitle: true }) : null;
        if (box)
        {
            box.className = 'prose tile reveal';
            $('#project-body').appendChild(box);
        }
    }
    catch (err)
    {
        console.warn(err);
    }

    const prev = projects[(index - 1 + projects.length) % projects.length];
    const next = projects[(index + 1) % projects.length];
    $('#project-pager').innerHTML = `
        <a class="tile reveal" href="${esc(projectHref(prev))}"><span>&lt;- previous</span><b>${esc(prev.title)}</b></a>
        <a class="tile reveal" href="${esc(projectHref(next))}"><span>next -&gt;</span><b>${esc(next.title)}</b></a>`;
    initReveal();
    initTilt();
}

main().catch((err) =>
{
    console.error(err);
    $('#project-head').innerHTML = '<p class="empty">Could not load this project.</p>';
});
