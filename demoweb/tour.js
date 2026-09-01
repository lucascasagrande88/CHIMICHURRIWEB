/* ===========================================================================
   DVTour — Motor de tutorial guiado (coach-marks) sin dependencias.
   Uso:
     DVTour.start([
       { el:"#selector" | function(){return node}, title:"", text:"",
         placement:"auto"|"top"|"bottom"|"left"|"right", pad:8, before:fn },
       { title:"", text:"" }   // sin "el" => tarjeta centrada (bienvenida/cierre)
     ], { key:"dv_tour_home", onEnd:fn });
   DVTour.startedOnce(key) -> bool ; DVTour.mountFab(label, stepsFactory, key)
   =========================================================================== */
window.DVTour = (function () {
  "use strict";
  var mask, hi, pop, arrow;
  var steps = [], idx = 0, opts = {}, active = false;

  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function q(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
  function resolve(s) {
    if (!s.el) return null;
    if (typeof s.el === "function") { try { return s.el(); } catch (e) { return null; } }
    return q(s.el);
  }

  function ensureDom() {
    if (mask) return;
    mask = el("div", "dvt-mask");
    hi = el("div", "dvt-hi");
    arrow = el("div", "dvt-arrow");
    pop = el("div", "dvt-pop");
    pop.innerHTML =
      '<button class="dvt-skip" type="button" aria-label="Cerrar tutorial">✕</button>' +
      '<span class="dvt-badge"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="3.5"/></svg><span class="dvt-badge-txt">Tutorial</span></span>' +
      '<h4></h4><p></p>' +
      '<div class="dvt-foot"><span class="dvt-dots"></span>' +
      '<button class="dvt-btn dvt-back" type="button">Atrás</button>' +
      '<button class="dvt-btn dvt-next" type="button">Siguiente</button></div>';
    document.body.appendChild(mask);
    document.body.appendChild(hi);
    document.body.appendChild(arrow);
    document.body.appendChild(pop);

    pop.querySelector(".dvt-skip").addEventListener("click", end);
    pop.querySelector(".dvt-back").addEventListener("click", prev);
    pop.querySelector(".dvt-next").addEventListener("click", next);
    mask.addEventListener("click", function () {}); // bloquea clics del fondo
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true });
    document.addEventListener("keydown", onKey);
  }

  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") end();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
  }

  function scrollIntoView(node) {
    if (!node) return Promise.resolve();
    var r = node.getBoundingClientRect();
    var vh = window.innerHeight;
    var needs = r.top < 80 || r.bottom > vh - 80;
    if (needs) {
      var y = window.scrollY + r.top - (vh / 2 - r.height / 2);
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      return new Promise(function (res) { setTimeout(res, 420); });
    }
    return Promise.resolve();
  }

  function place(node) {
    var vw = window.innerWidth, vh = window.innerHeight;
    var isMobile = vw <= 640;
    var popW = pop.offsetWidth, popH = pop.offsetHeight;

    if (!node) {
      // Tarjeta centrada (sin objetivo)
      hi.classList.add("dvt-center");
      hi.style.width = "0px"; hi.style.height = "0px";
      hi.style.left = (vw / 2) + "px"; hi.style.top = (vh / 2) + "px";
      pop.style.left = Math.round((vw - popW) / 2) + "px";
      pop.style.top = Math.round((vh - popH) / 2) + "px";
      arrow.style.opacity = "0";
      return;
    }
    hi.classList.remove("dvt-center");
    var s = steps[idx], pad = (s && s.pad != null) ? s.pad : 8;
    var r = node.getBoundingClientRect();
    var top = Math.max(6, r.top - pad), left = Math.max(6, r.left - pad);
    var w = Math.min(vw - 12, r.width + pad * 2), h = r.height + pad * 2;
    hi.style.left = left + "px"; hi.style.top = top + "px";
    hi.style.width = w + "px"; hi.style.height = h + "px";

    if (isMobile) { arrow.style.opacity = "0"; return; } // el CSS lo fija abajo

    // Elegir ubicación
    var placement = (s && s.placement) || "auto";
    var spaceBelow = vh - (top + h), spaceAbove = top;
    var spaceRight = vw - (left + w), spaceLeft = left;
    if (placement === "auto") {
      if (spaceBelow > popH + 24) placement = "bottom";
      else if (spaceAbove > popH + 24) placement = "top";
      else if (spaceRight > popW + 24) placement = "right";
      else if (spaceLeft > popW + 24) placement = "left";
      else placement = "bottom";
    }
    var pl, pt, ax, ay, arot = "rotate(45deg)";
    var cx = left + w / 2, cy = top + h / 2, GAP = 16;
    if (placement === "bottom") {
      pt = top + h + GAP; pl = clamp(cx - popW / 2, 8, vw - popW - 8);
      ax = clamp(cx - 8, pl + 12, pl + popW - 20); ay = pt - 8;
    } else if (placement === "top") {
      pt = top - popH - GAP; pl = clamp(cx - popW / 2, 8, vw - popW - 8);
      ax = clamp(cx - 8, pl + 12, pl + popW - 20); ay = pt + popH - 8;
    } else if (placement === "right") {
      pl = left + w + GAP; pt = clamp(cy - popH / 2, 8, vh - popH - 8);
      ax = pl - 8; ay = clamp(cy - 8, pt + 12, pt + popH - 20);
    } else { // left
      pl = left - popW - GAP; pt = clamp(cy - popH / 2, 8, vh - popH - 8);
      ax = pl + popW - 8; ay = clamp(cy - 8, pt + 12, pt + popH - 20);
    }
    pop.style.left = Math.round(pl) + "px";
    pop.style.top = Math.round(pt) + "px";
    arrow.style.left = Math.round(ax) + "px";
    arrow.style.top = Math.round(ay) + "px";
    arrow.style.transform = arot;
    arrow.style.opacity = "1";
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function reposition() {
    if (!active) return;
    place(resolve(steps[idx] || {}));
  }

  function renderDots() {
    var dots = pop.querySelector(".dvt-dots"); dots.innerHTML = "";
    for (var i = 0; i < steps.length; i++) {
      var d = el("i"); if (i === idx) d.className = "on"; dots.appendChild(d);
    }
  }

  function show() {
    var s = steps[idx]; if (!s) { end(); return; }
    if (typeof s.before === "function") { try { s.before(); } catch (e) {} }
    var node = resolve(s);
    // Actualizar textos
    pop.querySelector("h4").textContent = s.title || "";
    pop.querySelector("p").innerHTML = s.text || "";
    pop.querySelector(".dvt-badge-txt").textContent = s.badge || ("Paso " + (idx + 1) + " de " + steps.length);
    var backBtn = pop.querySelector(".dvt-back");
    var nextBtn = pop.querySelector(".dvt-next");
    backBtn.style.display = idx === 0 ? "none" : "";
    nextBtn.textContent = idx === steps.length - 1 ? "¡Listo! 🎉" : "Siguiente";
    renderDots();

    mask.classList.add("dvt-show");
    scrollIntoView(node).then(function () {
      place(node);
      // segunda pasada tras medir el popup ya con contenido
      requestAnimationFrame(function () { place(resolve(s)); pop.classList.add("dvt-show"); });
    });
  }

  function next() {
    pop.classList.remove("dvt-show");
    if (idx >= steps.length - 1) { end(); return; }
    idx++; setTimeout(show, 130);
  }
  function prev() {
    if (idx === 0) return;
    pop.classList.remove("dvt-show");
    idx--; setTimeout(show, 130);
  }
  function end() {
    active = false;
    if (pop) pop.classList.remove("dvt-show");
    if (mask) mask.classList.remove("dvt-show");
    setTimeout(function () {
      if (mask) mask.style.display = "none";
      if (hi) hi.style.display = "none";
      if (arrow) arrow.style.opacity = "0";
      if (pop) pop.style.display = "none";
    }, 260);
    if (opts.key) { try { localStorage.setItem(opts.key, "1"); } catch (e) {} }
    if (typeof opts.onEnd === "function") { try { opts.onEnd(); } catch (e) {} }
  }

  function start(list, options) {
    steps = (list || []).filter(Boolean);
    opts = options || {};
    if (!steps.length) return;
    ensureDom();
    idx = 0; active = true;
    mask.style.display = ""; hi.style.display = ""; pop.style.display = "";
    // aplicar fuentes del sitio si existen
    var cs = getComputedStyle(document.body);
    document.documentElement.style.setProperty("--dvt-body", cs.fontFamily);
    setTimeout(show, 30);
  }

  function startedOnce(key) {
    try { return localStorage.getItem(key) === "1"; } catch (e) { return false; }
  }

  /* Botón flotante que relanza el tour */
  function mountFab(label, stepsFactory, key) {
    var fab = el("button", "dvt-fab");
    fab.type = "button";
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.2"/><path d="M12 17h.01"/></svg>' +
      "<span>" + (label || "Ver tutorial") + "</span>";
    fab.addEventListener("click", function () {
      start(stepsFactory(), { key: key });
    });
    document.body.appendChild(fab);
    return fab;
  }

  return { start: start, startedOnce: startedOnce, mountFab: mountFab, end: end };
})();
