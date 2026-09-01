/* ===========================================================================
   Distribuidora del Valle — Almacenamiento (DEMO)
   -------------------------------------------------------------------------
   Guarda los productos y el carrito EN EL NAVEGADOR de cada visitante
   (localStorage). Así cada cliente que abre el demo tiene su propio catálogo
   para jugar: agrega, edita, borra, importa/exporta — sin tocar el de nadie.

   API (todo devuelve Promises para que la tienda y el panel usen lo mismo):
     ready()            -> asegura que haya datos (siembra los de ejemplo)
     getProducts()      -> lista ordenada
     putProduct(rec)    -> alta o edición
     bulkAdd(list)      -> alta masiva
     deleteProduct(id)  -> baja
     resetProducts()    -> vuelve al catálogo de ejemplo
     subscribe(cb)      -> avisa cuando algo cambia (sincroniza pestañas)
     exportData()/importData(arr)
   Imágenes: se guardan como dataURI (texto). Si un producto no tiene foto,
   la tienda muestra un ícono (emoji) con el color de la categoría.
   =========================================================================== */
window.DVStore = (function () {
  "use strict";
  var PKEY = "dv_products_v1";
  var CKEY = "dv_cart_v1";
  var PING = "dv_ping";
  var COLS = ["id", "n", "d", "p", "img", "emoji", "cat", "unit", "active", "order"];
  var WANUM = (window.DV_BRAND && window.DV_BRAND.whatsapp) || "5491100000000";

  var _cache = null;
  var _subs = [];
  var _bc = null;
  try { _bc = ("BroadcastChannel" in window) ? new BroadcastChannel("dv_shop") : null; } catch (e) { _bc = null; }

  /* ---------- utilidades ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function clean(rec) {
    var o = {};
    COLS.forEach(function (k) { o[k] = rec[k]; });
    if (o.active == null) o.active = true;
    if (o.img == null) o.img = "";
    if (o.emoji == null) o.emoji = "📦";
    return o;
  }
  function fmt(n) { return Number(n || 0).toLocaleString("es-AR"); }
  function waLink(text) { return "https://wa.me/" + WANUM + "?text=" + encodeURIComponent(text); }

  // Devuelve algo usable en <img src>. Si no hay foto real, devuelve "" y
  // el que llama decide mostrar el emoji.
  function imgURL(img) {
    if (!img) return "";
    if (typeof img === "string") return img;
    try { return URL.createObjectURL(img); } catch (e) { return ""; }
  }
  function blobToDataURL(blob) {
    return new Promise(function (res) {
      if (typeof blob === "string") { res(blob); return; }
      if (!blob) { res(""); return; }
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { res(""); };
      r.readAsDataURL(blob);
    });
  }

  /* ---------- lectura / escritura base ---------- */
  function readRaw() {
    try {
      var raw = JSON.parse(localStorage.getItem(PKEY));
      return Array.isArray(raw) ? raw : null;
    } catch (e) { return null; }
  }
  function writeRaw(list) {
    try { localStorage.setItem(PKEY, JSON.stringify(list)); return true; }
    catch (e) {
      alert("No se pudo guardar: el navegador se quedó sin espacio.\n\nProbá con menos fotos o más livianas.");
      return false;
    }
  }
  function seedIfEmpty() {
    if (readRaw()) return;
    var defs = (window.DV_DEFAULT_PRODUCTS || []).map(function (p, i) {
      var c = clean(p); c.order = i; return c;
    });
    writeRaw(defs);
  }
  function loadCache() { _cache = readRaw() || []; return _cache; }
  function persist(broadcast) {
    writeRaw(_cache);
    if (broadcast !== false) {
      try { localStorage.setItem(PING, String(Date.now())); } catch (e) {}
      if (_bc) { try { _bc.postMessage("change"); } catch (e) {} }
    }
  }

  /* ---------- API ---------- */
  function ready() { seedIfEmpty(); loadCache(); return Promise.resolve(); }

  function getProducts() {
    var list = (_cache || loadCache()).slice();
    list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    return Promise.resolve(clone(list));
  }

  function putProduct(rec) {
    if (!_cache) loadCache();
    var r = clean(rec);
    var i = _cache.findIndex(function (x) { return x.id === r.id; });
    if (i > -1) _cache[i] = r; else _cache.push(r);
    persist();
    return Promise.resolve(r);
  }

  function bulkAdd(list) {
    if (!_cache) loadCache();
    (list || []).forEach(function (rec) {
      var r = clean(rec);
      var i = _cache.findIndex(function (x) { return x.id === r.id; });
      if (i > -1) _cache[i] = r; else _cache.push(r);
    });
    persist();
    return Promise.resolve(true);
  }

  function deleteProduct(id) {
    if (!_cache) loadCache();
    _cache = _cache.filter(function (x) { return x.id !== id; });
    persist();
    return Promise.resolve(true);
  }

  function resetProducts() {
    localStorage.removeItem(PKEY);
    seedIfEmpty();
    loadCache();
    persist();
    return getProducts();
  }

  function nextOrder() {
    if (!_cache) loadCache();
    var m = 0; _cache.forEach(function (p) { if ((p.order || 0) > m) m = p.order; });
    return Promise.resolve(m + 1);
  }
  function countAll() { return Promise.resolve((_cache || loadCache()).length); }

  function exportData() {
    return getProducts().then(function (list) {
      return list.map(function (p) {
        return { id:p.id, n:p.n, d:p.d, p:p.p, img:p.img || "", emoji:p.emoji || "📦",
                 cat:p.cat, unit:p.unit || "", active:p.active !== false, order:p.order };
      });
    });
  }
  function importData(arr) {
    if (!Array.isArray(arr)) return Promise.reject(new Error("Formato inválido"));
    var out = arr.map(function (p, i) { var c = clean(p); if (c.order == null) c.order = i; return c; });
    _cache = out; persist();
    return getProducts();
  }

  /* ---------- sincronización entre pestañas ---------- */
  function fire() { _subs.forEach(function (cb) { try { cb(); } catch (e) {} }); }
  function subscribe(cb) { if (typeof cb === "function") _subs.push(cb); }
  window.addEventListener("storage", function (e) {
    if (e.key === PING || e.key === PKEY) { loadCache(); fire(); }
  });
  if (_bc) _bc.onmessage = function () { loadCache(); fire(); };

  /* ---------- carrito ---------- */
  function getCart() {
    try { var c = JSON.parse(localStorage.getItem(CKEY)); return Array.isArray(c) ? c : []; }
    catch (e) { return []; }
  }
  function saveCart(cart) { try { localStorage.setItem(CKEY, JSON.stringify(cart)); } catch (e) {} }

  return {
    mode: "local",
    ready: ready, getProducts: getProducts, putProduct: putProduct, bulkAdd: bulkAdd,
    deleteProduct: deleteProduct, resetProducts: resetProducts, nextOrder: nextOrder, countAll: countAll,
    exportData: exportData, importData: importData, subscribe: subscribe,
    imgURL: imgURL, blobToDataURL: blobToDataURL, fmt: fmt, waLink: waLink, WANUM: WANUM,
    getCart: getCart, saveCart: saveCart
  };
})();
