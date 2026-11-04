// Theme skin + favicon helper, loaded synchronously in <head> on every
// page (front + admin). Single source of truth for skin painting:
//   - applySkin(skin): dataset + localStorage + favicon, all at once,
//     so a skin switch restyles the current page immediately, no reload.
//   - On load, align the favicon with the cached skin before Vue mounts
//     (the inline first-paint script already set dataset from the cache).
(function () {
  var STARSHIP_FAVICON = '/assets/planet-favicon.png?v=2';
  var DEFAULT_FAVICON = '/favicon.ico';

  function isSkin(v) {
    return v === 'starship' || v === 'original';
  }

  // Single-link rule: the page has NO static <link rel="icon"> anymore
  // (it used to shadow the swapped icon in browsers that honor the last
  // icon link). Every switch removes all icon links and appends one fresh
  // node, so no stale or duplicate link can ever win.
  function setFavicon(skin) {
    var links = document.querySelectorAll('link[rel="icon"]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].parentNode) links[i].parentNode.removeChild(links[i]);
    }
    var link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = skin === 'starship' ? STARSHIP_FAVICON : DEFAULT_FAVICON;
    document.head.appendChild(link);
  }

  function applySkin(skin) {
    if (!isSkin(skin)) return;
    document.documentElement.dataset.skin = skin;
    try {
      localStorage.setItem('pan-skin', skin);
    } catch (e) {}
    setFavicon(skin);
  }

  window.__panSkin = {
    applySkin: applySkin,
    setFavicon: setFavicon,
    isSkin: isSkin,
  };

  try {
    var cached = localStorage.getItem('pan-skin');
    if (isSkin(cached)) setFavicon(cached);
  } catch (e) {}
})();
