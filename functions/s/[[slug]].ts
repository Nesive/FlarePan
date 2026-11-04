// Share landing route. GET /s/<slug> serves the public SPA shell
// (index.html) so the client-side share view can read the slug from
// the path. The slug itself is never validated here: the SPA asks
// /api/share/<slug> for validity and /api/share/verify for the code,
// and the folder contents are only ever served through the
// authenticated children/raw endpoints. Without this route, the
// static 404 page would redirect /s/<slug> back to / and drop the
// slug. No-store: a share page must never be cached across
// revocation.
//
// The shell is served through the ASSETS binding when it answers;
// otherwise the same loader is served inline (verbatim copy of the
// index.html bootstrap, which only loads /assets/App.vue fresh),
// so the route never depends on one asset mechanism alone.
const FALLBACK_SHELL = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>分享 - FlarePan</title>
    <script src="https://cdn.jsdmirror.com/npm/vue@3.2.37/dist/vue.global.min.js"></script>
    <script src="https://cdn.jsdmirror.com/npm/axios@0.27.2/dist/axios.min.js"></script>
    <script src="https://cdn.jsdmirror.com/npm/vue3-sfc-loader@0.9.5/dist/vue3-sfc-loader.min.js"></script>
    <link rel="stylesheet" href="/assets/main.css" />
    <link rel="icon" type="image/png" href="/favicon.ico" />
  </head>
  <body>
    <div id="app"></div>
    <script>
      const { loadModule } = window["vue3-sfc-loader"];
      const options = {
        moduleCache: { vue: Vue },
        async getFile(url) {
          const res = await fetch(url);
          if (!res.ok)
            throw Object.assign(new Error(res.statusText + " " + url), { res });
          return {
            getContentData: (asBinary) =>
              asBinary ? res.arrayBuffer() : res.text(),
          };
        },
        addStyle(textContent) {
          const style = document.createElement("style");
          style.textContent = textContent;
          const ref = document.head.getElementsByTagName("style")[0] || null;
          document.head.insertBefore(style, ref);
        },
      };
      const app = Vue.createApp({
        components: {
          App: Vue.defineAsyncComponent(() =>
            loadModule("/assets/App.vue", options)
          ),
        },
        template: "<App></App>",
      });
      app.mount("#app");
    </script>
  </body>
</html>
`;

export async function onRequestGet(context) {
  let body = null;
  try {
    const url = new URL(context.request.url);
    url.pathname = '/index.html';
    url.search = '';
    const res = await context.env.ASSETS.fetch(new Request(url,
    context.request));
    if (res.ok) body = await res.text();
  } catch {
    body = null;
  }
  if (!body) body = FALLBACK_SHELL;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
