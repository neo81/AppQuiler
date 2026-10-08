# Historia del proyecto

## 2026-10-08 · Primera versión

Se acordó una administración privada de un solo departamento en Villa Gesell, sin reservas públicas ni pasarela de pagos. Primera temporada enero–marzo de 2027; calendario libre con conservación de años anteriores.

Se implementaron inicio, calendario mensual de domingo a sábado, fichas de reserva, huéspedes reutilizables y creación dentro de la reserva, tarifas, pagos y garantías, cancelaciones, bloqueos, exportación y acceso por llaves con sesión recordada.

Reglas confirmadas: semana de 6 noches a precio fijo comenzando cualquier día, quincena de 13 noches a dos tarifas semanales, modalidad nocturna y paquetes con noches adicionales. Se permite el cambio de huéspedes en la misma fecha.

La infraestructura elegida es íntegramente Cloudflare: un Worker con archivos estáticos, API y D1. Se sustituyó la propuesta inicial de Supabase por tener ocupado el cupo gratuito del propietario.

El desarrollo y las pruebas son locales. La publicación requiere crear una cuenta Cloudflare gratuita. Las tarifas reales todavía deben cargarse y falta la verificación en iPhone físico.
