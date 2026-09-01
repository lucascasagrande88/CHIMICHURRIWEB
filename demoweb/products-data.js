/* ===========================================================================
   Distribuidora del Valle — Catálogo de ejemplo (DEMO)
   Productos, precios y presentaciones GENÉRICOS, solo para mostrar el sistema.
   Cada visitante puede editar todo esto desde el panel sin afectar a los demás.
   Campos: id, n (nombre), d (descripción), p (precio ARS), emoji (ícono),
           cat (categoría), unit (presentación), active
   =========================================================================== */
window.DV_DATA_VERSION = "2026-09-01-1";
window.DV_DEFAULT_PRODUCTS = [
  // ——— Almacén ———
  { id:"arroz-largo",   n:"Arroz largo fino 1 kg",     d:"Grano seleccionado, ideal para todo tipo de comercio.", p:12500, emoji:"🍚", cat:"almacen", unit:"Caja x 10", active:true },
  { id:"fideos-guise",  n:"Fideos guiseros 500 g",     d:"Pasta seca de sémola. Alta rotación.",                  p:9800,  emoji:"🍝", cat:"almacen", unit:"Caja x 20", active:true },
  { id:"aceite-gira",   n:"Aceite de girasol 1,5 L",   d:"Aceite puro de girasol, botella familiar.",             p:28900, emoji:"🫒", cat:"almacen", unit:"Caja x 12", active:true },
  { id:"pure-tomate",   n:"Puré de tomate 520 g",      d:"Tomate natural triturado, sin conservantes.",           p:15600, emoji:"🥫", cat:"almacen", unit:"Caja x 24", active:true },
  { id:"azucar-comun",  n:"Azúcar común 1 kg",         d:"Azúcar refinada tipo A.",                               p:11200, emoji:"🧂", cat:"almacen", unit:"Fardo x 10", active:true },
  { id:"harina-000",    n:"Harina 000 1 kg",           d:"Harina de trigo para panadería y pastelería.",          p:8900,  emoji:"🌾", cat:"almacen", unit:"Fardo x 10", active:true },
  { id:"lentejas",      n:"Lentejas secas 400 g",      d:"Legumbre seca seleccionada.",                           p:10400, emoji:"🫘", cat:"almacen", unit:"Caja x 12", active:true },

  // ——— Bebidas ———
  { id:"gaseosa-cola",  n:"Gaseosa cola 2,25 L",       d:"Bebida gasificada sabor cola.",                         p:13800, emoji:"🥤", cat:"bebidas", unit:"Pack x 6", active:true },
  { id:"agua-min",      n:"Agua mineral 2 L",          d:"Agua de manantial sin gas.",                            p:6900,  emoji:"💧", cat:"bebidas", unit:"Pack x 6", active:true },
  { id:"jugo-polvo",    n:"Jugo en polvo 20 g",        d:"Sobres para preparar. Varios sabores.",                 p:8600,  emoji:"🧃", cat:"bebidas", unit:"Caja x 24", active:true },
  { id:"vino-tinto",    n:"Vino tinto 750 ml",         d:"Blend tinto joven, botella estándar.",                  p:21500, emoji:"🍷", cat:"bebidas", unit:"Caja x 6", active:true },
  { id:"cerveza-rubia", n:"Cerveza rubia 473 ml",      d:"Lata de cerveza rubia clásica.",                        p:9800,  emoji:"🍺", cat:"bebidas", unit:"Pack x 6", active:true },

  // ——— Lácteos ———
  { id:"leche-larga",   n:"Leche entera larga vida 1 L", d:"Leche UAT lista para la góndola.",                    p:14400, emoji:"🥛", cat:"lacteos", unit:"Caja x 12", active:true },
  { id:"queso-crem",    n:"Queso cremoso (horma)",     d:"Horma de ~3 kg, corte parejo.",                         p:18900, emoji:"🧀", cat:"lacteos", unit:"Horma", active:true },
  { id:"manteca-200",   n:"Manteca 200 g",             d:"Manteca de primera calidad.",                           p:22000, emoji:"🧈", cat:"lacteos", unit:"Caja x 20", active:true },
  { id:"yogur-beb",     n:"Yogur bebible 1 L",         d:"Yogur entero bebible, varios sabores.",                 p:8700,  emoji:"🥛", cat:"lacteos", unit:"Pack x 6", active:true },

  // ——— Fiambres ———
  { id:"jamon-cocido",  n:"Jamón cocido",              d:"Feteado o en pieza. Precio por kg.",                    p:9500,  emoji:"🍖", cat:"fiambres", unit:"Por kg", active:true },
  { id:"salame",        n:"Salame tipo Milán",         d:"Embutido curado. Precio por kg.",                       p:12800, emoji:"🥓", cat:"fiambres", unit:"Por kg", active:true },
  { id:"mortadela",     n:"Mortadela",                 d:"Fiambre clásico. Precio por kg.",                       p:7600,  emoji:"🥓", cat:"fiambres", unit:"Por kg", active:true },

  // ——— Congelados ———
  { id:"papas-prefri",  n:"Papas prefritas 2,5 kg",    d:"Bastón corte recto, listas para freír.",                p:16900, emoji:"🍟", cat:"congelados", unit:"Caja x 4", active:true },
  { id:"hamburguesas",  n:"Hamburguesas congeladas",   d:"Medallón de carne. Caja x 24 unidades.",                p:14500, emoji:"🍔", cat:"congelados", unit:"Caja x 24", active:true },
  { id:"mila-pollo",    n:"Milanesas de pollo",        d:"Rebozadas, congeladas. Caja x 6 planchas.",             p:18200, emoji:"🍗", cat:"congelados", unit:"Caja x 6", active:true },

  // ——— Panificados ———
  { id:"pan-mesa",      n:"Pan de mesa lactal",        d:"Pan blanco en molde, larga duración.",                  p:11800, emoji:"🍞", cat:"panificados", unit:"Caja x 12", active:true },
  { id:"facturas",      n:"Facturas surtidas",         d:"Docena de facturas de manteca.",                        p:6900,  emoji:"🥐", cat:"panificados", unit:"Docena", active:true },

  // ——— Desayuno e Infusiones ———
  { id:"cafe-molido",   n:"Café molido 500 g",         d:"Tostado natural, molienda media.",                      p:26400, emoji:"☕", cat:"desayuno", unit:"Caja x 12", active:true },
  { id:"galletitas",    n:"Galletitas dulces 300 g",   d:"Surtido de galletitas, alta salida.",                   p:12600, emoji:"🍪", cat:"desayuno", unit:"Caja x 24", active:true },
  { id:"yerba-mate",    n:"Yerba mate 1 kg",           d:"Con palo, estacionada. Muy pedida.",                    p:32900, emoji:"🧉", cat:"desayuno", unit:"Caja x 10", active:true },
  { id:"te-saquitos",   n:"Té en saquitos x 25",       d:"Té negro clásico en saquitos.",                         p:7800,  emoji:"🍵", cat:"desayuno", unit:"Caja x 20", active:true },

  // ——— Snacks y Golosinas ———
  { id:"papas-fritas",  n:"Papas fritas 100 g",        d:"Snack salado en paquete.",                              p:15900, emoji:"🥔", cat:"snacks", unit:"Caja x 20", active:true },
  { id:"chocolate",     n:"Chocolate con leche 100 g", d:"Tableta de chocolate con leche.",                       p:18400, emoji:"🍫", cat:"snacks", unit:"Caja x 20", active:true },
  { id:"caramelos",     n:"Caramelos surtidos 1 kg",   d:"Bolsón de caramelos duros surtidos.",                   p:6500,  emoji:"🍬", cat:"snacks", unit:"Bolsón x 1 kg", active:true },
  { id:"chupetines",    n:"Chupetines x 50",           d:"Caja de chupetines de frutas.",                         p:9200,  emoji:"🍭", cat:"snacks", unit:"Caja x 24", active:true },

  // ——— Limpieza e Higiene ———
  { id:"lavandina",     n:"Lavandina 1 L",             d:"Concentrada, uso doméstico y comercial.",               p:10800, emoji:"🧴", cat:"limpieza", unit:"Caja x 12", active:true },
  { id:"papel-higie",   n:"Papel higiénico x 4",       d:"Rollo doble hoja. Fardo x 10 packs.",                   p:13900, emoji:"🧻", cat:"limpieza", unit:"Fardo x 10", active:true },
  { id:"detergente",    n:"Detergente 750 ml",         d:"Lavavajillas concentrado.",                             p:15200, emoji:"🧼", cat:"limpieza", unit:"Caja x 12", active:true },
  { id:"jabon-polvo",   n:"Jabón en polvo 800 g",      d:"Para ropa, alto rendimiento.",                          p:24900, emoji:"🫧", cat:"limpieza", unit:"Caja x 20", active:true }
];
