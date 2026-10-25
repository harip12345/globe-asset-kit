# Globe utama: rute, subjek, dan kamera follow

Pembaruan 25 Oktober 2026. Implementasi ini belum dijalankan dalam tes otomatis atau render uji, sesuai permintaan pengguna. Pemeriksaan source dilakukan manual. Jangan menganggap laporan PASS dalam paket handoff atau `verification.json` sebagai validasi perubahan ini.

## Mulai dari contoh

- `scenes/follow-bird.json`: sprite godwit dari handoff, dua pose sayap, rute Alaska–Tasmania, kamera follow dan keyframe jarak. Tekstur globe lokal.
- `scenes/follow-satellite.json`: satelit ilustrasi mengikuti great-circle melintasi garis tanggal; tekstur lokal.
- `scenes/follow-ship.json`: kapal ilustrasi Bali–Lombok dengan citra detail online. Ukuran kapal, ketinggian jalur, dan durasi bukan skala fisik atau data pelayaran.

Pilih preset di editor, kemudian gunakan panel **Kamera** untuk mengikuti subjek. Panel **Konten** memilih rute bagi objek pertama dan ukuran perkiraan subjek di layar. JSON tetap menjadi master untuk beberapa objek dan keyframe jarak.

## Satu kurva untuk rute dan subjek

Contoh fragmen untuk dimasukkan ke scene versi 1 yang lengkap:

```json
{
  "routes": [{
    "id": "migrasi", "from": [60.3, -162], "to": [-42, 147.3],
    "color": "#ff755a", "start": 0, "end": 24,
    "altitude": 0.03, "width": 0.0012
  }],
  "objects": [{
    "id": "godwit", "type": "bird",
    "frames": ["assets/bird-tag-up.png", "assets/bird-tag-down.png"],
    "frameRate": 9, "scale": 0.07, "screenSize": 0.3,
    "followRoute": {"route": "migrasi", "orient": true, "easing": "linear"}
  }]
}
```

- `route` menerima ID atau indeks mulai nol. ID dianjurkan agar urutan array bisa diubah.
- Posisi diambil dari kurva great-circle yang juga dipakai membangun tube rute. Longitude melewati garis tanggal melalui lintasan terpendek; titik antipodal memiliki sumbu pilihan yang tetap.
- Waktu default `start` dan `end` berasal dari rute. Pada waktu di luar interval, objek bertahan di titik awal/akhir.
- `from` dan `to` dalam `followRoute` adalah **fraksi 0–1**, bukan koordinat. Misalnya `from: 0.12, to: 0.55` menampilkan bagian tengah perjalanan; `from: 1, to: 0` membalik arah.
- `altitudeOffset`, default 0, diukur dalam radius Bumi dan ditambahkan ke ketinggian rute. Saat mengikuti rute, `objects[].altitude` tidak menentukan lintasan. Offset 0 menempatkan pivot objek pada garis; tubuh model bisa melampaui garis karena ukurannya.
- `easing` default linear agar progres sama dengan ujung garis reveal bila waktunya sama. `smooth` menambah easing quintic pada **objek**; ujung garis masih mengikuti reveal linear. Timing atau fraksi berbeda memang bisa memisahkan subjek dari ujung reveal.
- `orient` default true: lokal +Y menjauhi Bumi dan lokal −Z menghadap arah gerak. `rotation: [x,y,z]` dalam derajat mengoreksi orientasi aset GLB. Sprite menghadap kamera, dengan gambar yang diasumsikan menghadap kanan dan rotasi mengikuti tangen di layar.
- `width` adalah radius tube dalam radius Bumi; default 0.0022. Gunakan lebar lebih kecil untuk close-up. `visible: false` menyembunyikan garis tanpa menghapus lintasannya.

Tanpa `followRoute`, posisi/orbit longitude lama tetap tersedia. Untuk subjek pada lintasan, `lat` dan `lon` tidak wajib.

## GLB dengan animasi

Ganti objek dalam contoh dengan fragmen berikut setelah **menyediakan sendiri** model dan lisensinya. File penyu pada contoh ini belum disertakan.

```json
{
  "id": "penyu", "type": "glb", "asset": "assets/models/penyu.glb",
  "scale": 0.04, "screenSize": 0.25,
  "animationClip": 0, "animationSpeed": 1, "animationOffset": 0,
  "rotation": [0, 0, 0],
  "followRoute": {"route": "migrasi", "orient": true}
}
```

GLB dinormalisasi berdasarkan dimensi terbesar. Clip dipilih dengan indeks atau nama; tanpa `animationClip`, clip pertama dipakai jika tersedia. Nama/indeks yang tidak ditemukan menghasilkan pesan kesalahan. Animasi memakai waktu absolut `(seconds + animationOffset) * animationSpeed`. Gunakan clip gerak di tempat; gerakan translasi yang tertanam dalam clip tetap dapat menggeser tubuh dari pivot lintasan. Draco/KTX2 belum didukung.

`screenSize` 0.01–0.8 mengatur **perkiraan dimensi terbesar** subjek sebagai fraksi tinggi viewport. Ukuran dihitung dari kedalaman kamera dan batas model pada pose awal; pose animasi, perspektif, dan rotasi bisa mengubah ukuran yang terlihat. Ini berguna agar subjek tidak terlalu kecil, tetapi bukan skala fisik. Hapus field tersebut untuk memakai `scale` dalam satuan dunia. Di editor, nilai 0 menghapus field.

## Kamera mengikuti objek

Tambahkan `follow` pada `camera` yang tetap memiliki `lat`, `lon`, `zoom`, `roll`, `keyframes` seperti scene lama:

