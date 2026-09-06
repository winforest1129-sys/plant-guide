/* ═══════════════════════════════════════════════════════════════
   昼と夜の切り替え（2026-09-06）
   ⭐ style.css の :root[data-theme="light"] / :root[data-theme="dark"] を
      立てたり外したりするだけの小さな道具。色の中身は style.css 側にある。
   ⭐ 3段：端末に合わせる → 昼 → 夜 → 端末に合わせる …とまわる。
      選んだものは、その端末（localStorage）に覚えておく。
   ⚠ かならず <head> で、defer を付けずに読みこむこと。
      本文より先に data-theme を立てないと、一瞬だけちがう色が見えてしまう。
   ⭐ ボタンの置き場所＝いちばん上の .sitenav の右はし。
      .sitenav が無いページ（index.html）は .masthead の中。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var KEY = "pg-theme";
  var ORDER = ["auto", "light", "dark"];
  var LABEL = { auto: "🌗 端末", light: "☀ 昼", dark: "☾ 夜" };
  var PLAIN = { auto: "端末に合わせる", light: "昼（ライト）", dark: "夜（ダーク）" };

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return (v === "light" || v === "dark") ? v : "auto";
    } catch (e) {
      return "auto";                     /* 保存が使えない端末でも動くように */
    }
  }

  function save(v) {
    try {
      if (v === "auto") { localStorage.removeItem(KEY); } else { localStorage.setItem(KEY, v); }
    } catch (e) { /* 覚えられないだけ。切り替えそのものは効く */ }
  }

  function apply(v) {
    var r = document.documentElement;
    if (v === "auto") { r.removeAttribute("data-theme"); } else { r.setAttribute("data-theme", v); }
  }

  var mode = read();
  apply(mode);                           /* ← ここが <head> で走る（ちらつき防止） */

  function next(v) { return ORDER[(ORDER.indexOf(v) + 1) % ORDER.length]; }

  function paint(btn) {
    btn.textContent = LABEL[mode];
    btn.title = "いまは「" + PLAIN[mode] + "」。押すと「" + PLAIN[next(mode)] + "」になるよ";
    btn.setAttribute("aria-label", btn.title);
  }

  function build() {
    var host = document.querySelector(".sitenav") || document.querySelector(".masthead");
    if (!host) { return; }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "back theme-btn";
    btn.addEventListener("click", function () {
      mode = next(mode);
      apply(mode);
      save(mode);
      paint(btn);
    });
    paint(btn);
    host.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }
})();
