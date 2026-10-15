'use strict';

const token = hexo.config.cloudflare_web_analytics?.token;

if (token) {
  const hostname = new URL(hexo.config.url).hostname;
  const json = value => JSON.stringify(value).replace(/</g, '\\u003c');

  // Guard at runtime: production output can also be served on preview hosts.
  hexo.extend.injector.register('body_end', `<script>
(function () {
  if (location.hostname !== ${json(hostname)}) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', ${json(JSON.stringify({ token }))});
  document.body.appendChild(script);
})();
</script>`);
}
