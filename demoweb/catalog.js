/* ===========================================================================
   Distribuidora del Valle — DEMO · Catálogo / Lista de precios
   Lee los mismos productos que la tienda y el panel (queda vivo con el CRM).
   Estructura tipo "lista agrupada por rubro" (referencia: lista de la cementera).
   =========================================================================== */
(function () {
  "use strict";
  var S = window.DVStore;
  var CATS = window.DV_CATS || [];
  var BRAND = window.DV_BRAND || {};
  var CMAP = {}; CATS.forEach(function (c) { CMAP[c.k] = c; });
  function catColor(k){ return (CMAP[k]&&CMAP[k].color)||"#2c8a4a"; }
  function catLabel(k){ return (CMAP[k]&&CMAP[k].label)||k||""; }
  function catEmoji(k){ return (CMAP[k]&&CMAP[k].emoji)||"📦"; }
  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function shade(hex,p){var n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;r=Math.max(0,Math.min(255,r+p));g=Math.max(0,Math.min(255,g+p));b=Math.max(0,Math.min(255,b+p));return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}

  /* WhatsApp + datos de contacto */
  document.querySelectorAll(".js-wa").forEach(function (a) {
    a.setAttribute("href", S.waLink(a.getAttribute("data-wa") || "¡Hola!"));
    a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener");
  });
  (function(){ var e=document.getElementById("waPretty"); if(e&&BRAND.whatsappPretty)e.textContent=BRAND.whatsappPretty;
    var mn=document.getElementById("minNote"); if(mn)mn.textContent=BRAND.minOrder||""; })();

  /* Fecha de la lista */
  (function(){
    var d=new Date();
    var meses=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    var txt=d.getDate()+" de "+meses[d.getMonth()]+" de "+d.getFullYear();
    document.querySelectorAll(".js-fecha").forEach(function(e){ e.textContent=txt; });
  })();

  /* Filtro categorías en el <select> */
  var sel=document.getElementById("catSelect");
  if(sel) sel.innerHTML='<option value="todas">Todas las categorías</option>'+CATS.map(function(c){return '<option value="'+c.k+'">'+esc(c.label)+'</option>';}).join("");

  /* ---------- productos + carrito ---------- */
  var products=[], pmap={}, cart=S.getCart();
  var query="", catFilter="todas", sort="az";
  var host=document.getElementById("listaHost");

  function tileHTML(p){ var u=S.imgURL(p.img); if(u) return '<img src="'+u+'" alt="">'; return (p.emoji||catEmoji(p.cat)); }
  function priceHTML(p){ return (p.p>0) ? '$'+S.fmt(p.p)+'<small>ARS</small>' : '<span class="lr-price consultar">Consultar</span>'; }

  function cartQty(id){ var it=cart.find(function(c){return c.id===id;}); return it?it.qty:0; }
  function changeQty(id,d){
    var it=cart.find(function(c){return c.id===id;});
    if(it){ it.qty+=d; if(it.qty<=0) cart=cart.filter(function(c){return c.id!==id;}); }
    else if(d>0) cart.push({id:id,qty:d});
    S.saveCart(cart); refreshActions(); renderBadge(); renderCart();
  }
  function actionHTML(id){
    var q=cartQty(id);
    if(q>0) return '<div class="qty-stepper"><button class="qd" data-id="'+id+'">−</button><span>'+q+'</span><button class="qi" data-id="'+id+'">+</button></div>';
    return '<button class="btn btn-green add-btn" data-id="'+id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>Agregar</button>';
  }
  function refreshActions(){ document.querySelectorAll(".lr-action").forEach(function(c){ c.innerHTML=actionHTML(c.getAttribute("data-id")); }); }
  function renderBadge(){ var n=cart.reduce(function(a,c){return a+c.qty;},0); var b=document.getElementById("cartCount"); if(b){ b.textContent=n; b.style.display=n>0?"grid":"none"; } }

  function cartTile(p){ var u=S.imgURL(p.img); if(u) return '<img src="'+u+'" alt="">'; return '<span class="ci-emoji">'+(p.emoji||catEmoji(p.cat))+'</span>'; }
  function renderCart(){
    var wrap=document.getElementById("cartItems"), empty=document.getElementById("cartEmpty"), foot=document.getElementById("cartFoot");
    if(!wrap) return;
    var live=cart.filter(function(c){return pmap[c.id];});
    if(live.length===0){ wrap.innerHTML=""; empty.style.display="flex"; foot.style.display="none"; return; }
    empty.style.display="none"; foot.style.display="flex";
    var total=0, html="";
    live.forEach(function(c){ var p=pmap[c.id], sub=p.p*c.qty; total+=sub;
      html+='<div class="cart-item">'+cartTile(p)+
        '<div class="ci-info"><b>'+esc(p.n)+'</b><span>'+(p.p>0?"$"+S.fmt(p.p):"A confirmar")+' · '+esc(p.unit||"unidad")+'</span>'+
        '<div class="qty-stepper sm"><button class="qd" data-id="'+p.id+'">−</button><span>'+c.qty+'</span><button class="qi" data-id="'+p.id+'">+</button></div></div>'+
        '<b class="ci-sub">'+(p.p>0?"$"+S.fmt(sub):"—")+'</b></div>';
    });
    wrap.innerHTML=html;
    var t=document.getElementById("cartTotal"); if(t) t.textContent="$"+S.fmt(total);
  }

  /* ---------- render lista agrupada ---------- */
  function passes(p){
    if(p.active===false) return false;
    if(catFilter!=="todas" && p.cat!==catFilter) return false;
    if(query && (p.n||"").toLowerCase().indexOf(query)<0 && (p.d||"").toLowerCase().indexOf(query)<0 && (p.unit||"").toLowerCase().indexOf(query)<0) return false;
    return true;
  }
  function render(){
    if(!host) return;
    var visible=products.filter(passes), total=visible.length;
    var cnt=document.getElementById("listaCount");
    if(cnt) cnt.textContent=total+(total===1?" producto":" productos");
    if(total===0){ host.innerHTML='<div class="lista-empty"><b>No encontramos productos</b><span>Probá con otra búsqueda o categoría.</span></div>'; return; }
    var order=CATS.map(function(c){return c.k;});
    var html="";
    order.forEach(function(k){
      var items=visible.filter(function(p){return p.cat===k;});
      if(!items.length) return;
      if(sort==="price-asc") items.sort(function(a,b){return (a.p||0)-(b.p||0);});
      else if(sort==="price-desc") items.sort(function(a,b){return (b.p||0)-(a.p||0);});
      else items.sort(function(a,b){return (a.n||"").localeCompare(b.n||"","es",{sensitivity:"base"});});
      var col=catColor(k);
      html+='<section class="catsec">'+
        '<div class="catsec-head" style="background:linear-gradient(90deg,'+col+','+shade(col,-22)+')">'+
          '<span class="cs-em">'+catEmoji(k)+'</span><h2>'+esc(catLabel(k))+'</h2>'+
          '<span class="cs-count">'+items.length+(items.length===1?" prod.":" prods.")+'</span></div>'+
        '<div class="catsec-body">'+
          items.map(function(p){
            return '<div class="lrow">'+
              '<div class="lr-tile">'+tileHTML(p)+'</div>'+
              '<div><div class="lr-name">'+esc(p.n)+'</div>'+(p.unit?'<div class="lr-unit">'+esc(p.unit)+'</div>':'')+'</div>'+
              '<div class="lr-price">'+priceHTML(p)+'</div>'+
              '<div class="lr-action" data-id="'+p.id+'">'+actionHTML(p.id)+'</div>'+
            '</div>';
          }).join("")+
        '</div></section>';
    });
    host.innerHTML=html;
  }

  if(host){
    host.addEventListener("click",function(e){
      var add=e.target.closest(".add-btn"); if(add){ changeQty(add.getAttribute("data-id"),1); showToast("Agregado al pedido 🛒"); return; }
      var qi=e.target.closest(".qi"); if(qi){ changeQty(qi.getAttribute("data-id"),1); return; }
      var qd=e.target.closest(".qd"); if(qd){ changeQty(qd.getAttribute("data-id"),-1); return; }
    });
  }
  var searchEl=document.getElementById("listaSearch"), deb;
  if(searchEl) searchEl.addEventListener("input",function(){ query=searchEl.value.toLowerCase(); clearTimeout(deb); deb=setTimeout(render,120); });
  if(sel) sel.addEventListener("change",function(){ catFilter=sel.value; render(); });
  var sortEl=document.getElementById("listaSort"); if(sortEl) sortEl.addEventListener("change",function(){ sort=sortEl.value; render(); });
  var printBtn=document.getElementById("printBtn"); if(printBtn) printBtn.addEventListener("click",function(){ window.print(); });

  function loadProducts(){
    return S.getProducts().then(function(list){ products=list; pmap={}; products.forEach(function(p){pmap[p.id]=p;}); render(); renderCart(); renderBadge(); });
  }
  if(S && host){ S.ready().then(loadProducts).then(function(){ S.subscribe(function(){ loadProducts(); }); }); }

  /* ---------- carrito drawer (igual que la tienda) ---------- */
  var cartDrawer=document.getElementById("cartDrawer"), cartBtn=document.getElementById("cartBtn");
  if(cartBtn) cartBtn.addEventListener("click",function(){ renderCart(); cartDrawer.classList.add("open"); });
  if(cartDrawer) cartDrawer.addEventListener("click",function(e){ if(e.target.hasAttribute("data-close")) cartDrawer.classList.remove("open"); });
  var ci=document.getElementById("cartItems");
  if(ci) ci.addEventListener("click",function(e){ var qi=e.target.closest(".qi"); if(qi){changeQty(qi.getAttribute("data-id"),1);return;} var qd=e.target.closest(".qd"); if(qd){changeQty(qd.getAttribute("data-id"),-1);return;} });
  var clr=document.getElementById("clearCartBtn"); if(clr) clr.addEventListener("click",function(){ cart=[]; S.saveCart(cart); refreshActions(); renderBadge(); renderCart(); });
  var co=document.getElementById("checkoutBtn");
  if(co) co.addEventListener("click",function(){
    if(cart.length===0) return;
    var lines=[], total=0;
    cart.forEach(function(c){ var p=pmap[c.id]; if(!p) return; var sub=p.p*c.qty; total+=sub; lines.push("• "+c.qty+"x "+p.n+(p.unit?" ("+p.unit+")":"")+(p.p>0?" — $"+S.fmt(sub):" — a confirmar")); });
    var msg="¡Hola! Quiero hacer este pedido mayorista:\n\n"+lines.join("\n")+"\n\nTotal: $"+S.fmt(total);
    window.open(S.waLink(msg),"_blank");
    cart=[]; S.saveCart(cart); refreshActions(); renderBadge(); renderCart(); cartDrawer.classList.remove("open");
    showToast("¡Pedido enviado por WhatsApp! 🎉");
  });
  renderBadge();

  /* ---------- header + drawer + toast ---------- */
  var header=document.getElementById("header");
  function onScroll(){ if(window.scrollY>24) header.classList.add("shrink"); else header.classList.remove("shrink"); }
  window.addEventListener("scroll",onScroll,{passive:true}); onScroll();
  var drawer=document.getElementById("drawer"), hb=document.getElementById("hambBtn");
  if(hb) hb.addEventListener("click",function(){ drawer.classList.add("open"); });
  if(drawer) drawer.addEventListener("click",function(e){ if(e.target.hasAttribute("data-close")) drawer.classList.remove("open"); });
  var toast=document.getElementById("toast"), toastMsg=document.getElementById("toastMsg"), tt;
  function showToast(m){ toastMsg.textContent=m; toast.classList.add("show"); clearTimeout(tt); tt=setTimeout(function(){toast.classList.remove("show");},2400); }

  /* ---------- tour del catálogo ---------- */
  function steps(){
    return [
      {title:"Este es el catálogo online 📋",badge:"Lista de precios",
       text:"Es la <b>lista de precios completa</b> de la distribuidora, agrupada por rubro. Se arma sola con los productos del panel, así siempre está al día."},
      {el:".lista-toolbar .shop-search",placement:"bottom",title:"Buscá y filtrá",
       text:"Escribí para buscar cualquier producto, o filtrá por <b>categoría</b> y ordená por precio."},
      {el:function(){return document.querySelector(".catsec");},placement:"top",pad:8,title:"Agrupado por rubro",
       text:"Cada rubro es una sección con su color y la cantidad de productos. Bien claro para el cliente."},
      {el:function(){return document.querySelector(".lr-action");},placement:"left",title:"Sumá al pedido",
       text:'Con <b>“Agregar”</b> armás el pedido desde la misma lista.'},
      {el:"#cartBtn",placement:"left",pad:6,title:"Cerrás por WhatsApp",
       text:"El pedido se envía por WhatsApp ya armado, con productos, cantidades y total."},
      {el:"#panelLink",placement:"bottom",pad:6,title:"Se edita desde el panel",
       text:"Precios, presentaciones y qué se muestra: todo se maneja desde el <b>panel (CRM)</b>."}
    ];
  }
  if(window.DVTour){
    DVTour.mountFab("¿Cómo funciona?", steps, "dv_tour_catalogo");
    var st=document.getElementById("startTour"); if(st) st.addEventListener("click",function(){ DVTour.start(steps(),{key:"dv_tour_catalogo"}); });
    if(!DVTour.startedOnce("dv_tour_catalogo")){ setTimeout(function(){ DVTour.start(steps(),{key:"dv_tour_catalogo"}); },900); }
  }
})();