```json
{
  "follow": {
    "object": "godwit",
    "distanceKm": 8000, "pitch": 25,
    "heading": "route", "lookAheadSeconds": 0,
    "keyframes": [
      {"time": 0, "distanceKm": 8000, "pitch": 25},
      {"time": 12, "distanceKm": 2200, "pitch": 40},
      {"time": 24, "distanceKm": 6000, "pitch": 25}
    ]
  }
}
```

- `object`: ID atau indeks objek. Bisa mengikuti traveller, objek statis, atau orbit bawaan.
- `distanceKm`: jarak kamera dari pivot subjek dalam **kilometer**, 0.05–60000. Berbeda dengan altitude objek/rute yang memakai radius Bumi.
- `pitch`: 0 melihat dari atas; hingga 75 menggeser kamera ke belakang arah gerak. Kamera menatap pivot atau posisi di depan, tanpa smoothing yang bergantung pada frame sebelumnya.
- `heading`: `north` menjaga orientasi utara lokal; `route` menempatkan arah perjalanan di bagian atas layar. `roll` kamera masih diterapkan.
- `lookAheadSeconds`: 0 menjaga pivot subjek di tengah. Nilai lebih besar menatap posisi masa depan sehingga subjek dapat bergeser dari tengah.
- Keyframe jarak menggunakan interpolasi logaritmik dan easing quintic; pitch diinterpolasi dengan easing yang sama. Di luar rentang keyframe, nilai ujung dipertahankan.
- Selama follow aktif, keyframe posisi kamera manual diabaikan. Mengubah kamera manual di editor keluar dari follow. Menerapkan kontrol follow dari UI mengganti keyframe follow dengan nilai statis; simpan JSON jika ingin menjaga rangkaian keyframe.

## Zoom detail dan ekspor

```json
"detail": {"enabled": true, "maxLevel": 18, "failureMode": "strict"}
```

Citra Esri dimuat saat kamera mendekat (ketinggian kamera di bawah sekitar 1800 km). Footprint diambil dari perpotongan sinar viewport dengan bola, termasuk kamera miring/follow. Tile memakai ukuran service 256 piksel; pemilihan level dibatasi 64 tile utama per tampilan. Tile induk dimuat untuk pengganti sementara, tile sebelumnya ditahan saat tampilan baru dimuat, unduhan yang tidak diperlukan dibatalkan, cache memori ditargetkan 192 entri, dan enam unduhan berjalan bersamaan. Cache bisa sementara lebih besar selama pergantian aktif.

- **strict** (default): ekspor menunggu tile utama yang diminta, lalu gagal jika tile tersebut tidak berhasil dimuat. Tidak menjamin citra asal lebih tajam daripada resolusi aktual lokasi itu.
- **fallback**: ekspor boleh melanjutkan dengan tile yang tersedia atau globe NASA. Hasil dapat lebih buram dan bergantung pada kondisi unduhan/cache.
- Tombol **Muat ulang tile yang gagal** mengulang permintaan gagal. Jangan menghapus sumber kredit pada gambar yang memakai citra Esri.
- Ini citra pada bola, tanpa geometri medan 3D, bukan terrain pesisir. Tidak ada dataset citra detail offline baru yang disertakan.

Untuk render deterministik kamera/animasi, panggil:

```js
await window.globeKit.applyConfig(config);
window.globeKit.resize(config.width, config.height);
await window.globeKit.prepareFrame(8);
const png = window.globeKit.exportPNG();
```

`setTime()` menampilkan preview segera; `prepareFrame()` menunggu citra online. Pixel dari service online tidak dijamin sama di masa depan. MP4 menggunakan API yang sama dan mencatat status citra serta peringatan pada `.render.json`.

```sh
node scripts/render.mjs --scene follow-bird --format mp4 --out exports/godwit-follow.mp4
node scripts/render.mjs --scene follow-ship --format png --time 8 --out exports/kapal-follow.png
```

Perintah di atas adalah petunjuk penggunaan dan **belum dijalankan untuk pembaruan ini**.

## Handoff godwit

Empat PNG asli disalin ke `assets/bird-*.png`. Sembilan scene asli disalin ke `scenes/`: `gw-s1`, `gw-B`, `gw-s2b`, `gw-D2b`, `gw-E2b`, `gw-s3b`, `gw-s4`, `gw-I2`, `gw-J2`, berurutan. Buka dengan tombol **Buka JSON**, atau gunakan nama scene pada CLI render. Komposisi dan kamera asli sembilan scene itu dipertahankan; `follow-bird` adalah contoh baru yang terpisah.

Format lama `assetUp/assetDown`, `from/to`, `f0/f1`, `start/end`, `flap`, dan `aspect` dinormalisasi saat dibaca ke `frames` dan `followRoute`. Rute dengan endpoint sama dipakai ulang; jika tidak ada, rute tersembunyi dibuat. `flap` berarti pergantian pose per detik (0 membekukan pose pertama). Aspek/skala lama dipertahankan. Bobbing sinus dari patch lama tidak disalin, agar pivot tetap di jalur pada altitude yang ditentukan; rotasi sprite juga memperhitungkan aspek viewport.

Patch dan README asal di `docs/handoff/` adalah arsip provenance; **jangan terapkan ulang patch tersebut**. Klaim PASS di sana berasal dari clone agent sebelumnya. Sprite merupakan ilustrasi 2D yang diberikan pengguna melalui handoff, bukan model hewan ber-rig atau aset referensi identik. Caption karaoke dan overlay naratif umum belum ditambahkan dalam tahap ini.
