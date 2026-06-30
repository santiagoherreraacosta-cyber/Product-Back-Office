# Seguridad del Product Back Office

Este documento define los controles mínimos para operar el asistente y cualquier endpoint asociado, especialmente `/api/chat`.

## 1. Variables de entorno para API keys

- Las API keys se cargan únicamente desde variables de entorno del servidor, por ejemplo `OPENAI_API_KEY`.
- `.env.example` documenta las variables requeridas sin incluir secretos reales.
- Los secretos no deben versionarse ni copiarse a documentación, logs, issues o capturas.

## 2. Nunca exponer API keys en frontend

- El frontend no debe importar, interpolar ni renderizar API keys.
- No usar prefijos públicos como `VITE_`, `NEXT_PUBLIC_` o equivalentes para secretos.
- Toda llamada a proveedores externos debe pasar por backend; el navegador llama a `/api/chat` sin conocer claves privadas.

## 3. Rate limiting en `/api/chat`

- `/api/chat` aplica límite por usuario/equipo mediante `RATE_LIMIT_WINDOW_MS` y `RATE_LIMIT_MAX`.
- La respuesta esperada al exceder el límite es `429`.
- En producción se recomienda usar almacenamiento compartido como Redis para que el límite funcione entre réplicas.

## 4. Validación de input con schemas

Schema lógico de `/api/chat`:

```json
{
  "message": "string requerido, 1..2000 caracteres",
  "context": "array opcional, máximo 10 documentos",
  "context[].title": "string opcional, máximo 120 caracteres normalizados",
  "context[].content": "string opcional, máximo 1000 caracteres normalizados"
}
```

- Rechazar payloads inválidos con `400` antes de llamar a modelos o herramientas.
- Mantener allowlists de campos; ignorar o rechazar campos inesperados cuando se agregue persistencia.

## 5. Sanitización de contenido renderizado

- El contenido generado por usuarios o modelos se inserta como texto escapado, no como HTML confiable.
- Si se necesita Markdown enriquecido, pasarlo por un sanitizador con allowlist de etiquetas y atributos.
- Nunca renderizar scripts, handlers `on*`, iframes o URLs `javascript:` provenientes del chat/RAG.

## 6. Protección contra prompt injection en contexto/RAG

- Tratar documentos RAG como datos no confiables, no como instrucciones.
- Separar instrucciones del sistema de citas/contexto recuperado.
- Redactar patrones de exfiltración como solicitudes de revelar secretos, system prompts o API keys.
- Registrar fuente, fecha y permisos de cada documento usado en respuestas.

## 7. Autorización por ciclo/equipo

- Cada request a `/api/chat` debe incluir identidad de usuario, equipo y ciclo (`X-User-Id`, `X-Team-Id`, `X-Cycle-Id`).
- El servidor verifica que el ciclo pertenezca al equipo autorizado antes de procesar el mensaje.
- En producción, reemplazar `TEAM_ACCESS` por verificación de sesión/JWT y permisos en base de datos.

## 8. CORS restringido

- `ALLOWED_ORIGINS` contiene la allowlist explícita de dominios permitidos.
- No usar `*` con credenciales ni aceptar orígenes dinámicos sin validación.
- Responder `403` a orígenes no permitidos antes de ejecutar lógica de negocio.

## 9. Política de retención de datos

- Por defecto, el servidor demo no persiste contenido de chat.
- Si se habilita persistencia, definir TTL por tipo de dato: mensajes crudos, embeddings, briefs exportados, auditoría y backups.
- Minimizar PII; anonimizar o borrar datos al cerrar ciclos si no son necesarios para aprendizaje agregado.
- Documentar base legal, responsables y procedimiento de eliminación por solicitud.

## 10. Backups de base de datos

- Programar backups automáticos cifrados con rotación y separación de credenciales.
- Probar restauraciones periódicamente; un backup no verificado no cuenta como respaldo operativo.
- Mantener al menos una copia fuera de la región/proveedor principal.
- Restringir acceso a backups con MFA, auditoría y principio de menor privilegio.

## Checklist de despliegue

- [ ] `OPENAI_API_KEY` definida solo en el runtime del servidor.
- [ ] `ALLOWED_ORIGINS` limitado a dominios reales.
- [ ] Rate limit respaldado por store compartido en producción.
- [ ] Autorización integrada con identidad real.
- [ ] Sanitización revisada si se habilita Markdown/HTML dinámico.
- [ ] Política de retención aprobada por negocio/legal.
- [ ] Backups cifrados y restauración probada.
