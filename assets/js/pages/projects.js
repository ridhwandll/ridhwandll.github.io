// Projects index: filterable grid of tilted cards over a voxel lattice.
import { $, $$, esc, getProjects, startWorld, projectHref, coverHTML, initReveal, initTilt } from '../site.js';

export function projectCard(p)
{
    return `
        <a class="pcard tile reveal" href="${esc(projectHref(p))}" data-tilt="6" data-category="${esc(p.category)}">
            <div class="cover">${coverHTML(p)}${p.status ? `<span class="status">${esc(p.status)}</span>` : ''}</div>
            <div class="body">
                <div class="meta"><span>${esc(p.category)}</span><span>${esc(p.year)}</span></div>
                <h3>${esc(p.title)}</h3>
                <p>${esc(p.summary)}</p>
                <div class="tags">${(p.tags || []).slice(0, 4).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
                <span class="go">${p.page ? 'has its own site' : p.external ? 'external link' : p.body ? 'write-up' : 'on GitHub'}</span>
            </div>
        </a>`;
}

async function main()
{
    startWorld({ shape: 'lattice', layout: { x: 0.75, y: 0.1 } });
    const projects = await getProjects();
    const grid = $('#grid');
    const cats = ['All', ...new Set(projects.map(p => p.category))];
    const counts = Object.fromEntries(cats.map(c => [c, c === 'All' ? projects.length : projects.filter(p => p.category === c).length]));
    $('#filters').innerHTML = cats.map(c => `<button aria-pressed="${c === 'All'}" data-cat="${esc(c)}">${esc(c.toLowerCase())}<sup>${counts[c]}</sup></button>`).join('');

    const render = (cat) =>
    {
        const list = cat === 'All' ? projects : projects.filter(p => p.category === cat);
        grid.innerHTML = list.map(projectCard).join('') || '<p class="empty">Nothing here yet.</p>';
        initReveal(grid);
        initTilt(grid);
    };
    $('#filters').addEventListener('click', (e) =>
    {
        const b = e.target.closest('button');
        if (!b)
            return;
        $$('#filters button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        render(b.dataset.cat);
        history.replaceState(null, '', b.dataset.cat === 'All' ? location.pathname : `?c=${encodeURIComponent(b.dataset.cat)}`);
    });
    const initial = new URLSearchParams(location.search).get('c');
    const start = cats.includes(initial) ? initial : 'All';
    $$('#filters button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.cat === start)));
    render(start);
}

main().catch((err) =>
{
    console.error(err);
    $('#grid').innerHTML = '<p class="empty">Could not load content/projects.json.</p>';
});
