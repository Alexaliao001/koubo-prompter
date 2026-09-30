// 离线缓存：开着网络打开一次后，之后断网或打不开 github.io 也能用
const CACHE = 'koubo-v3';
const CORE = ['./', 'index.html', 'vosk.js', 'manifest.json', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 带超时的联网请求：国内网络访问 github.io 常常卡住不报错，超时就用缓存
function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((r) => { clearTimeout(t); resolve(r); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // 语音模型由识别库自己存在 IndexedDB 里，这里不重复缓存
  if (url.pathname.includes('model-cn')) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
  if (isPage) {
    // 页面：先联网拿新版（最多等 3 秒），拿不到就用缓存
    e.respondWith(
      fetchWithTimeout(req, 3000)
        .then((r) => {
          if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put('index.html', copy)); }
          return r;
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('./')))
    );
    return;
  }
  // 其他文件：缓存优先
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return r;
    }))
  );
});
