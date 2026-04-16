# Virtual DOM Vue 3: Professor Notes for Real Understanding

Dokumen ini ditulis supaya kamu tidak hanya "hafal istilah", tapi benar-benar paham bagaimana Vue berpikir saat membaca template dan meng-update UI.

## 0) Cara kerja dari awal (tahap demi tahap)

Kalau dibaca dari nol, alurnya seperti ini:

1. Kamu menulis template di editor.
2. Template dikirim ke compiler Vue untuk di-parse.
3. Compiler membentuk AST (pohon sintaks).
4. Compiler menandai bagian static dan dynamic.
5. Compiler menghasilkan render function.
6. Render function dijalankan untuk menghasilkan VNode tree.
7. Pada render pertama, VNode dipasang ke DOM asli (mount).
8. Saat state berubah, render function dijalankan lagi dan membuat VNode baru.
9. Runtime membandingkan VNode lama vs VNode baru (diff).
10. Runtime mem-patch hanya bagian DOM yang memang berubah.

Versi yang lebih operasional di aplikasi explorer:

1. Aplikasi dibuka -> snippet terakhir dimuat dari IndexedDB.
2. Watcher template aktif -> proses compile dijalankan dengan debounce.
3. Hasil compile diubah menjadi node + edge untuk visual graph.
4. Statistik (Total, Dynamic, Static, Max Depth) dihitung dari node graph.
5. Saat kamu klik node, panel detail menampilkan metadata node itu.
6. Saat template kamu edit lagi, siklus compile -> graph -> detail berjalan ulang.

Ini adalah loop utama yang terus berulang selama kamu bereksperimen.

## 1) Satu kalimat inti

Virtual DOM di Vue adalah strategi untuk mengubah template menjadi struktur data yang bisa dianalisis dan di-update secara terarah, bukan menembak ulang seluruh DOM browser.

## 2) Mental model 4 lapis

Saat kamu menulis template, sebenarnya ada 4 lapis kerja:

1. Source template: string HTML + directive Vue yang kamu tulis.
2. AST (compile-time): pohon sintaks dari hasil parser compiler.
3. VNode tree (runtime): struktur node virtual dari render function.
4. Real DOM: elemen asli di browser.

Aplikasi explorer ini memvisualisasikan lapis AST yang sudah diperkaya metadata penting dari compiler. Ini membuat kita bisa "memprediksi" perilaku runtime sebelum patch benar-benar terjadi.

## 3) Pipeline kompilasi Vue (yang sering dilupakan)

Secara konsep, compiler Vue bekerja lewat fase ini:

1. Parse: template -> AST.
2. Transform: AST dianalisis dan diubah, termasuk pendeteksian bagian dinamis.
3. Generate: AST -> render function code.

Di runtime:

1. Render function dieksekusi menghasilkan VNode tree baru.
2. Runtime membandingkan VNode lama vs baru.
3. Patch dilakukan hanya di titik yang perlu.

Poin penting: optimization dimulai sejak compile-time, bukan hanya runtime.

## 4) Kenapa "static" dan "dynamic" itu krusial

### Static node

Node static adalah bagian yang tidak membawa ketergantungan reaktif langsung.

Contoh:

```vue
<h1>Welcome</h1>
```

Kalimat "Welcome" tidak tergantung state apa pun. Runtime dapat melewati node ini pada banyak update.

### Dynamic node

Node dynamic membawa ekspresi, binding, control flow, atau list rendering.

Contoh:

```vue
<h1>{{ title }}</h1>
```

Saat `title` berubah, node ini perlu dipertimbangkan saat patch.

Kesimpulan praktis:

- Banyak static node -> patch lebih murah.
- Banyak dynamic node -> runtime kerja lebih banyak.

## 5) Patch flags: bahasa singkat antara compiler dan renderer

Patch flag adalah sinyal dari compiler agar renderer tahu jenis perubahan apa yang mungkin terjadi.

Alih-alih memeriksa semua properti setiap update, renderer bisa fokus pada area tertentu (misalnya text saja, class saja, props tertentu).

Contoh intuitif:

- `TEXT`: cukup cek text content.
- `CLASS`: fokus class.
- `STYLE`: fokus style.
- `PROPS` / `FULL_PROPS`: fokus props.

