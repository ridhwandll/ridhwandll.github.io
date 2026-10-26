// Resume: content/resume.json + profile. Printable (Ctrl+P / the button) as a clean one-column PDF.
import { $, esc, url, getProfile, getResume, initReveal } from '../site.js';

async function main()
{
    const [profile, resume] = await Promise.all([getProfile(), getResume()]);

    $('#resume-actions').innerHTML = `
        <button class="btn btn-amber" id="print">Print / save as PDF</button>
        ${profile.resumePdf ? `<a class="btn" href="${esc(url(profile.resumePdf))}" download>Download PDF</a>` : ''}`;
    $('#print').addEventListener('click', () => window.print());

    const contact = [
        profile.email && { label: 'email', value: profile.email, href: `mailto:${profile.email}` },
        { label: 'web', value: location.host || 'ridhwandll.github.io', href: url('index.html') },
        ...profile.socials.slice(0, 3).map(s => ({ label: s.label.toLowerCase(), value: s.handle || s.url, href: s.url }))
    ].filter(Boolean);

    const item = (it) => `
        <div class="r-item">
            <h3>${it.link ? `<a href="${esc(url(it.link))}">${esc(it.title)}</a>` : esc(it.title)}</h3>
            <time>${esc(it.period || '')}</time>
            <span class="org">${esc(it.org || '')}</span>
            ${it.points?.length ? `<ul>${it.points.map(pt => `<li>${esc(pt)}</li>`).join('')}</ul>` : ''}
        </div>`;

    $('#resume').innerHTML = `
        <aside class="resume-side">
            <div class="tile tile-amber resume-id reveal">
                <h1>${esc(profile.name)}</h1>
                <p>${esc(resume.headline || profile.role)}</p>
            </div>
            <div class="tile resume-contact reveal" data-title="Contact">
                ${contact.map(c => `<a href="${esc(c.href)}" ${/^https?:/.test(c.href) ? 'target="_blank" rel="noopener"' : ''}><span>${esc(c.label)}</span><b>${esc(c.value)}</b></a>`).join('')}
            </div>
            <div class="tile resume-skills reveal" data-title="Skills">
                ${(resume.skills || []).map(g => `<h3>${esc(g.group)}</h3><p>${g.items.map(esc).join(' · ')}</p>`).join('')}
                ${resume.languages?.length ? `<h3>Languages</h3><p>${resume.languages.map(esc).join(' · ')}</p>` : ''}
            </div>
        </aside>
        <div class="resume-main">
            ${resume.summary ? `<div class="tile resume-summary reveal"><p>${esc(resume.summary)}</p></div>` : ''}
            ${resume.sections.map(s => `
                <section class="tile resume-block reveal">
                    <h2>${esc(s.title)}</h2>
                    ${s.items.map(item).join('')}
                </section>`).join('')}
        </div>`;
    initReveal();
}

main().catch((err) =>
{
    console.error(err);
    $('#resume').innerHTML = '<p class="empty">Could not load content/resume.json.</p>';
});
