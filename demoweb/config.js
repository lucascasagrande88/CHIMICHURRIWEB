/* ===========================================================================
   Distribuidora del Valle — DEMO (Chimichurri)
   Configuración central: marca, categorías y datos de contacto.
   Todo es genérico y editable. Este archivo lo comparten la tienda y el panel.
   =========================================================================== */
window.DV_BRAND = {
  name: "Distribuidora del Valle",
  tagline: "Alimentos y bebidas para tu comercio",
  // Número de WhatsApp del demo (genérico). Cambialo por el real del cliente.
  whatsapp: "5491100000000",
  whatsappPretty: "+54 9 11 0000-0000",
  email: "ventas@distribuidoradelvalle.com",
  address: "Parque Industrial, Nave 12 · Zona Sur",
  hours: "Lun a Vie 8–18 h · Sáb 8–13 h",
  instagram: "#",
  facebook: "#",
  minOrder: "Pedido mínimo mayorista: $30.000"
};

/* Categorías del catálogo. k = clave interna, label = nombre visible,
   emoji = ícono de respaldo cuando un producto no tiene foto cargada,
   color = color de la ficha. */
window.DV_CATS = [
  { k: "almacen",     label: "Almacén",            emoji: "🥫", color: "#e07a1f" },
  { k: "bebidas",     label: "Bebidas",            emoji: "🥤", color: "#2f8fd6" },
  { k: "lacteos",     label: "Lácteos",            emoji: "🥛", color: "#3aa1a8" },
  { k: "fiambres",    label: "Fiambres",           emoji: "🥓", color: "#d1463f" },
  { k: "congelados",  label: "Congelados",         emoji: "🧊", color: "#4f8fe0" },
  { k: "panificados", label: "Panificados",        emoji: "🍞", color: "#c98a2b" },
  { k: "desayuno",    label: "Desayuno e Infusiones", emoji: "☕", color: "#8a5a3c" },
  { k: "snacks",      label: "Snacks y Golosinas", emoji: "🍫", color: "#c2569b" },
  { k: "limpieza",    label: "Limpieza e Higiene", emoji: "🧴", color: "#5aa64a" }
];

/* Unidades / presentaciones sugeridas para el panel (el usuario puede escribir otra). */
window.DV_UNITS = [
  "Por unidad", "Caja x 6", "Caja x 12", "Caja x 20", "Caja x 24",
  "Pack x 6", "Fardo x 10", "Bolsón x 1 kg", "Por kg", "Docena", "Horma"
];
