/* ===========================================================================
   Distribuidora del Valle — DEMO · Interacciones de la tienda
   =========================================================================== */
(function () {
  "use strict";
  var S = window.DVStore;
  var CATS = window.DV_CATS || [];
  var BRAND = window.DV_BRAND || {};
  var CMAP = {}; CATS.forEach(function (c) { CMAP[c.k] = c; });

  function catColor(k) { return (CMAP[k] && CMAP[k].color) || "#2c8a4a"; }
  function catLabel(k) { return (CMAP[k] && CMAP[k].label) || k || ""; }
  function catEmoji(k) { return (CMAP[k] && CMAP[k].emoji) || "📦"; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* ---------- WhatsApp links ---------- */
  document.querySelectorAll(".js-wa").forEach(function (a) {
    var msg = a.getAttribute("data-wa") || "¡Hola!";
    a.setAttribute("href", S.waLink(msg));
    a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener");
  });
  // Rellenar datos de contacto desde config
  (function () {
    var set = function (id, v) { var e = document.getElementById(id); if (e && v) e.textContent = v; };
    set("waPretty", BRAND.whatsappPretty); set("emailTxt", BRAND.email);
    set("hoursTxt", BRAND.hours); set("addrTxt", BRAND.address);
    var mn = document.getElementById("minNote"); if (mn) mn.textContent = BRAND.minOrder || "";
  })();

  /* ---------- Construir categorías (tabs, chips, tarjetas) ---------- */
  (function buildCats() {
    var tabs = document.getElementById("catTabs");
    var chips = document.getElementById("shopCats");
    var grid = document.getElementById("catGrid");
    if (tabs) {
      tabs.innerHTML = '<button class="tab active" data-cat="todas"><span class="em">🗂️</span>Todas</button>' +
        CATS.map(function (c) { return '<button class="tab" data-cat="' + c.k + '"><span class="em">' + c.emoji + '</span>' + esc(c.label) + '</button>'; }).join("");
    }
    if (chips) {
      chips.innerHTML = '<button class="scat active" data-cat="todas">Todos</button>' +
        CATS.map(function (c) { return '<button class="scat" data-cat="' + c.k + '">' + esc(c.label) + '</button>'; }).join("");
    }
    if (grid) {
      var descs = {
        almacen:"Arroz, fideos, aceite, harina, conservas y toda la base del almacén.",
        bebidas:"Gaseosas, aguas, jugos, vinos y cervezas por pack y por caja.",
        lacteos:"Leche, quesos, manteca y yogures con cadena de frío cuidada.",
        fiambres:"Jamón, salame, mortadela y embutidos por kilo.",
        congelados:"Papas, hamburguesas y milanesas siempre en frío.",
        panificados:"Pan de mesa, facturas y panificados frescos.",
        desayuno:"Café, yerba, té y galletitas para la mañana.",
        snacks:"Snacks salados, chocolates y golosinas de alta rotación.",
        limpieza:"Higiene y limpieza para tu comercio y tus clientes."
      };
      grid.innerHTML = CATS.map(function (c) {
        return '<article class="catcard" data-cat="' + c.k + '">' +
          '<span class="cbar" style="background:' + c.color + '"></span>' +
          '<span class="ct-em" style="background:linear-gradient(150deg,' + c.color + ',' + shade(c.color, -18) + ')">' + c.emoji + '</span>' +
          '<div><h3>' + esc(c.label) + '</h3><p>' + (descs[c.k] || "") + '</p>' +
          '<button class="btn btn-green btn-sm" data-cat="' + c.k + '">Ver productos <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>' +
          '</article>';
      }).join("");
    }
  })();
  function shade(hex, p) {
    var n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r + p)); g = Math.max(0, Math.min(255, g + p)); b = Math.max(0, Math.min(255, b + p));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ---------- Productos + carrito ---------- */
  var products = [], pmap = {}, cart = S.getCart();
  var shopCat = "todas", shopQuery = "", shopSort = "az", filtered = [], shown = 0, PAGE = 12;
  var grid = document.getElementById("prodGrid");

  function tileHTML(p, big) {
    var url = S.imgURL(p.img);
    if (url) return '<img src="' + url + '" alt="' + esc(p.n) + '" loading="lazy">';
    var col = catColor(p.cat);
    return '<div class="emoji-wrap" style="width:100%;height:100%;display:grid;place-items:center;background:radial-gradient(120% 120% at 30% 20%, ' +
      shade(col, 70) + '33, ' + col + '18)"><span class="emoji">' + (p.emoji || catEmoji(p.cat)) + '</span></div>';
  }
  function cartTile(p) {
    var url = S.imgURL(p.img);
    if (url) return '<img src="' + url + '" alt="">';
    return '<span class="ci-emoji">' + (p.emoji || catEmoji(p.cat)) + '</span>';
  }

  function cartQty(id) { var it = cart.find(function (c) { return c.id === id; }); return it ? it.qty : 0; }
  function changeQty(id, d) {
    var it = cart.find(function (c) { return c.id === id; });
    if (it) { it.qty += d; if (it.qty <= 0) cart = cart.filter(function (c) { return c.id !== id; }); }
    else if (d > 0) cart.push({ id: id, qty: d });
    S.saveCart(cart); refreshActions(); renderBadge(); renderCart();
  }
  function actionHTML(id) {
    var q = cartQty(id);
    if (q > 0) return '<div class="qty-stepper"><button class="qd" data-id="' + id + '">−</button><span>' + q + '</span><button class="qi" data-id="' + id + '">+</button></div>';
    return '<button class="btn btn-green add-btn" data-id="' + id + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>Agregar</button>';
  }
  function refreshActions() {
    document.querySelectorAll(".pcard-actions").forEach(function (c) { c.innerHTML = actionHTML(c.getAttribute("data-id")); });
  }
  function renderBadge() {
    var n = cart.reduce(function (a, c) { return a + c.qty; }, 0);
    var b = document.getElementById("cartCount");
    if (b) { b.textContent = n; b.style.display = n > 0 ? "grid" : "none"; }
  }
  function renderCart() {
    var wrap = document.getElementById("cartItems"), empty = document.getElementById("cartEmpty"), foot = document.getElementById("cartFoot");
    if (!wrap) return;
    var live = cart.filter(function (c) { return pmap[c.id]; });
    if (live.length === 0) { wrap.innerHTML = ""; empty.style.display = "flex"; foot.style.display = "none"; return; }
    empty.style.display = "none"; foot.style.display = "flex";
    var total = 0, html = "";
    live.forEach(function (c) {
      var p = pmap[c.id], sub = p.p * c.qty; total += sub;
      html += '<div class="cart-item">' + cartTile(p) +
        '<div class="ci-info"><b>' + esc(p.n) + '</b><span>$' + S.fmt(p.p) + ' · ' + esc(p.unit || "unidad") + '</span>' +
        '<div class="qty-stepper sm"><button class="qd" data-id="' + p.id + '">−</button><span>' + c.qty + '</span><button class="qi" data-id="' + p.id + '">+</button></div></div>' +
        '<b class="ci-sub">$' + S.fmt(sub) + '</b></div>';
    });
    wrap.innerHTML = html;
    var t = document.getElementById("cartTotal"); if (t) t.textContent = "$" + S.fmt(total);
  }

  function applyFilter() {
    var q = shopQuery.trim().toLowerCase();
    filtered = products.filter(function (p) {
      if (p.active === false) return false;
      if (shopCat !== "todas" && p.cat !== shopCat) return false;
      if (q && (p.n || "").toLowerCase().indexOf(q) < 0 && (p.d || "").toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    if (shopSort === "price-asc") filtered.sort(function (a, b) { return a.p - b.p; });
    else if (shopSort === "price-desc") filtered.sort(function (a, b) { return b.p - a.p; });
    else filtered.sort(function (a, b) { return (a.n || "").localeCompare(b.n || "", "es", { sensitivity: "base" }); });
    shown = 0; if (grid) grid.innerHTML = ""; renderPage();
    var cnt = document.getElementById("shopCount");
    if (cnt) cnt.textContent = filtered.length + (filtered.length === 1 ? " producto" : " productos");
    var emp = document.getElementById("shopEmpty"); if (emp) emp.style.display = filtered.length === 0 ? "flex" : "none";
  }
  function cardHTML(p) {
    return '<div class="well">' + tileHTML(p) + (p.unit ? '<span class="unit">' + esc(p.unit) + '</span>' : '') + '</div>' +
      '<h3>' + esc(p.n) + '</h3>' +
      '<p class="desc">' + esc(p.d || "") + '</p>' +
      '<div class="price">$' + S.fmt(p.p) + '<small>ARS</small></div>' +
      '<div class="pcard-actions" data-id="' + p.id + '"></div>';
  }
  function renderPage() {
    if (!grid) return;
    filtered.slice(shown, shown + PAGE).forEach(function (p) {
      var el = document.createElement("article");
      el.className = "pcard reveal in"; el.setAttribute("data-cat", p.cat || "");
      el.innerHTML = cardHTML(p);
      grid.appendChild(el);
      el.querySelector(".pcard-actions").innerHTML = actionHTML(p.id);
    });
    shown += Math.min(PAGE, filtered.length - shown);
    var more = document.getElementById("shopMore");
    if (more) more.style.display = shown < filtered.length ? "flex" : "none";
  }

  if (grid) {
    grid.addEventListener("click", function (e) {
      var add = e.target.closest(".add-btn"); if (add) { changeQty(add.getAttribute("data-id"), 1); showToast("Agregado al pedido 🛒"); return; }
      var qi = e.target.closest(".qi"); if (qi) { changeQty(qi.getAttribute("data-id"), 1); return; }
      var qd = e.target.closest(".qd"); if (qd) { changeQty(qd.getAttribute("data-id"), -1); return; }
    });
    var lm = document.getElementById("loadMore"); if (lm) lm.addEventListener("click", renderPage);
    var ss = document.getElementById("shopSearch"), deb;
    if (ss) ss.addEventListener("input", function () { shopQuery = ss.value; clearTimeout(deb); deb = setTimeout(applyFilter, 140); });
    var so = document.getElementById("shopSort"); if (so) so.addEventListener("change", function () { shopSort = so.value; applyFilter(); });
    var sc = document.getElementById("shopCats");
    if (sc) sc.addEventListener("click", function (e) { var b = e.target.closest(".scat"); if (!b) return; setShopCat(b.getAttribute("data-cat")); });
  }
  function setShopCat(cat) {
    shopCat = cat;
    var sc = document.getElementById("shopCats");
    if (sc) sc.querySelectorAll(".scat").forEach(function (x) { x.classList.toggle("active", x.getAttribute("data-cat") === cat); });
    applyFilter();
  }

  function loadProducts() {
    return S.getProducts().then(function (list) {
      products = list; pmap = {}; products.forEach(function (p) { pmap[p.id] = p; });
      applyFilter(); renderCart(); renderBadge();
    });
  }
  if (S && grid) {
    S.ready().then(loadProducts).then(function () {
      S.subscribe(function () { loadProducts(); }); // sincroniza cambios del panel en vivo
    });
  }

  /* ---------- Carrito drawer ---------- */
  var cartDrawer = document.getElementById("cartDrawer"), cartBtn = document.getElementById("cartBtn");
  if (cartBtn) cartBtn.addEventListener("click", function () { renderCart(); cartDrawer.classList.add("open"); });
  if (cartDrawer) cartDrawer.addEventListener("click", function (e) { if (e.target.hasAttribute("data-close")) cartDrawer.classList.remove("open"); });
  var ci = document.getElementById("cartItems");
  if (ci) ci.addEventListener("click", function (e) {
    var qi = e.target.closest(".qi"); if (qi) { changeQty(qi.getAttribute("data-id"), 1); return; }
    var qd = e.target.closest(".qd"); if (qd) { changeQty(qd.getAttribute("data-id"), -1); return; }
  });
  var clr = document.getElementById("clearCartBtn");
  if (clr) clr.addEventListener("click", function () { cart = []; S.saveCart(cart); refreshActions(); renderBadge(); renderCart(); });
  var co = document.getElementById("checkoutBtn");
  if (co) co.addEventListener("click", function () {
    if (cart.length === 0) return;
    var lines = [], total = 0;
    cart.forEach(function (c) { var p = pmap[c.id]; if (!p) return; var sub = p.p * c.qty; total += sub; lines.push("• " + c.qty + "x " + p.n + (p.unit ? " (" + p.unit + ")" : "") + " — $" + S.fmt(sub)); });
    var msg = "¡Hola! Quiero hacer este pedido mayorista:\n\n" + lines.join("\n") + "\n\nTotal: $" + S.fmt(total);
    window.open(S.waLink(msg), "_blank");
    cart = []; S.saveCart(cart); refreshActions(); renderBadge(); renderCart();
    cartDrawer.classList.remove("open");
    showToast("¡Pedido enviado por WhatsApp! 🎉");
  });
  renderBadge();

  /* ---------- Header shrink ---------- */
  var header = document.getElementById("header");
  function onScroll() { if (window.scrollY > 24) header.classList.add("shrink"); else header.classList.remove("shrink"); }
  window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* ---------- Nav activo ---------- */
  var secs = ["inicio", "categorias", "productos", "servicios", "nosotros", "contacto"];
  var links = document.querySelectorAll(".menu a");
  function syncNav() {
    var nv = "inicio";
    secs.forEach(function (id) { var s = document.getElementById(id); if (s && s.offsetTop <= window.scrollY + 140) nv = id; });
    links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + nv); });
  }
  window.addEventListener("scroll", syncNav, { passive: true }); syncNav();

  /* ---------- Mobile drawer ---------- */
  var drawer = document.getElementById("drawer");
  var hb = document.getElementById("hambBtn");
  if (hb) hb.addEventListener("click", function () { drawer.classList.add("open"); });
  if (drawer) drawer.addEventListener("click", function (e) { if (e.target.hasAttribute("data-close")) drawer.classList.remove("open"); });

  /* ---------- Tabs categorías ---------- */
  var tabs = document.getElementById("catTabs");
  if (tabs) tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".tab"); if (!b) return;
    tabs.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("active"); });
    b.classList.add("active");
    var cat = b.getAttribute("data-cat");
    document.querySelectorAll("#catGrid .catcard").forEach(function (c) {
      c.style.display = (cat === "todas" || c.getAttribute("data-cat") === cat) ? "" : "none";
    });
  });
  var catGrid = document.getElementById("catGrid");
  if (catGrid) catGrid.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-cat]"); if (!b) return;
    var cat = b.getAttribute("data-cat");
    setShopCat(cat);
    setTimeout(function () { var p = document.getElementById("productos"); if (p) window.scrollTo({ top: p.offsetTop - 70, behavior: "smooth" }); }, 60);
  });
  // Quick cards -> filtran catálogo
  document.querySelectorAll(".qcard[data-jump]").forEach(function (a) {
    a.addEventListener("click", function () { setShopCat(a.getAttribute("data-jump")); });
  });

  /* ---------- FAQ ---------- */
  document.querySelectorAll(".faq .q").forEach(function (q) {
    q.addEventListener("click", function () {
      var faq = q.parentElement, a = faq.querySelector(".a"), open = faq.classList.contains("open");
      document.querySelectorAll(".faq.open").forEach(function (f) { f.classList.remove("open"); f.querySelector(".a").style.maxHeight = null; });
      if (!open) { faq.classList.add("open"); a.style.maxHeight = a.scrollHeight + "px"; }
    });
  });
  var f0 = document.querySelector(".faq"); if (f0) { f0.classList.add("open"); f0.querySelector(".a").style.maxHeight = f0.querySelector(".a").scrollHeight + "px"; }

  /* ---------- Toast + búsqueda + form ---------- */
  var toast = document.getElementById("toast"), toastMsg = document.getElementById("toastMsg"), tt;
  function showToast(m) { toastMsg.textContent = m; toast.classList.add("show"); clearTimeout(tt); tt = setTimeout(function () { toast.classList.remove("show"); }, 2400); }
  var sb = document.getElementById("searchBtn");
  if (sb) sb.addEventListener("click", function () { var p = document.getElementById("productos"); if (p) window.scrollTo({ top: p.offsetTop - 70, behavior: "smooth" }); var ss = document.getElementById("shopSearch"); if (ss) setTimeout(function () { ss.focus(); }, 450); });
  var form = document.getElementById("contactForm");
  if (form) form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var text = "¡Hola! Soy " + (fd.get("nombre") || "") + " (" + (fd.get("tel") || "") + (fd.get("email") ? ", " + fd.get("email") : "") + ").\n\n" + (fd.get("msg") || "");
    window.open(S.waLink(text), "_blank");
    showToast("¡Gracias! Te contactamos por WhatsApp 💚"); form.reset();
  });

  /* ---------- Reveal on scroll ---------- */
  var io = new IntersectionObserver(function (ents) {
    ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  /* =========================================================================
     TOUR GUIADO
  ========================================================================= */
  function homeSteps() {
    return [
      { title: "¡Bienvenido al demo! 👋", badge: "Distribuidora del Valle",
        text: "Esta es una <b>tienda mayorista de alimentos</b> de ejemplo. Todo funciona de verdad: vas a poder navegarla como cliente y también entrar al <b>panel de gestión</b> para cargar y editar productos. Te muestro lo principal en 30 segundos." },
      { el: ".header .menu", placement: "bottom", title: "Menú del sitio",
        text: "Desde acá se navegan las secciones: catálogo, cómo trabajamos, nosotros y contacto. Es una web pensada para que un comercio compre fácil." },
      { el: "#categorias", placement: "top", title: "Surtido por categoría",
        text: "Los productos se agrupan por rubro (almacén, bebidas, lácteos, limpieza…). Tocando una categoría, el catálogo de abajo se filtra solo." },
      { el: "#productos .prod-grid", placement: "top", pad: 12, title: "El catálogo",
        text: "Estos productos <b>no están escritos a mano</b>: salen del panel de gestión. Cuando cargues o edites algo en el panel, acá aparece al instante." },
      { el: function () { return document.querySelector(".pcard-actions") || document.querySelector(".pcard"); }, placement: "top", title: "Armar el pedido",
        text: 'Con <b>“Agregar”</b> sumás productos y elegís cantidades. Probá tocar uno cuando termine el tutorial.' },
      { el: "#cartBtn", placement: "left", pad: 6, title: "El carrito",
        text: "Acá se junta el pedido y se cierra <b>por WhatsApp</b>: el cliente manda el mensaje ya armado con productos, cantidades y total." },
      { el: "#panelLink", placement: "bottom", pad: 6, title: "El panel de gestión (CRM)",
        text: "Este es el corazón del demo. Desde el panel el comercio <b>carga, edita y borra productos</b>, cambia precios y sube fotos — sin saber programar." },
      { title: "Ahora te toca a vos 🚀", badge: "Probá el panel",
        text: 'Entrá al <b>panel (CRM)</b> desde el botón de arriba, agregá un producto o cambiá un precio, y volvé a la tienda: vas a ver el cambio reflejado. <br><br>Podés reabrir este tutorial cuando quieras con el botón <b>“¿Cómo funciona?”</b> abajo a la izquierda.' }
    ];
  }
  // Botón flotante siempre disponible
  DVTour.mountFab("¿Cómo funciona?", homeSteps, "dv_tour_home");
  // Botón del ribbon
  var st = document.getElementById("startTour");
  if (st) st.addEventListener("click", function () { DVTour.start(homeSteps(), { key: "dv_tour_home" }); });
  // Autoarranque la primera vez
  if (!DVTour.startedOnce("dv_tour_home")) {
    setTimeout(function () { DVTour.start(homeSteps(), { key: "dv_tour_home" }); }, 900);
  }
})();
