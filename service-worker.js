/**
 * SIPS - Service Worker
 * Strategi: Cache First untuk aset app-shell, dengan fallback ke network.
 * Semua data transaksi (santri, pelanggaran, dll) TETAP di localStorage
 * pada thread utama -- service worker ini HANYA meng-cache file statis
 * (HTML/manifest/ikon) supaya aplikasi bisa dibuka tanpa internet.
 */

const CACHE_NAME = 'sips-cache-v1'; // Naikkan angka versi ini setiap kali ada update besar pada index_sips.html

// Sesuaikan path ini jika nama/lokasi file berbeda di server Anda
const APP_SHELL = [
  './',
  './index_sips.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// --- INSTALL: simpan app-shell ke cache ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // langsung aktifkan versi SW baru tanpa menunggu tab ditutup
  );
});

// --- ACTIVATE: bersihkan cache versi lama ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // ambil alih kontrol tab yang sudah terbuka
  );
});

// --- FETCH: Cache First, fallback ke Network, fallback terakhir ke index_sips.html (mode offline) ---
self.addEventListener('fetch', (event) => {
  // Hanya tangani request GET (biarkan request lain lewat apa adanya)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Simpan salinan response yang berhasil ke cache untuk pemakaian offline berikutnya
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline & tidak ada di cache -> tampilkan halaman utama sebagai fallback (untuk navigasi)
          if (event.request.mode === 'navigate') {
            return caches.match('./index_sips.html');
          }
        });
    })
  );
});

// --- (Opsional) Terima pesan dari halaman untuk memaksa update SW tanpa menunggu ---
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
