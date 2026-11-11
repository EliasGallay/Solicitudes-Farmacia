-- Rol "Compras" (purchasing): ve las solicitudes con requerimiento de compra y comenta en su historial.
-- Va sola porque Postgres no permite usar un valor nuevo de enum en la misma transacción que lo agrega:
-- aplicar esta y después 202611110002_purchasing_access.sql.
-- Aplicar únicamente en el proyecto remoto de desarrollo revisado.

alter type public.app_role add value if not exists 'purchasing';
