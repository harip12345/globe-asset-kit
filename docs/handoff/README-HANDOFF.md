# Paket Handoff: objek "bird" untuk globe-asset-kit

Isi paket ini (semua perubahan LOKAL, belum di-commit/di-push ke GitHub):

1. `bird-object.patch` — patch untuk `src/config.js` dan `src/globe.js` yang menambah tipe objek baru `bird`.
   Terapkan dari root repo: `git apply bird-object.patch`
2. `assets/bird-*.png` — 4 sprite burung (godwit): pose sayap atas/bawah, versi polos dan versi dengan tag pelacak.
3. `scenes/gw-*.json` — 9 scene episode godwit yang sudah jadi (urutan: gw-s1, gw-B, gw-s2b, gw-D2b, gw-E2b, gw-s3b, gw-s4, gw-I2, gw-J2; masing-masing 5-6 detik, 720x1280 @24fps).

## Cara pakai objek bird di scene JSON

```json
{"type":"bird","from":[60.3,-162],"to":[-42,147.3],
 "f0":0.12,"f1":0.55,"start":0,"end":5,
 "altitude":0.03,"scale":0.07,"flap":9,"aspect":1.71,
 "assetUp":"assets/bird-tag-up.png","assetDown":"assets/bird-tag-down.png"}
```

- `from`/`to`: ujung jalur (great-circle, sama seperti rute).
- `f0`/`f1`: fraksi posisi sepanjang jalur pada awal/akhir scene (0 = titik `from`, 1 = titik `to`). Burung bergerak linear dari f0 ke f1 selama `start`..`end`.
- `flap`: frekuensi ganti pose sayap per detik (0 = diam pose pertama).
- `scale`: ukuran dalam unit radius Bumi (0.05-0.09 terbukti terbaca di zoom 0.95-1.9).
- Rotasi sprite otomatis mengikuti arah tangen jalur; posisi dihitung dari kurva yang sama dengan garis rute, jadi burung selalu tepat di atas garis.
- `lat`/`lon` pada objek diisi otomatis dari `from` (validasi bawaan menuntutnya).

## Status verifikasi

- `npm run check` PASS setelah patch diterapkan (25 Okt 2026).
- 4 scene ber-objek bird sudah dirender ke MP4 dan diperiksa frame-nya: burung tepat di garis rute, rotasi searah terbang.
- Batasan: sprite 2D (billboard menghadap kamera), bukan model 3D; satu ukuran per scene (ubah `scale` antar scene untuk close-up); kamera belum otomatis mengikuti objek (keyframe kamera diatur manual ke posisi burung).
