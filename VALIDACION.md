# Validación · 2026-10-08

## Resultado local

- TypeScript: compilación estricta sin errores.
- Vite: compilación de producción correcta; JavaScript aproximado de 113 KB comprimido.
- Worker: compilación mediante `wrangler deploy --dry-run`, sin publicación.
- 23 pruebas automáticas de reglas comerciales, restricciones SQLite y fronteras de seguridad: aprobadas.
- Un escenario completo de navegador con múltiples comprobaciones sobre Worker y D1 local: aprobado.
- Exportación y restauración en una segunda base D1 local: aprobadas. El respaldo de prueba recuperó 2 huéspedes, 3 reservas, 3 movimientos y 1 cambio auditado.

## Flujo comprobado en navegador

Se habilitó una passkey mediante autenticador virtual, se configuró una tarifa, se creó un huésped dentro de una reserva y se guardó la semana de seis noches. Se registraron seña y garantía. Se simuló el envío simultáneo de dos reservas para las mismas fechas: una aceptada y otra rechazada. Se repitió el mismo pago en paralelo y se guardó una sola vez.

Se comprobaron el rechazo de cobros superiores al saldo, una edición con versión desactualizada, datos inválidos, accesos sin sesión y solicitudes desde otro origen. Se canceló una reserva, se preservaron cobros e historial y se pudo volver a ocupar su fecha liberada.

Se comprobó que la sesión persistía al recargar; luego se cerró sesión y se volvió a ingresar con la llave. Se habilitó una segunda llave mediante invitación, se rechazó reutilizar el código y se revocó la segunda llave, eliminando su acceso a la API. Un nombre y unas notas con etiquetas HTML se mostraron como texto sin ejecutar JavaScript.

## Verificación visual

Se revisaron capturas a 1440 px y 390 px de ancho. El calendario mantiene las siete columnas, con domingo primero. No hay desbordamiento horizontal de página ni del formulario móvil. El menú lateral cerrado no recibe foco en móvil.

Las capturas `inicio-pc.png`, `calendario-pc.png`, `calendario-iphone.png` y `ficha-reserva.png` corresponden a la aplicación funcional usando **datos ficticios de pruebas**. No se cargaron en la base local de uso.

## Límites pendientes

- No se ha publicado en Cloudflare ni verificado su configuración remota, cuotas o mitigación DDoS en producción.
- No se ha probado la instalación, Face ID, passkeys sincronizadas ni sesiones de PWA en un iPhone físico. El tamaño móvil se verificó en Chromium, no en Safari nativo.
- No se realizó un pentest externo ni una prueba de ataque DDoS. Las protecciones implementadas reducen riesgos; no garantizan disponibilidad absoluta.
- Falta cargar las tarifas reales y habilitar los dispositivos del propietario.
- Los respaldos externos requieren descargarse: no se configuró un servicio automático de copias fuera de Cloudflare.
- La restauración se realiza en una base nueva con la herramienta incluida, no mediante un botón que sobrescriba la aplicación.

La cuenta gratuita de Cloudflare aún debe ser creada por el propietario. Los archivos están listos para continuar con esa configuración sin utilizar Supabase.