Ini menjelaskan kenapa dua template yang terlihat mirip bisa punya biaya update berbeda.

## 6) Block tree dan dynamic children (konsep lanjutan)

Vue 3 menggunakan ide block tree:

1. Compiler menandai area yang mengandung dynamic nodes.
2. Runtime menyimpan daftar dynamic children untuk block tersebut.
3. Saat update, runtime tidak perlu menelusuri semua node secara merata.

Analogi: daripada memeriksa seluruh gedung, runtime sudah diberi daftar ruangan yang berpotensi berubah.

## 7) Hoisting static nodes (kenapa static sangat berharga)

Node static dapat di-hoist (diangkat) keluar dari alur render berulang.

Artinya:

- node static dibuat sekali,
- lalu direuse,
- bukan dibuat ulang setiap render.

Itu sebabnya template yang "clean" secara reaktivitas biasanya lebih ringan.

## 8) Maksud metrik di explorer

### Total

Jumlah seluruh node AST yang divisualisasikan.

### Dynamic

Jumlah node dengan indikasi reaktif (binding, interpolation, directive dinamis, patch flag non-statis, control flow).

### Static

Jumlah node yang relatif stabil dan tidak membawa dependency reaktif langsung.

### Max Depth

Kedalaman terbesar pohon node.

- Depth tinggi tidak selalu buruk.
- Tapi depth tinggi + dynamic tinggi biasanya meningkatkan kompleksitas reasoning dan patch.

## 9) Cara baca panel detail (urutan yang direkomendasikan)

1. Identity: kenali node (label, kind, tag).
2. Hierarchy: lihat posisi node (tree path, depth, parent-child).
3. Update Behavior: cek static/dynamic + patch flag.
4. Template Data: cek expression/directive/attribute.
5. Source Location: cocokkan kembali ke template asli.

Urutan ini meniru cara engineer performa membaca masalah update UI.

## 10) Tree path: alamat konseptual di pohon

Contoh `0.1.2` dibaca:

- `0`: root child pertama,
- `1`: child kedua dari node sebelumnya,
- `2`: child ketiga dari node tersebut.

Dengan ini kamu bisa:

- melacak node lintas perubahan,
- memahami sibling/ancestor,
- menjelaskan konteks update secara presisi.

## 11) Studi mini: dari template ke implikasi update

Template:

```vue
<section>
  <h1>{{ title }}</h1>
  <p>Static paragraph</p>
  <button :class="btnClass" @click="increment">Add</button>
</section>
```

Interpretasi:

1. `<p>Static paragraph</p>` cenderung static.
2. `{{ title }}` dynamic karena interpolation.
3. `:class` dan `@click` memberi sinyal dynamic pada button.
4. Parent bisa tetap punya kombinasi static + dynamic children.

Jadi bukan "komponen ini dynamic semua"; granularitas node sangat penting.

## 12) Batas penting: AST bukan runtime state penuh

Explorer AST sangat berguna untuk edukasi dan prediksi, tetapi:

- belum mengeksekusi scheduler,
- belum menunjukkan timing microtask,
- belum menunjukkan repaint/reflow browser.

Untuk analisis performa end-to-end, padukan dengan Vue DevTools dan Performance tab browser.

## 13) Checklist engineering saat membaca hasil explorer

1. Apakah node dynamic memang perlu dynamic?
2. Adakah binding yang bisa dipindah atau disederhanakan?
3. Apakah list rendering punya key stabil?
4. Apakah depth terlalu dalam tanpa kebutuhan domain?
5. Apakah conditional rendering bisa dipecah agar lebih jelas?

## 14) Ringkasan untuk diingat

1. Compiler memberi peta; runtime menjalankan peta.
2. Static vs dynamic adalah inti biaya patch.
3. Patch flag adalah hint optimasi paling bernilai.
4. Max depth mengukur bentuk hirarki, bukan otomatis masalah.
5. Pemahaman node-level lebih kuat daripada sekadar lihat komponen-level.

Jika kamu membaca explorer dengan pola di atas, kamu akan bisa menjelaskan bukan hanya "apa yang berubah", tapi "kenapa Vue memilih strategi update itu".
