/* 押しているあいだの拡大窓（虫めがね）
   ・マウス＝左ボタンを押しているあいだ
   ・スマホ＝指を置いてすこし待つ（すぐ動かしたときはスクロールとみなして、拡大しない）
   ・写真（.g-img）でも 地図（.g-map）でも効く。いま表示されている1枚を複製して拡大する。
   ・JSが動かなければ、写真がふつうに出るだけ。ページは壊れない。 */
(function () {
  var ZOOM = 2.8;        // 拡大率
  var HOLD = 240;        // スマホで「押した」と認める時間(ms)
  var SLOP = 12;         // その間にこれ以上動いたら、スクロールだと判断する(px)

  function setup(mount) {
    if (!mount.querySelector(".g-img, .g-map, img")) return;
    mount.classList.add("zoomable");

    var lens = null, on = false, timer = null, sx = 0, sy = 0, pid = null;

    // いま見えている1枚（写真 or 地図）
    function current() {
      return mount.querySelector(".g-img.show, .g-map.show") ||
             mount.querySelector(".g-img, img");
    }
    // .mount の内側（パディングの内）を基準にした座標と大きさ
    function box() {
      var r = mount.getBoundingClientRect();
      var cs = getComputedStyle(mount);
      var pl = parseFloat(cs.paddingLeft) || 0, pt = parseFloat(cs.paddingTop) || 0;
      var pr = parseFloat(cs.paddingRight) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      return { left: r.left + pl, top: r.top + pt,
               w: r.width - pl - pr, h: r.height - pt - pb, pl: pl, pt: pt };
    }
    function noScroll(e) { if (on) e.preventDefault(); }

    function open(e) {
      var src = current(); if (!src) return;
      var b = box(); if (b.w <= 0) return;

      lens = document.createElement("div");
      lens.className = "zoom-lens";
      var inner = src.cloneNode(true);
      // .gallery .g-img{display:none} に負けないよう、複製には show を付ける
      inner.classList.add("show");
      inner.removeAttribute("id");
      // 複製した地図のなかの id は消す（同じ id がページに2つできないように）
      Array.prototype.forEach.call(inner.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
      inner.style.width = (b.w * ZOOM) + "px";
      inner.style.height = "auto";
      lens.appendChild(inner);
      mount.appendChild(lens);
      mount.classList.add("zooming");
      on = true;
      mount.addEventListener("touchmove", noScroll, { passive: false });
      move(e);
    }

    function move(e) {
      if (!lens) return;
      var b = box();
      var x = Math.max(0, Math.min(b.w, e.clientX - b.left));
      var y = Math.max(0, Math.min(b.h, e.clientY - b.top));
      var R = lens.offsetWidth / 2;
      lens.style.left = (b.pl + x - R) + "px";
      lens.style.top  = (b.pt + y - R) + "px";
      var inner = lens.firstChild;
      inner.style.left = (R - x * ZOOM) + "px";
      inner.style.top  = (R - y * ZOOM) + "px";
    }

    function close() {
      clearTimeout(timer); timer = null;
      if (lens) { lens.remove(); lens = null; }
      mount.classList.remove("zooming");
      mount.removeEventListener("touchmove", noScroll);
      on = false; pid = null;
    }

    mount.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest && e.target.closest(".g-dot")) return;   // ボタンは押させる
      pid = e.pointerId; sx = e.clientX; sy = e.clientY;
      if (e.pointerType === "mouse") { e.preventDefault(); open(e); }
      else { timer = setTimeout(function () { open(e); }, HOLD); }   // 指はすこし待つ
    });

    mount.addEventListener("pointermove", function (e) {
      if (pid !== null && e.pointerId !== pid) return;
      if (on) { move(e); return; }
      // まだ拡大していないのに大きく動いた＝スクロールしたい、とみなす
      if (timer && (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > SLOP)) {
        clearTimeout(timer); timer = null; pid = null;
      }
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
      mount.addEventListener(t, close);
    });
    window.addEventListener("blur", close);
  }

  Array.prototype.forEach.call(document.querySelectorAll(".specimen .mount"), setup);
})();
