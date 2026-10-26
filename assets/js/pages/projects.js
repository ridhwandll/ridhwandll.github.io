// Projects index: a filterable grid of asset-browser cards.
import { $, $$, esc, getProjects, projectCard, initReveal } from '../site.js';

async function main()
{
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
