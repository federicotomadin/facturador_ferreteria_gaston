# Plan — Control de stock (Ferretería Gastón)

## 1. Objetivo

Reemplazar la planilla de Excel con la que hoy Gastón controla el stock por un sistema web que permita:

- Controlar el stock de más de 4.500 productos.
- Registrar cada venta desde el mostrador escaneando el código de barras, para que se descuente del stock.
- Avisar cuando un producto llega al stock mínimo y no dejar vender más de lo que hay.
- Recibir un resumen semanal por email con las ventas y los productos que hay que reponer.

El sistema es solo de control de stock: no maneja pagos, no emite facturas ni comprobantes y no se integra con AFIP/ARCA.

## 2. Stack

| Capa           | Tecnología                         | Hosting                                    |
| -------------- | ---------------------------------- | ------------------------------------------ |
| Frontend       | React + Vite + Tailwind CSS        | GitHub Pages                               |
| Backend (API)  | Node.js + NestJS                   | Render (plan gratuito para empezar)        |
| Base de datos  | PostgreSQL                         | Supabase (plan gratuito)                   |
| ORM            | Prisma                             | —                                          |
| Autenticación  | Email + contraseña, JWT            | —                                          |
| Emails         | Brevo (plan gratis, 300/día)       | —                                          |
| Tareas programadas | GitHub Actions (cron semanal que llama a la API) | —                        |

Estructura del repo: un solo repositorio con `frontend/` y `backend/`. Cómo levantarlo en local y cómo publicarlo está en el `README.md`.

Versiones: Node 24, NestJS 12, Prisma 7, React 19, Vite 8, Tailwind 4. En local, Postgres corre en Docker en el puerto 5433.

### Convenciones

- Todo el código en inglés: nombres de variables, funciones, tablas, comentarios y mensajes de error de la API. Solo los textos que ve el usuario en la UI van en español.

### Hardware

- Kit Memoprint MPE2000: impresora térmica de tickets de 80 mm + lector de código de barras.
- El lector funciona como un teclado: "escribe" el código y manda Enter. No necesita integración especial; alcanza con que el buscador de la pantalla de venta tenga el foco.
- Como no se emiten comprobantes, la impresora térmica no se usa por ahora. Los reportes de stock se imprimen en una impresora común.

## 3. Requisitos

### 3.1 Productos y categorías
- [ ] Importar el Excel existente (más de 4.500 productos con código, descripción y cantidad).
- [ ] Clasificar en categorías o rubros (electricidad, agua, gas, accesorios...). Se definen al revisar el Excel.
- [ ] Alta, baja y modificación de productos.
- [ ] Stock mínimo por producto (5 por defecto, editable).
- [ ] Buscar por código, descripción o escaneando el código de barras.
- [ ] Guardar costo y precio de venta (vienen en archivos distintos, ver sección 7).

### 3.2 Stock
- [ ] Cada venta descuenta stock automáticamente.
- [ ] Ingreso de mercadería (reposición) y ajustes manuales.
- [ ] Historial de movimientos por producto.
- [ ] Reporte de stock imprimible y exportable a PDF (completo, por categoría y productos bajo el mínimo).

### 3.3 Ventas (pantalla de mostrador)
- [x] Escanear (o buscar por código o nombre, sin acentos): el producto se agrega a la cesta con 1 unidad. Volver a escanearlo suma una más.
- [x] La cantidad se puede cambiar en la cesta.
- [x] Si con la venta el producto queda en el stock mínimo o por debajo, se muestra un aviso, pero se puede seguir.
- [x] Si la cantidad supera el stock disponible, se muestra "Stock insuficiente para la cantidad ingresada" y no se puede confirmar. Un producto con stock 0 no se agrega.
- [x] "Confirmar venta" (F9) descuenta el stock y muestra qué productos hay que reponer.
- [x] Si el código escaneado no existe, se puede dar de alta el producto ahí mismo (código, descripción, cantidad, costo, precio, stock mínimo y categoría). Si tiene stock, se agrega a la cesta.
- Los productos sin precio se pueden vender igual; el total en pesos es solo de referencia.
- Sin stock cargado no se puede vender. Por eso hay que cargar la planilla de stock antes de empezar a usar el sistema en el local.
- [ ] Anular una venta (devuelve el stock).

### 3.4 Reporte semanal por email
- [ ] Resumen de la semana: productos vendidos, cantidades y total en dinero.
- [ ] Lista de productos por debajo del stock mínimo para reponer.
- [ ] Envío automático al email del usuario.

### 3.5 Usuarios
- [ ] Login con email y contraseña.
- [ ] Recuperar la contraseña: se manda un link por email para crear una nueva.
- TODO: ¿cuántos usuarios? ¿hace falta distinguir roles (dueño / empleado)?

## 4. Etapas

1. **MVP**: login, importación del Excel, productos y categorías, stock y pantalla de venta.
2. Reporte de stock y reporte semanal por email.

## 5. Fuera de alcance

- Pagos: el sistema no cobra ni registra medios de pago.
- Facturas y comprobantes, incluida la integración con AFIP/ARCA.
- Clientes con cuenta corriente, proveedores y compras, caja: TODO confirmar si hacen falta.

## 6. Preguntas abiertas / notas

- Render gratuito: el servidor se duerme tras ~15 min sin uso y tarda ~30-50 s en despertar. Para un mostrador conviene pasar al plan pago (~USD 7/mes).
- Supabase gratuito: el proyecto se pausa tras 7 días sin actividad y no incluye backups descargables. Hacer backups periódicos de la base.

## 7. Datos de origen

### `LISTA_ROOFTECH_Precios_Venta.csv`

- Columnas: `Código`, `Producto`, `Cód. Prov`, `Prov`, `Precio` (precio de venta). No tiene cantidad ni costo.
- 2.534 productos (no 4.500).
- Códigos con formato `*00001`. El `*` es el delimitador de Code 39: el lector devuelve `00001`, así que el código se guarda sin el asterisco.

Problemas a resolver en la importación:

| Problema | Cantidad |
| --- | --- |
| Productos con precio 0 | 1.327 (52%) |
| Precio vacío | 3 |
| Códigos duplicados (`*30442`, `*31003`) | 2 |
| Fila sin código | 1 |
| Filas con valores sueltos en columnas sin encabezado | 15 |
| Descripciones duplicadas con distinto código | 9 |
| Sin código de proveedor | 878 |
| Sin proveedor | 22 |
| Proveedores escritos de distintas formas (`Adri`/`ADRI`, `Calvo Elec`/`calvo Elec`, `Louzan`/`Louzam`) | ~10 casos |

Categorías (clasificación automática por palabras clave, reglas en `backend/prisma/import/category-rules.ts`):

| Categoría | Productos |
| --- | --- |
| Agua y sanitarios | 602 |
| Herramientas | 441 |
| Electricidad | 301 |
| Fijaciones | 297 |
| Cerrajería y herrajes | 245 |
| Pinturería | 102 |
| Gas | 77 |
| Adhesivos y construcción | 73 |
| Sin clasificar (a revisar) | 393 |

El script de importación genera `import-review.csv` con todos los problemas encontrados, para que Gastón los revise.

### Planilla de stock (la de la captura)

- Columnas: `Código`, `Producto`, `Cód. Prov`, `Prov`, `Cantidad`, `Ventas`, `Saldo`, `Costo`.
- TODO: conseguir este archivo. Es el que tiene el stock actual (`Saldo`) y el costo. Se cruza con la lista de precios por `Código`.
- TODO: ¿la lista de 4.500 productos está en otro archivo u hoja?
