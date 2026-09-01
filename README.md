# Chimichurri Diseño Express

Fuente estática de `chimichurridiseno.com`.

Netlify publica el directorio raíz. El archivo `_redirects` expone las aplicaciones auxiliares mediante proxies internos, para que las URLs públicas permanezcan bajo el dominio principal:

- `https://chimichurridiseno.com/bienvenida/`
- `https://chimichurridiseno.com/formulario/`
- `https://chimichurridiseno.com/demoweb/` — demo oficial de web para Distribuidora del Valle.
- `https://chimichurridiseno.com/demoweb/catalogo.html` — demo oficial de catálogo y lista de precios.

La demo vive en `demoweb/` como una carpeta estática aislada. Sus datos, marca y
contacto son ficticios y propios del ejemplo; no comparte rutas ni archivos con el
sitio institucional.
