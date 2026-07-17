/* 原産地マップ
   ページ側は  <div class="g-map" data-cc="JP,CN,TW,PH"></div>  と書くだけ。
   共有の map.svg を1回だけ取ってきて（2枚目以降はブラウザのキャッシュが効く）、
   data-cc に並べた国コードの国を緑に塗る。
   JSが動かないときは、写真がそのまま出るだけで、ページは壊れない。 */
(function () {
  var slots = document.querySelectorAll(".g-map[data-cc]");
  if (!slots.length || !window.fetch) return;

  fetch("../map.svg")
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    })
    .then(function (svg) {
      Array.prototype.forEach.call(slots, function (el) {
        el.innerHTML = svg;
        /* data-cc="?" ＝ 名前が分からない子。塗らずに、まんなかに大きな「？」を出す。
           （「出さない」んじゃなくて「分からない」ことを見せる＝図鑑の「宿題」の席と同じ考え） */
        if ((el.getAttribute("data-cc") || "").trim() === "?") {
          el.classList.add("unknown");
          var q = document.createElement("div");
          q.className = "g-map-unknown";
          q.setAttribute("aria-label", "原産地は分かっていない");
          q.textContent = "？";
          el.appendChild(q);
          return;
        }
        var missing = [];
        (el.getAttribute("data-cc") || "").split(",").forEach(function (cc) {
          cc = cc.trim();
          if (!cc) return;
          var p = el.querySelector('[id="' + cc + '"]');
          if (p) p.classList.add("on");
          else missing.push(cc);
        });
        if (missing.length) console.warn("map.js: 地図に無い国コード:", missing.join(","));
      });
    })
    .catch(function (e) {
      Array.prototype.forEach.call(slots, function (el) {
        el.innerHTML = '<p class="g-map-load">地図を読み込めなかったよ。ごめんね。</p>';
      });
      console.warn("map.js:", e);
    });
})();
