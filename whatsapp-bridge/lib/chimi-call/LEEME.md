# CHIMI CALL

Canal de voz privado de Lucas. Los agentes con acceso operativo autorizado al BRAIN pueden iniciar una llamada manual mediante la función privada de Postgres. El agente de voz recibe el nombre del agente solicitante y un motivo breve. La voz usa GPT-Live y el celular recibe una llamada convencional de Twilio. No se agrega ninguna tarea programada.

## Diagnóstico sin gastar

En CHIMI_BRAIN ejecutar `select chimi_voice.check_setup();`. El resultado es un ID de consulta. Después ejecutar `select chimi_voice.request_result(ID);`. El diagnóstico consulta la cuenta y los números de Twilio, los permisos de Argentina, el modelo de OpenAI y el registro BRAIN. Puede pasar aunque la organización de API no tenga saldo. Comprobar los créditos en la organización que realmente factura la clave.

## Habilitación y prueba

El sistema se instala con llamadas deshabilitadas. Antes de habilitarlo, confirmar que el número personal configurado sigue siendo de Lucas, el precio estimado y su autorización para la primera prueba. Una cuenta Twilio de prueba bloquea Media Streams. Se precisa una cuenta de pago, permiso a Argentina y un número apto ya provisionado. Con más de uno, fijar TWILIO_VOICE_FROM en el proyecto chimichurriweb. Con uno solo se selecciona el número elegible verificado. El destino es CHIMI_VOICE_TO o, en su ausencia, el celular argentino registrado bajo CHIMI_WHATSAPP_TO. El solicitante jamás pasa un teléfono en el cuerpo.

En el BRAIN, un operador puede habilitar con `update chimi_voice.settings set enabled=true where singleton;` y deshabilitar con el mismo comando usando `false`. Con permiso expreso, llamar una sola vez con `select chimi_voice.request_call(gen_random_uuid(), 'ORCHESTRATOR', 'Primera prueba de voz con Lucas');`. Conservar el ID de consulta devuelto para leer el resultado. Ante un resultado incierto verificar en Twilio Call Logs antes de cualquier nuevo intento. El ID de la petición HTTP se consulta con request_result. El estado submitted y un Call SID indican que Twilio aceptó el pedido. Sólo una conversación audible en ambos sentidos confirma la prueba.

## Uso por los agentes

El operador le pide a su agente que llame por un motivo concreto. El agente con acceso privilegiado ya concedido al BRAIN invoca request_call con un UUID nuevo por solicitud y sin reutilizar la aprobación para otra llamada. Un agente sin acceso al BRAIN necesita una integración privada autorizada. La presencia de la función no otorga privilegios adicionales. También existe POST /api/chimi-call/call con autenticación Bearer sólo para un backend autorizado, y POST /api/chimi-call/check para el diagnóstico. No distribuir el secreto general del BRAIN.

La reserva atómica limita a una llamada cada seis minutos y cuatro cada 24 horas. Twilio corta a los cuatro minutos. El audio viaja en ambos sentidos con Media Streams sobre WSS. Se verifica la firma de Twilio y se vincula el stream al Call SID reservado. La app no guarda audio. Pruebas locales desde lib/chimi-call con `node --test *.test.mjs`.
