# Historia del proyecto

## 2026-10-08 · Primera versión

Se acordó una administración privada de un solo departamento en Villa Gesell, sin reservas públicas ni pasarela de pagos. Primera temporada enero–marzo de 2027; calendario libre con conservación de años anteriores.

Se implementaron inicio, calendario mensual de domingo a sábado, fichas de reserva, huéspedes reutilizables y creación dentro de la reserva, tarifas, pagos y garantías, cancelaciones, bloqueos, exportación y acceso por llaves con sesión recordada.

Reglas confirmadas: semana de 6 noches a precio fijo comenzando cualquier día, quincena de 13 noches a dos tarifas semanales, modalidad nocturna y paquetes con noches adicionales. Se permite el cambio de huéspedes en la misma fecha.

La infraestructura elegida es íntegramente Cloudflare: un Worker con archivos estáticos, API y D1. Se sustituyó la propuesta inicial de Supabase por tener ocupado el cupo gratuito del propietario.

El desarrollo y las pruebas son locales. La publicación requiere crear una cuenta Cloudflare gratuita. Las tarifas reales todavía deben cargarse y falta la verificación en iPhone físico.

Se cambió el nombre del Worker a appquiler para usar la dirección appquiler.controlvg.workers.dev. La base remota y su identificador todavía deben sincronizarse con la configuración del repositorio.

Se configuró la base remota D1 appquiler con el ID proporcionado por el propietario y SITE_ORIGIN=https://appquiler.controlvg.workers.dev. La conexión de compilaciones apunta a neo81/AppQuiler. Falta aplicar el esquema remoto y habilitar el primer dispositivo.

Se retiró SETUP_TOKEN después de confirmar el primer acceso. Se agregaron observaciones del huésped al alta desde reservas, indicación de nombre sin apellido y búsqueda por observaciones. Se reutiliza el campo existente notes, sin cambios de esquema.

Se reemplazó el teléfono por observaciones en las opciones de huéspedes y se agregó un bloque con el texto completo del huésped seleccionado para distinguir nombres iguales.

Se corrigió la edición de cantidad de personas para permitir un valor vacío mientras se escribe. Se eliminó la modalidad manual del formulario y el servidor calcula automáticamente semanas y noches adicionales según las fechas. Se preservó el cálculo histórico para restaurar respaldos previos.

Se movieron los datos identificatorios del huésped al encabezado de la ficha de reserva, debajo del nombre. Se agregó compatibilidad visual con estadías automáticas de más de dos semanas.

Se reemplazaron etiquetas diarias por barras continuas por fila semanal, con filas separadas para salidas e ingresos coincidentes.

Se aumentó la tipografía móvil de calendario, formularios, detalles y resúmenes, y el área de controles táctiles. Las barras móviles pasan de 9 a 12 px y los números de fechas de 11 a 14 px.

Se corrigió el desbordamiento del inicio móvil con reservas cargadas: tabla convertida a fichas verticales, cabecera flexible, saldos debajo de cada persona y bloque inferior en una cuadrícula adaptable.

Se amplió nuevamente la tipografía de las fichas móviles tras la prueba en iPhone real: nombres, fechas, importes, estado y saldos. Se aumentó el contraste de textos secundarios.

Se corrigió la superposición del encabezado al abrir el menú móvil, se cambió la barra de estado de iOS a default, se capitalizó Gesell y se aclararon la descripción del departamento y los filtros del resumen.
