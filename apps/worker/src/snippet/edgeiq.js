// EdgeIQ analytics snippet — 2KB, no cookies, no PII
(function () {
  var endpoint = location.origin + '/collect';

  function send() {
    var data = { path: location.pathname + location.search, referrer: document.referrer };
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true,
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', send);
  } else {
    send();
  }

  // SPA navigation support (history API)
  var _pushState = history.pushState;
  history.pushState = function () {
    _pushState.apply(this, arguments);
    send();
  };
  window.addEventListener('popstate', send);
})();
