# Gesell · Control de alquiler

Aplicación privada para administrar un departamento en Villa Gesell. React + TypeScript, PWA, Cloudflare Workers con archivos estáticos y D1. Toda la infraestructura de publicación pertenece a Cloudflare; no utiliza Supabase.

## Qué incluye

- Inicio con resumen por enero–marzo o año completo, próximos ingresos, saldos y ocupación.
- Calendario mensual de domingo a sábado, sin límite de temporada, con ingresos, salidas y bloqueos.
- Reservas con ficha, horarios ajustables, edición con protección frente a cambios simultáneos y cancelación con historial.
- Huéspedes guardados: seleccionar existentes o crear uno nuevo dentro de la reserva; edición de contacto, notas e historial.
- Tarifas generales con vigencia desde una fecha. Cada reserva conserva sus valores y permite ajustarlos.
- Seña y pagos parciales (como pagos de alquiler), medios de pago, garantía y devoluciones parciales o totales.
- Exportación completa del negocio en JSON, herramienta de restauración en una base nueva y auditoría de cambios.
- Acceso con passkeys, sin usuarios ni contraseñas de uso cotidiano. Sesión recordada por 30 días; códigos de alta de un solo uso para otro dispositivo.
- Instalación como PWA en iPhone. Requiere internet para operar; no sincroniza escrituras offline.

## Reglas comerciales

| Modalidad | Duración | Precio |
|---|---|---|
| Noche | Diferencia entre salida e ingreso | Noches × tarifa nocturna |
| Semana | 6 noches / 7 fechas de calendario | Una tarifa semanal |
| Quincena | 13 noches / 14 fechas de calendario | Dos tarifas semanales |
| Combinada | Semana o quincena + noches adicionales | Paquete base + adicionales × tarifa nocturna |

Los paquetes pueden comenzar cualquier día. El servidor recalcula el total: no confía en el valor enviado por la pantalla. Los importes se guardan en centavos enteros.

Se permite salida e ingreso el mismo día. La disponibilidad se controla por fechas, no por horas; coordiná los horarios al editar la ficha. La fecha final de un bloqueo queda libre.

Las tarifas de referencia aplican desde su vigencia hasta la siguiente. Se usa la tarifa del ingreso, incluso si la estadía cruza meses. No hay un descuento fuera de temporada automático: la última tarifa sigue vigente hasta que agregues otra o ajustes la reserva. No se cargaron precios reales porque aún no fueron informados.

El indicador «Cobrado en el período» suma pagos de alquiler menos sus devoluciones según la fecha del movimiento. «Saldo pendiente» y «Total acordado» corresponden a reservas activas que cruzan el período elegido. Los depósitos no se cuentan como ingresos por alquiler y las reservas canceladas no generan saldo pendiente en el inicio.

## Probar en esta computadora

1. Ejecutá `INICIAR.cmd`. Requiere Node.js 24 o superior; instala dependencias si faltan.
2. Abrí **http://localhost:8787** (usá localhost; una dirección IP no sirve como dominio de passkey).
3. En la primera habilitación, ingresá el nombre del dispositivo y el valor `SETUP_TOKEN` del archivo local `.dev.vars`.
4. Aceptá crear una llave con Windows Hello, un teléfono compatible u otro autenticador.
5. Configurá la tarifa por noche y semanal en «Tarifas»; después cargá tus reservas.

`.dev.vars` contiene un secreto de habilitación local. No lo publiques ni lo subas al repositorio. Las pruebas utilizan bases separadas bajo `.wrangler/`; la base de uso local comienza vacía.

Alternativamente:

```sh
npm ci
npm run setup:local
npm run db:local
npm run dev
```

La interfaz debe reconstruirse después de editar sus archivos. El Worker se recarga automáticamente con Wrangler. `vite.config.ts` queda como configuración de compilación, no como servidor independiente de autenticación.

## Publicar gratis en Cloudflare

La publicación requiere tu cuenta gratuita de Cloudflare y su autorización. No se han creado recursos remotos ni contratado planes.

1. Creá la cuenta de Cloudflare y autenticá Wrangler con `npx wrangler login`.
2. Creá una base D1 dedicada: `npx wrangler d1 create gesell`.
3. Copiá el `database_id` real al binding `DB` de `wrangler.jsonc`. La configuración actual ya apunta a la base appquiler del propietario; no crees otra base para esta publicación.
4. Elegí una dirección estable bajo tu subdominio gratuito de Workers, por ejemplo el nombre del Worker `appquiler` más el subdominio asignado a tu cuenta. No hace falta comprar un dominio.
5. Configurá `vars.SITE_ORIGIN` en `wrangler.jsonc` con esa dirección completa **HTTPS**, sin ruta. Debe coincidir exactamente con el origen público. No adivines el subdominio; verificá el que asignó Cloudflare.
6. Generá un código aleatorio de 32 bytes y guardalo como secreto con `npx wrangler secret put SETUP_TOKEN`. No uses el código local en producción ni lo pongas en `vars`.
7. Aplicá el esquema: `npx wrangler d1 migrations apply gesell --remote`.
8. Compilá y publicá: `npm run deploy`.
9. Habilitá el primer dispositivo con el código inicial. Luego retiralo con `npx wrangler secret delete SETUP_TOKEN`: no se usa para el acceso cotidiano ni para invitar otros dispositivos.
10. En Configuración, generá un código de invitación para cada nueva llave. Es válido por 10 minutos y se usa una vez.
11. En iPhone abrí la dirección en Safari → Compartir → Agregar a inicio. La PWA puede tener una sesión propia; habilitala o entrá con la llave ya disponible.

