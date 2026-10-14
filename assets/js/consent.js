// Cookie notice + Google Analytics. Self-contained classic script, loaded with `defer` on every page.
// Analytics is a required part of the site, so there is no decline option: the banner stays until the
// visitor accepts, and nothing is sent to Google before that. The acceptance is remembered in localStorage.
(function ()
{
    'use strict';

    var GA_ID = 'G-HCMYB3Y895';
    var KEY = 'consent-analytics';   // 'granted'
    var gaLoaded = false;

    function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode: choice lasts for this page only */ } }

    // Global Privacy Control is an automatic opt-out signal from the browser: still honoured, analytics stays off.
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
        '.cc-row{display:flex;gap:8px}' +
        '.cc button{flex:1 1 auto;border:0;padding:10px 16px;font:600 .8rem "JetBrains Mono",ui-monospace,Consolas,monospace;cursor:pointer;' +
        'clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,8px 100%,0 calc(100% - 8px));transition:background .2s,color .2s}' +
        '.cc-yes{background:#ffa500;color:#140c00}.cc-yes:hover{background:#ffc04a}' +
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
            '<p>This site uses Google Analytics cookies to see which pages get read. They are part of how the site works, so they need to be accepted to continue. Nothing else tracks you here.</p>' +
            '<div class="cc-row"><button type="button" class="cc-yes">Accept</button></div>';
        document.body.appendChild(banner);

        banner.querySelector('.cc-yes').addEventListener('click', function ()
        {
            write('granted');
            loadGA();
            banner.hidden = true;
        });
    }

    function init()
    {
        build();
        if (stored !== 'granted' && !gpc)
            banner.hidden = false;
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else
        init();
})();
