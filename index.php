<?php
// QRIS Dynamic Generator - XAMPP/local browser app
?><!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>QRIS Dynamic Generator</title>
  <link rel="stylesheet" href="assets/style.css?v=4">
</head>
<body>
<header class="topbar">
  <div class="brand">
    <div class="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4ZM8 8h8v8H8V8Zm2 2v4h4v-4h-4Z"/></svg>
    </div>
    <strong>QRIS Dynamic Generator</strong>
  </div>
  <div class="header-contact">
    <span>● &nbsp; PT. IMPE</span>
    <span>☎ &nbsp; +123-456-7890</span>
  </div>
</header>

<main class="page-shell">
  <div class="dashboard-grid">
    <div class="left-column">
      <section class="card card-upload">
        <div class="section-heading">
          <span class="step">01</span>
          <div><h2>QRIS Original</h2><p>Masukkan payload QRIS atau scan foto QRIS langsung dari perangkat kamu.</p></div>
        </div>

        <label class="dropzone" id="dropzone">
          <input type="file" id="qrImage" accept="image/*" hidden>
          <div class="upload-cloud">↥</div>
          <strong>Drag &amp; Drop foto QRIS di sini</strong>
          <span>atau <b>klik untuk memilih foto</b></span>
          <small>Format: JPG, PNG, WEBP · Maks. 5MB</small>
        </label>
        <div id="scanStatus" class="status hidden"></div>

        <div class="divider"><span>ATAU MASUKKAN PAYLOAD MANUAL</span></div>
        <div class="field-head"><label for="payloadInput">QRIS Payload</label><span id="payloadCount">0 karakter</span></div>
        <textarea id="payloadInput" rows="4" placeholder="Tempelkan payload QRIS di sini..."></textarea>
        <small class="help">Payload QRIS akan diproses otomatis.</small>
        <button id="loadBtn" class="visually-hidden" type="button">Load QRIS</button>
        <div id="loadStatus" class="status hidden"></div>
      </section>

      <section class="card payment-card">
        <div class="section-heading">
          <span class="step">02</span>
          <div><h2>Pengaturan Pembayaran</h2><p>Atur nominal pembayaran dan opsi biaya layanan.</p></div>
        </div>

        <div class="form-grid">
          <div class="field">
            <div class="field-head"><label for="merchantName">Merchant Name</label><span id="merchantCount">0 / 25</span></div>
            <input id="merchantName" maxlength="25" placeholder="Akan terisi otomatis">
          </div>
          <div class="field">
            <div class="field-head"><label for="nmidValue">NMID</label><span>Otomatis</span></div>
            <input id="nmidValue" readonly placeholder="Akan terisi otomatis">
          </div>
        </div>

        <div class="field hidden-preserve">
          <input id="cityName" maxlength="15" placeholder="Nama kota"><span id="cityCount">0 / 15</span>
          <input id="postalCode" maxlength="10" placeholder="Kode pos"><span id="postalCount">0 / 10</span>
        </div>

        <div class="field">
          <div class="field-head"><label for="amount">Nominal Pembayaran</label><span>Opsional · Maks. Rp10.000.000</span></div>
          <input id="amount" inputmode="numeric" placeholder="Kosongkan jika nominal tidak ditentukan">
          <small class="help">Kosongkan untuk membuat QRIS tanpa nominal tetap. Jika diisi, QRIS akan menjadi dynamic.</small>
        </div>

        <div class="field">
          <div class="field-head"><label for="feeType">Biaya Layanan</label><span>Opsional</span></div>
          <div class="form-grid">
            <select id="feeType">
              <option value="none">Tanpa biaya</option>
              <option value="fixed">Biaya tetap (Rp)</option>
              <option value="percent">Persentase (%)</option>
            </select>
            <input id="feeValue" inputmode="decimal" placeholder="Nilai biaya (Rp)" disabled>
          </div>
        </div>

        <button id="generateBtn" class="btn btn-primary" type="button">⌄ &nbsp; Generate QRIS</button>
        <div id="generateStatus" class="status hidden"></div>

        <div class="info-box"><span class="info-icon">✓</span><div><strong>Informasi</strong><p>Merchant Name dan NMID diambil otomatis dari QRIS original untuk menjaga kesesuaian data.</p></div></div>
      </section>
    </div>

    <aside class="card preview-card">
      <div class="section-heading preview-heading">
        <span class="step">03</span>
        <div><h2>Preview QRIS</h2><p>Preview hasil QRIS yang akan digenerate.</p></div>
      </div>

      <div class="poster-wrap" id="previewBox">
        <div id="emptyPreview" class="empty-preview"><strong>Belum ada QRIS</strong><small>Scan QRIS original lalu klik Generate QRIS.</small></div>
        <canvas id="qrCanvas" width="1448" height="2048" class="hidden template-canvas"></canvas>
      </div>

      <div class="preview-actions">
        <button id="downloadBtn" class="btn btn-outline hidden" type="button">⇩ &nbsp; Download PNG</button>
        <button id="printBtn" class="btn btn-outline btn-print hidden" type="button">▣ &nbsp; Cetak</button>
      </div>

      <details class="payload-details">
        <summary>Detail payload</summary>
        <div class="payload-box"><strong>GENERATED PAYLOAD</strong><code id="generatedPayload">-</code></div>
        <div class="payload-box"><strong>ORIGINAL PAYLOAD</strong><code id="originalPayload">-</code></div>
      </details>
    </aside>
  </div>
</main>
<footer>QRIS Dynamic Generator © 2026</footer>

<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="assets/qrcode-engine.js"></script>
<script src="assets/app.js?v=4"></script>
</body>
</html>