Las passkeys dependen del dominio. Si cambiás de dirección, planificá la rehabilitación de accesos. Activá MFA en la **cuenta de Cloudflare**, que controla el servidor y permite recuperar la aplicación. No es un inicio de sesión cotidiano de esta PWA.

## Seguridad implementada

- Base de datos accesible desde el binding privado del Worker. No hay credenciales D1 en el cliente ni endpoints públicos de lectura de reservas.
- Verificación de passkeys con SimpleWebAuthn, challenge de 5 minutos de un solo uso, verificación de origen, RP ID y presencia/verificación del usuario.
- Una administración compartida con varias llaves revocables; sesiones opacas de 30 días guardadas por su hash. Cookie HttpOnly, SameSite Strict y Secure en HTTPS. Revocar una llave elimina sus sesiones.
- Alta inicial cerrada mediante secreto; alta posterior mediante invitación temporal y consumo único protegido por la base.
- Validación del origen de todas las escrituras y bloqueo de solicitudes entre sitios. El hostname público debe coincidir con SITE_ORIGIN. No hay CORS abierto.
- Límites antes de consultar datos: 120 solicitudes/minuto por IP; autenticación 30/minuto por IP; operaciones privadas 120/minuto por llave. Los contadores de Cloudflare son aproximados y por ubicación, no una cuota global infalible.
- Límite de cuerpo JSON de 16 KB medido durante la lectura; validación con Zod en servidor; SQL parametrizado.
- Disparadores de base que impiden reservas/bloqueos superpuestos y cobros o devoluciones fuera de sus límites. Versión de reserva para evitar sobrescribir ediciones de otro dispositivo.
- Identificador único de pago con respuesta idempotente, también frente a envíos simultáneos.
- CSP restrictiva, HTTPS en producción, no framing, no recursos externos ni analítica. React escapa textos de huéspedes y notas.
- Respuestas privadas con `Cache-Control: no-store`; el service worker solo almacena la página offline y sus recursos públicos.
- Dependencias exactas y archivo de bloqueo.

La protección no garantiza disponibilidad absoluta. Ataques distribuidos pueden agotar cuotas gratuitas aunque no accedan a los datos. Los límites del Worker no reemplazan la mitigación DDoS de la plataforma. La seguridad de un dispositivo desbloqueado y la de tu cuenta Cloudflare siguen siendo necesarias.

## Respaldar y restaurar

Descargá el JSON desde Configuración. La exportación lee las tablas de negocio en un batch consistente y excluye llaves, sesiones e invitaciones. Guardá copias fuera de Cloudflare, especialmente después de registrar reservas o cobros importantes.

Para preparar una restauración:

```sh
node scripts/restore-backup.mjs respaldo.json nueva-base.sql
```

La herramienta valida estructura, precios, referencias, superposiciones y saldos, y genera un SQL con esquema y datos. **Importalo exclusivamente en una nueva base D1 vacía**, sin aplicar previamente la migración inicial:

```sh
npx wrangler d1 create gesell-restaurada
npx wrangler d1 execute gesell-restaurada --remote --file nueva-base.sql
```

Verificá los conteos, cambiá el binding del Worker al nuevo ID y prepará un nuevo SETUP_TOKEN para habilitar accesos. Conservá la base anterior hasta verificar la restauración. No se implementó un botón de importación que sobrescriba datos.

Si perdés **todas** las llaves, desde tu cuenta Cloudflare configurá un nuevo SETUP_TOKEN y eliminá las credenciales en D1 (`DELETE FROM credentials;`). Esa operación revoca todas las sesiones por cascada y permite una nueva habilitación inicial, conservando el negocio. Retirá el secreto después. No ejecutes este procedimiento mientras todavía puedas entrar desde un dispositivo: en ese caso, generá una invitación.

## Pruebas

```sh
npm run build
npm test
npm run test:e2e
```

El test de navegador usa Edge en Windows, autenticador virtual y una base local nueva por ejecución. Para otro equipo configurá `E2E_BROWSER` con la ruta de un navegador Chromium compatible.

Ver [VALIDACION.md](VALIDACION.md) para evidencias y límites. La compatibilidad visual se verificó a 1440 px y 390 px; **no se ha probado aún la instalación ni Face ID en un iPhone físico ni la infraestructura remota**.

Las observaciones del huésped también se cargan al crear una persona desde una reserva. Se puede ingresar solo su nombre y buscar huéspedes por sus observaciones de identificación.

El selector de huéspedes muestra nombre y observaciones de identificación. Al seleccionar una persona, sus observaciones completas quedan visibles debajo.

El formulario calcula la modalidad automáticamente a partir de las fechas: hasta 5 noches se cobra por noche; 6 noches equivalen a una semana, 13 a dos semanas, 20 a tres y 27 a cuatro. Cada semana adicional agrega 7 noches; las restantes usan la tarifa nocturna. No hay una tarifa mensual independiente. Las reservas anteriores conservan su importe hasta que se editen.

La ficha de reserva muestra el teléfono y las observaciones identificatorias del huésped inmediatamente debajo de su nombre.

El calendario muestra cada estadía en barras continuas por semana, con el nombre una vez por tramo y flechas de ingreso, salida o continuación.
