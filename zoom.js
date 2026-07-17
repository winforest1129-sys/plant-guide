/* 押しているあいだの拡大窓（虫めがね）
   ・マウス＝左ボタンを押しているあいだ
   ・スマホ＝指を置いてすこし待つ（すぐ動かしたときはスクロールとみなして、拡大しない）
   ・写真（.g-img）でも 地図（.g-map）でも効く。いま表示されている1枚を複製して拡大する。
   ・JSが動かなければ、写真がふつうに出るだけ。ページは壊れない。

   ⭐マウスと指で、ふるまいを変えている（2026-07-17）
     「どの端末か」ではなく「いま何で触っているか」で分ける ＝ e.pointerType。
     ⚠機種名（ユーザーエージェント）で分けてはいけない：新しい機種で壊れるし、
       タッチとマウスの両方が使えるPCだと破綻する。pointerType なら、
       同じページで指とマウスが混ざっても正しく動く。
     ・マウス → 押した瞬間に開く／窓はカーソルの真上（カーソルは点なので隠れない）
     ・指   → すこし待ってから開く／窓を指の上へ持ち上げる
       （燻太さんが実機で発見：指が太いので、窓の中心＝見たいところに指が重なる。
         iPhoneの虫めがねと同じ手＝「指は見たい場所を指したまま、窓だけ上へどく」） */
(function () {
  var ZOOM = 2.8;        // 拡大率
  var HOLD = 240;        // スマホで「押した」と認める時間(ms)
  var SLOP = 12;         // その間にこれ以上動いたら、スクロールだと判断する(px)
  var GAP  = 10;         // 指のとき、窓の下のふちを 指から何px 離すか

  function setup(mount) {
    if (!mount.querySelector(".g-img, .g-map, img")) return;
    mount.classList.add("zoomable");

    var lens = null, on = false, timer = null, sx = 0, sy = 0, pid = null, ptype = "mouse";

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

      // 指のときだけ、窓を持ち上げる（窓の下のふちが 指の GAP px 上にくる）。
      // ⭐窓の中身は動かさない＝「窓の中心に写るのは、指が触っている場所」のまま。
      //   だから「指で見たい場所を指したまま、窓だけ上へどく」になる。
      var lift = (ptype === "mouse") ? 0 : (R + GAP);

      lens.style.left = (b.pl + x - R) + "px";
      lens.style.top  = (b.pt + y - R - lift) + "px";
      var inner = lens.firstChild;
      inner.style.left = (R - x * ZOOM) + "px";
      inner.style.top  = (R - y * ZOOM) + "px";
    }

    function close() {
      clearTimeout(timer); timer = null;
      // ⭐lens 変数だけでなく、DOMに残っている窓を「全部」片づける。
      //   万一どこかで迷子（誰も参照していない窓）が生まれても、次に閉じたときに掃除される＝安全網。
      Array.prototype.forEach.call(mount.querySelectorAll(".zoom-lens"), function (n) { n.remove(); });
      lens = null;
      mount.classList.remove("zooming");
      mount.removeEventListener("touchmove", noScroll);
      on = false; pid = null;
    }

    mount.addEventListener("pointerdown", function (e) {
      // ⚠ptype は「いちばん先に」覚える。右クリック（button!==0）で下の return に入っても、
      //   「いま触っているのはマウス」だと記録しておかないと、下の contextmenu の判定が
      //   前に触った指の値を引きずって、PCの右クリックまで殺してしまう。
      ptype = e.pointerType || "mouse";
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest && e.target.closest(".g-dot")) return;   // ボタンは押させる
      // ⭐⭐追いかけるのは、いつも1本だけ。2本目以降の指は、はじめから相手にしない。
      //   （2026-07-17・燻太さんが実機で発見：親指で虫めがねを出したまま、
      //     反対の手の親指で画面を押して最初の指を離すと、窓が増えて、しかも残った。
      //     原因＝ここで pid を無条件に上書きしていたので、2本目の指でも open() が走り、
      //     lens 変数が新しい窓に差し替わって、前の窓が「誰も持っていない迷子」になっていた。
      //     指を足すぶんだけ、何個でも増やせた。）
      if (pid !== null) return;
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

    // ⭐スマホの長押しで出る「画像をコピー／保存しますか？」のメニューを、指のときだけ止める。
    //   （2026-07-17・燻太さんの決定：「この図鑑は二人のための図鑑だから、図鑑から画像を
    //     コピーするつもりは今のところない。原本は自分達のPCにある。将来的に一般公開する
    //     ことになるまでは、拡大鏡の仕様を優先する」）
    //
    //   ⚠これは画像を守る仕掛けでは まったくない。/img/086.jpg を直接開けば誰でも見られるし、
    //     スクリーンショットも止められない。長押しが「虫めがね」と「ブラウザのメニュー」で
    //     取り合いになるのを、やめさせるだけ。**守れていると思ってはいけない。**
    //   ⚠一般公開するときに、ここは見直す約束。
    //
    //   ⚠なぜCSSだけでは足りないか：`-webkit-touch-callout:none`（style.cssにある）は
    //     **iOS Safari だけ**。**Android Chrome には効かない**ので、contextmenu を止める。
    //   ⚠マウスのときは止めない＝**PCの右クリックメニューは、今までどおり出る**。
    mount.addEventListener("contextmenu", function (e) {
      if (ptype !== "mouse") e.preventDefault();
    });

    // ⭐閉じるのも「追いかけている指」のときだけ。
    //   （そうしないと、2本目の指を離しただけで、1本目が出している窓が消えてしまう）
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) {
      mount.addEventListener(t, function (e) {
        if (pid !== null && e.pointerId !== pid) return;   // よその指のイベントは無視
        close();
      });
    });
    window.addEventListener("blur", close);   // 画面から離れたら、とにかく閉じる
  }

  Array.prototype.forEach.call(document.querySelectorAll(".specimen .mount"), setup);
})();
