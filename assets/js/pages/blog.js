// Blog index: posts from content/posts.json, filterable by tag.
import { $, $$, esc, url, getPosts, startWorld, formatDate, initReveal } from '../site.js';

async function main()
{
    startWorld({ shape: 'helix', layout: { x: 0.8 } });
    const posts = await getPosts();
    const tags = ['All', ...new Set(posts.flatMap(p => p.tags || []))];
    $('#filters').innerHTML = tags.map(t => `<button aria-pressed="${t === 'All'}" data-tag="${esc(t)}">#${esc(t.toLowerCase())}</button>`).join('');
    const list = $('#posts');
    const render = (tag) =>
    {
        const shown = tag === 'All' ? posts : posts.filter(p => (p.tags || []).includes(tag));
        list.innerHTML = shown.map(p => `
            <a class="tile post-row reveal" href="${url(`blog/post.html?p=${encodeURIComponent(p.slug)}`)}">
                <time datetime="${esc(p.date)}">${esc(formatDate(p.date))}</time>
                <div>
                    <h3>${esc(p.title)}</h3>
                    <p>${esc(p.summary || '')}</p>
                    <div class="tags" style="margin-top:10px">${(p.tags || []).map(t => `<span class="tag">#${esc(t.toLowerCase())}</span>`).join('')}</div>
                </div>
                <span class="arr">-&gt;</span>
            </a>`).join('') || '<p class="empty">No posts yet.</p>';
        initReveal(list);
    };
    $('#filters').addEventListener('click', (e) =>
    {
        const b = e.target.closest('button');
        if (!b)
            return;
        $$('#filters button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        render(b.dataset.tag);
    });
    render('All');
}

main().catch((err) =>
{
    console.error(err);
    $('#posts').innerHTML = '<p class="empty">Could not load content/posts.json.</p>';
});
