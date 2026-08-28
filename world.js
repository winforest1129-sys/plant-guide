/* 世界のふるさとマップ（world.html）── 2026-08-28・300種のお祝いに
   ------------------------------------------------------------------
   ・共有の map.svg を1回とってきて、ふるさとの子がいる区画を緑に塗る。
   ・ホイール／2本指でいくらでも拡大、ドラッグ／1本指で移動、押した国の子を下に出す。
   ・データ（区画→子の番号）は world.html の中に埋めこんである（build_world.py が作る）。
   ⚠ マウスと指の分けかたは、必ず e.pointerType で見る（機種名で分けない）。
     ── zoom.js で一度ハマって覚えたきまり。 */
(function () {
  var stage = document.getElementById("wm-stage");
  var box = document.getElementById("wm-data");
  if (!stage || !box || !window.fetch) return;

  var canvas = document.getElementById("wm-canvas");
  var panel = document.getElementById("wm-panel");
  var tip = document.getElementById("wm-tip");
  var load = document.getElementById("wm-load");
  var zlabel = document.getElementById("wm-zoom");

  var data;
  try { data = JSON.parse(box.textContent); } catch (e) { return; }

  var RATIO = 394.444 / 1000;      /* map.svg の viewBox の たて / よこ */
  var MINK = 1, MAXK = 40;
  var k = 1, tx = 0, ty = 0, baseW = 0;
  var byId = {};                   /* 区画コード → path */
  var sel = null;                  /* いま押している区画コード */
  var wide = true;                 /* true＝国ぜんぶ / false＝県・省だけ */

  /* ---------------------------------------------------------- 小さな道具 */
  function ids(cc) { var s = data.r[cc]; return s ? s.split(",") : []; }
  function gids(cc) { var s = data.g[cc]; return s ? s.split(",") : []; }
  function parent(cc) { var i = cc.indexOf("-"); return i > 0 ? cc.slice(0, i) : cc; }
  function listOf(cc) { return data.g[cc] ? gids(cc) : ids(cc); }
  function nameOf(cc) {
    if (data.c[cc]) return data.c[cc];
    var p = byId[cc];
    return (p && p.getAttribute("data-ja")) || cc;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ---------------------------------------------------------- 地図を出す */
  fetch("map.svg")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (svg) {
      canvas.innerHTML = svg;
      if (load) load.parentNode.removeChild(load);
      var paths = canvas.querySelectorAll("path.c");
      Array.prototype.forEach.call(paths, function (p) { byId[p.id] = p; });
      var b = data.b;
      Object.keys(data.r).forEach(function (cc) {
        var p = byId[cc];
        if (!p) return;
        var n = ids(cc).length;
        p.classList.add("on");
        p.classList.add(n <= b[0] ? "q1" : n <= b[1] ? "q2" : n <= b[2] ? "q3" : "q4");
      });
      measure();
      reset();
      wire();
    })
    .catch(function (e) {
      if (load) load.textContent = "地図を読み込めなかったよ。ごめんね。";
      console.warn("world.js:", e);
    });

  /* ---------------------------------------------------------- 拡大と移動 */
  function measure() { baseW = stage.clientWidth; }

  function apply() {
    canvas.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + k + ")";
    if (zlabel) zlabel.textContent = "×" + (k < 9.95 ? k.toFixed(1) : Math.round(k));
  }

  function clamp() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var w = baseW * k, h = baseW * RATIO * k;
    tx = w <= sw ? (sw - w) / 2 : Math.min(0, Math.max(sw - w, tx));
    ty = h <= sh ? (sh - h) / 2 : Math.min(0, Math.max(sh - h, ty));
  }

  function reset() { k = 1; tx = 0; ty = 0; clamp(); apply(); }

  function zoomAt(sx, sy, nk) {
    nk = Math.max(MINK, Math.min(MAXK, nk));
    var wx = (sx - tx) / k, wy = (sy - ty) / k;
    k = nk; tx = sx - wx * k; ty = sy - wy * k;
    clamp(); apply();
  }

  function zoomMid(f) { zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, k * f); }

  /* その区画（国なら県・省ぜんぶ）を囲む四角を、画面の px で返す */
  function boxOf(cc) {
    var codes = data.g[cc]
      ? Object.keys(byId).filter(function (id) { return parent(id) === cc; })
      : [cc];
    var s = baseW / 1000, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    codes.forEach(function (id) {
      var p = byId[id];
      if (!p || !p.getBBox) return;
      var bb;
      try { bb = p.getBBox(); } catch (e) { return; }
      if (!bb.width && !bb.height) return;
      x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y);
      x1 = Math.max(x1, bb.x + bb.width); y1 = Math.max(y1, bb.y + bb.height);
    });
    if (x1 < x0) return null;
    return { x: x0 * s, y: y0 * s, w: (x1 - x0) * s, h: (y1 - y0) * s };
  }

  /* えらんだ国まで、地図を飛ばす */
  function flyTo(cc) {
    var bb = boxOf(cc);
    if (!bb || !bb.w || !bb.h) return;
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var nk = Math.min(sw / (bb.w * 1.7), sh / (bb.h * 1.7));
    k = Math.max(MINK, Math.min(MAXK, nk));
    tx = sw / 2 - (bb.x + bb.w / 2) * k;
    ty = sh / 2 - (bb.y + bb.h / 2) * k;
    clamp(); apply();
  }

  /* ---------------------------------------------------------- えらぶ・見せる */
  var EMPTY = '<p class="wm-empty">地図の<b>緑のところ</b>を押してみて。その国からきた子が、ここに出るよ。</p>';

  function select(cc, keepWide) {
    if (!keepWide) wide = true;
    Array.prototype.forEach.call(canvas.querySelectorAll("path.sel"), function (p) {
      p.classList.remove("sel");
    });
    sel = cc;
    if (cc) {
      var showing = showingCode();
      if (data.g[showing]) {
        Object.keys(byId).forEach(function (id) {
          if (parent(id) === showing) byId[id].classList.add("sel");
        });
      } else if (byId[showing]) {
        byId[showing].classList.add("sel");
      }
    }
    render();
  }

  function showingCode() {
    if (!sel) return null;
    var par = parent(sel);
    return (par !== sel && !wide) ? sel : par;
  }

  function render() {
    if (!sel) { panel.innerHTML = EMPTY; return; }
    var showing = showingCode();
    var list = listOf(showing);
    var par = parent(sel), sub = (par !== sel);

    var h = '<div class="wm-panel-head">' +
      '<h2 class="wm-panel-name">' + esc(nameOf(showing)) + "</h2>" +
      '<p class="wm-panel-n">この地図では <b>' + list.length + "</b> 件</p>";
    if (sub) {
      var other = wide ? sel : par;
      h += '<button type="button" class="wm-toggle" data-cc="' + esc(other) + '">' +
        (wide ? esc(nameOf(sel)) + "だけで見る" : esc(nameOf(par)) + "ぜんぶで見る") +
        "（" + listOf(other).length + "）</button>";
    }
    h += "</div>";

    if (!list.length) {
      h += '<p class="wm-empty">この国をふるさとにしている子は、まだ図鑑にいないんだ。' +
        "<b>いつか、ここにも誰か来るといいね。</b></p>";
    } else {
      h += '<ol class="index-list wm-plants">';
      list.forEach(function (id) {
        var p = data.p[id] || ["", "", ""];
        h += '<li><a href="p/' + id + '.html">' +
          '<span class="idx-no">No.' + id + "</span>" +
          '<span class="idx-name">' + esc(p[0]) + "</span>" +
          '<span class="idx-lead"></span>' +
          '<span class="idx-meta">' + esc(p[1]) + (p[2] ? " &middot; " + esc(p[2]) : "") + "</span>" +
          "</a></li>";
      });
      h += "</ol>";
      h += '<p class="wm-panel-foot">⚠ この一覧は<b>地図の緑</b>にそろえてあるよ。' +
        "「ヨーロッパ」「汎熱帯」のように<b>ひろい範囲でまとめて塗った子</b>もいるから、" +
        "くわしいことは、それぞれのページの 🌍 の下の文を見てね。</p>";
    }
    panel.innerHTML = h;
    panel.scrollIntoView({ block: "nearest" });
  }

  /* ---------------------------------------------------------- そうさ */
  function wire() {
    var pts = {}, pan = null, pinch = null, moved = false, downPath = null;

    function pos(e) {
      var r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function two() {
      var ks = Object.keys(pts);
      return [pts[ks[0]], pts[ks[1]]];
    }
    function dist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }

    stage.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pts[String(e.pointerId)] = { x: e.clientX, y: e.clientY };
      var n = Object.keys(pts).length;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      if (n === 1) {
        moved = false;
        downPath = e.target && e.target.closest ? e.target.closest("path.c") : null;
        pan = { x: e.clientX, y: e.clientY, ly: e.clientY, tx: tx, ty: ty, id: String(e.pointerId), mode: "map" };
        pinch = null;
        stage.classList.add("drag");
      } else if (n === 2) {
        /* 2本目が触れたら、それは「押した」ではなく「つまんだ」*/
        pan = null; moved = true;
        var p2 = two(), r = stage.getBoundingClientRect();
        pinch = {
          d: dist(p2[0], p2[1]), k: k, tx: tx, ty: ty,
          mx: (p2[0].x + p2[1].x) / 2 - r.left,
          my: (p2[0].y + p2[1].y) / 2 - r.top
        };
      }
      if (e.pointerType !== "mouse") e.preventDefault();
    });

    stage.addEventListener("pointermove", function (e) {
      var id = String(e.pointerId);
      if (pts[id]) { pts[id].x = e.clientX; pts[id].y = e.clientY; }

      if (pinch && Object.keys(pts).length >= 2) {
        var p2 = two(), d = dist(p2[0], p2[1]);
        if (!d || !pinch.d) return;
        var r = stage.getBoundingClientRect();
        var mx = (p2[0].x + p2[1].x) / 2 - r.left, my = (p2[0].y + p2[1].y) / 2 - r.top;
        var nk = Math.max(MINK, Math.min(MAXK, pinch.k * (d / pinch.d)));
        var wx = (pinch.mx - pinch.tx) / pinch.k, wy = (pinch.my - pinch.ty) / pinch.k;
        k = nk; tx = mx - wx * k; ty = my - wy * k;
        clamp(); apply();
        return;
      }

      if (pan && id === pan.id) {
        var dx = e.clientX - pan.x, dy = e.clientY - pan.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 8) {
          moved = true;
          /* ⭐ここが大事（2026-08-28）：地図は touch-action:none だから、指のなぞりは
             ぜんぶ地図が受けとってしまう。でも ×1.0 のときは 地図はたてに動けない
             ＝「なぞってもどこも動かない」＝ページが固まったように見える。
             だから、たてに動けないときの たてなぞりは、ページのスクロールにゆずる。
             ⚠ マウスは分けない（ホイールでスクロールできるから）。*/
          var canPanY = (baseW * RATIO * k) > stage.clientHeight + 1;
          pan.mode = (!canPanY && Math.abs(dy) > Math.abs(dx) && e.pointerType !== "mouse")
            ? "page" : "map";
        }
        if (moved && pan.mode === "page") {
          /* ⚠ style.css の html{scroll-behavior:smooth} が効くと、指の動きに
             ぬるっと遅れてついてくる（実測：検算では動いてすらいなかった）。
             指でつまんで動かすものだから、ここは instant を指定する。*/
          try { window.scrollBy({ left: 0, top: pan.ly - e.clientY, behavior: "instant" }); }
          catch (err) { window.scrollBy(0, pan.ly - e.clientY); }
          pan.ly = e.clientY;
        } else if (moved) {
          tx = pan.tx + dx; ty = pan.ty + dy; clamp(); apply();
        }
        return;
      }

      /* ここから下は、マウスで ただ動かしているとき（指では出さない） */
      if (e.pointerType !== "mouse" || !tip) return;
      var p = e.target && e.target.closest ? e.target.closest("path.c") : null;
      if (!p) { tip.hidden = true; return; }
      var n = ids(p.id).length;
      var par = parent(p.id);
      var label = data.c[par] ? data.c[par] + "・" + nameOf(p.id) : nameOf(p.id);
      tip.textContent = label + "　" + (n ? n + " 件" : "まだいないよ");
      tip.hidden = false;
      var q = pos(e);
      var w = tip.offsetWidth, hh = tip.offsetHeight;
      tip.style.left = Math.max(2, Math.min(stage.clientWidth - w - 2, q.x + 14)) + "px";
      tip.style.top = Math.max(2, Math.min(stage.clientHeight - hh - 2, q.y + 16)) + "px";
    });

    function up(e) {
      var id = String(e.pointerId);
      if (!(id in pts)) return;
      delete pts[id];
      var left = Object.keys(pts);
      if (pinch && left.length < 2) pinch = null;
      if (pan && id === pan.id) {
        var wasTap = !moved;
        pan = null;
        if (wasTap && !left.length) select(downPath ? downPath.id : null);
      }
      /* つまんだ指を1本だけ離したときは、残った指でそのまま移動を続ける */
      if (!pinch && left.length === 1 && !pan) {
        pan = { x: pts[left[0]].x, y: pts[left[0]].y, ly: pts[left[0]].y, tx: tx, ty: ty, id: left[0], mode: "map" };
        moved = true;
      }
      if (!left.length) { moved = false; stage.classList.remove("drag"); }
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse" && tip) tip.hidden = true;
    });
    /* 指の長押しで「コピー/保存しますか？」を出さない（PCの右クリックは今までどおり） */
    stage.addEventListener("contextmenu", function (e) {
      if (Object.keys(pts).length) e.preventDefault();
    });

    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      var q = pos(e);
      var f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018));
      zoomAt(q.x, q.y, k * f);
    }, { passive: false });

    /* キーボードでも動かせるように */
    stage.setAttribute("tabindex", "0");
    stage.addEventListener("keydown", function (e) {
      var step = 40;
      if (e.key === "ArrowLeft") tx += step;
      else if (e.key === "ArrowRight") tx -= step;
      else if (e.key === "ArrowUp") ty += step;
      else if (e.key === "ArrowDown") ty -= step;
      else if (e.key === "+" || e.key === "=") { zoomMid(1.4); return; }
      else if (e.key === "-" || e.key === "_") { zoomMid(1 / 1.4); return; }
      else if (e.key === "0") { reset(); return; }
      else return;
      e.preventDefault(); clamp(); apply();
    });

    var bi = document.getElementById("wm-in"),
        bo = document.getElementById("wm-out"),
        br = document.getElementById("wm-reset");
    if (bi) bi.addEventListener("click", function () { zoomMid(1.5); });
    if (bo) bo.addEventListener("click", function () { zoomMid(1 / 1.5); });
    if (br) br.addEventListener("click", function () { reset(); select(null); });

    /* 「◯◯だけで見る」／「◯◯ぜんぶで見る」の切りかえ */
    panel.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".wm-toggle") : null;
      if (!b) return;
      wide = !wide;
      select(sel, true);
    });

    /* 国の名前の一覧から えらぶ */
    var picks = document.getElementById("wm-picks");
    if (picks) {
      picks.addEventListener("click", function (e) {
        var b = e.target && e.target.closest ? e.target.closest(".wm-pick") : null;
        if (!b) return;
        var cc = b.getAttribute("data-cc");
        select(cc);
        flyTo(showingCode());
        stage.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
    var q = document.getElementById("wm-q"), nohit = document.getElementById("wm-nohit");
    if (q && picks) {
      q.addEventListener("input", function () {
        var s = q.value.trim().toUpperCase(), hit = 0;
        Array.prototype.forEach.call(picks.querySelectorAll(".wm-pick"), function (b) {
          var ok = !s || b.textContent.toUpperCase().indexOf(s) >= 0 ||
                   b.getAttribute("data-cc").indexOf(s) >= 0;
          b.parentNode.hidden = !ok;
          if (ok) hit++;
        });
        if (nohit) nohit.hidden = !!hit;
      });
    }

    var t;
    window.addEventListener("resize", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var old = baseW || 1;
        measure();
        var f = baseW / old;
        tx *= f; ty *= f;
        clamp(); apply();
      }, 120);
    });
  }
})();
