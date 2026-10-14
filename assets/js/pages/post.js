// Blog post: blog/post.html?p=<slug>, Markdown from the post's "file".
import { $, esc, url, getPosts, getText, startWorld, renderMarkdown, formatDate, setTitle, initReveal } from '../site.js';

async function main()
{
    // Calm background while reading: only drifting dust
    startWorld({ shape: 'none' });
    const slug = new URLSearchParams(location.search).get('p');
    const posts = await getPosts();
    const i = posts.findIndex(p => p.slug === slug);
    const post = posts[i];
    if (!post)
    {
        $('#post-head').innerHTML = `<h1 class="h-sec big">That post doesn't exist.</h1><a class="btn btn-amber" href="${url('blog/')}">All posts</a>`;
        return;
    }
    setTitle(post.title);
    const text = await getText(post.file || `content/posts/${post.slug}.md`);
    const words = text.split(/\s+/).length;
    $('#post-head').innerHTML = `<div class="scrim">
        <p class="crumbs reveal"><a href="${url('index.html')}">~</a> / <a href="${url('blog/')}">blog</a> / ${esc(post.slug)}</p>
        <h1 class="h-sec big">${esc(post.title)}</h1>
        <div class="post-meta reveal">
            <time datetime="${esc(post.date)}">${esc(formatDate(post.date, { year: 'numeric', month: 'long', day: 'numeric' }))}</time>
            <span>${Math.max(1, Math.round(words / 220))} min read</span>
            <span class="tags">${(post.tags || []).map(t => `<span class="tag">#${esc(t.toLowerCase())}</span>`).join('')}</span>
        </div></div>`;
    const box = await renderMarkdown(text);
    box.className = 'prose tile reveal';
    $('#post-body').appendChild(box);

    const newer = posts[i - 1], older = posts[i + 1];
    $('#post-pager').innerHTML = [
        older ? `<a class="tile reveal" href="${url(`blog/post.html?p=${encodeURIComponent(older.slug)}`)}"><span>&lt;- older</span><b>${esc(older.title)}</b></a>` : '<span></span>',
        newer ? `<a class="tile reveal" href="${url(`blog/post.html?p=${encodeURIComponent(newer.slug)}`)}"><span>newer -&gt;</span><b>${esc(newer.title)}</b></a>` : ''
    ].join('');
    initReveal();
}

main().catch((err) =>
{
    console.error(err);
    $('#post-head').innerHTML = '<p class="empty">Could not load this post.</p>';
});
