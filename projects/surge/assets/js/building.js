// Building the engine page: nav, reveal-on-scroll and copy buttons.

document.documentElement.classList.add('js');

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

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

const sectionLinks = new Map($$('.nav-links a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
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

const revealObserver = new IntersectionObserver((entries) =>
{
    for (const e of entries)
    {
        if (!e.isIntersecting)
            continue;
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
    }
}, { rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach(el => revealObserver.observe(el));

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
$$('[data-copy]').forEach(b => b.addEventListener('click', () => copyText(b.previousElementSibling.textContent, b)));
