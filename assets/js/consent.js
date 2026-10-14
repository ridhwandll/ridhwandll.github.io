// Cookie consent + Google Analytics. Self-contained classic script, loaded with `defer` on every page.
// Nothing is sent to Google until the visitor accepts. The choice is remembered in localStorage.
// Anything with [data-consent-open] (the footer link) reopens the banner so the choice can be changed.
(function ()
{
    'use strict';

    var GA_ID = 'G-HCMYB3Y895';
    var KEY = 'consent-analytics';   // 'granted' | 'denied'
    var gaLoaded = false;

    function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: choice lasts for this page only */ } }

    // Global Privacy Control is an explicit opt-out signal: honour it without asking.
    var gpc = navigator.globalPrivacyControl === true;

    function loadGA()
    {
        if (gaLoaded)
            return;
        gaLoaded = true;
        window['ga-disable-' + GA_ID] = false;
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', GA_ID);
        var s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
        document.head.appendChild(s);
    }

    function unloadGA()
    {
        window['ga-disable-' + GA_ID] = true;
        // Remove the _ga cookies set earlier (host and parent domain).
        var host = location.hostname.split('.');
        var domains = ['', location.hostname, '.' + location.hostname];
        if (host.length > 2)
            domains.push('.' + host.slice(-2).join('.'));
        document.cookie.split(';').forEach(function (c)
        {
            var name = c.split('=')[0].trim();
            if (name !== '_ga' && name.indexOf('_ga_') !== 0 && name !== '_gid')
                return;
            domains.forEach(function (d)
            {
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
            });
        });
    }

    function apply(v)
    {
        if (v === 'granted' && !gpc)
            loadGA();
        else
            unloadGA();
    }

    var stored = read();
    if (stored === 'granted' && !gpc)
        loadGA();

    // Banner -----------------------------------------------------------------------------------------
    var CSS = '' +
        '.cc{position:fixed;z-index:400;left:max(16px,env(safe-area-inset-left));bottom:max(16px,env(safe-area-inset-bottom));width:min(420px,calc(100vw - 32px));' +
        'background:#16110b;color:#efe8dc;padding:18px 20px 16px;font:400 .85rem/1.55 "Encode Sans",system-ui,-apple-system,"Segoe UI",sans-serif;' +
        'box-shadow:0 18px 50px rgba(0,0,0,.6),0 0 0 1px rgba(255,165,0,.18);' +
        'clip-path:polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,16px 100%,0 calc(100% - 16px));' +
        'animation:cc-in .35s ease both}' +
        '.cc[hidden]{display:none}' +
        '.cc b{display:block;margin-bottom:4px;color:#ffa500;font:500 .72rem "JetBrains Mono",ui-monospace,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase}' +
        '.cc p{margin:0 0 14px;color:#a69c88}' +
        '.cc-row{display:flex;flex-wrap:wrap;gap:8px}' +
        '.cc button{flex:1 1 auto;border:0;padding:10px 16px;font:600 .8rem "JetBrains Mono",ui-monospace,Consolas,monospace;cursor:pointer;' +
        'clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));transition:background .2s,color .2s}' +
        '.cc-yes{background:#ffa500;color:#140c00}.cc-yes:hover{background:#ffc04a}' +
        '.cc-no{background:#2a2015;color:#efe8dc}.cc-no:hover{background:#3a2d1c;color:#ffa500}' +
        '.cc button:focus-visible{outline:2px solid #ffa500;outline-offset:2px}' +
        '@keyframes cc-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
        '@media (prefers-reduced-motion:reduce){.cc{animation:none}}' +
        '@media print{.cc{display:none!important}}';

    var banner = null;

    function build()
    {
        var style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        banner = document.createElement('div');
        banner.className = 'cc';
        banner.setAttribute('role', 'region');
        banner.setAttribute('aria-label', 'Cookie consent');
        banner.hidden = true;
        banner.innerHTML =
            '<b>Cookies</b>' +
            '<p>I use Google Analytics to see which pages get read. It sets cookies and only runs if you say yes. Nothing else tracks you here.</p>' +
            '<div class="cc-row"><button type="button" class="cc-yes">Accept</button><button type="button" class="cc-no">Decline</button></div>';
        document.body.appendChild(banner);

        banner.querySelector('.cc-yes').addEventListener('click', function () { choose('granted'); });
        banner.querySelector('.cc-no').addEventListener('click', function () { choose('denied'); });
    }

    function choose(v)
    {
        write(v);
        apply(v);
        banner.hidden = true;
    }

    function show(focus)
    {
        banner.hidden = false;
        if (focus)
            banner.querySelector(read() === 'granted' ? '.cc-no' : '.cc-yes').focus();
    }

    function init()
    {
        build();
        if (stored !== 'granted' && stored !== 'denied' && !gpc)
            show(false);
        document.addEventListener('click', function (e)
        {
            var t = e.target.closest && e.target.closest('[data-consent-open]');
            if (!t)
                return;
            e.preventDefault();
            show(true);
        });
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
})();
