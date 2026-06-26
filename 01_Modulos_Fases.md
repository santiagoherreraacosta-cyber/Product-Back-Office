# 01 — Módulos operativos F0–F5

## F0 — Definición del comportamiento

### Objetivo
Convertir un problema ambiguo en un comportamiento observable, situado en un segmento y conectado a una métrica.

### Inputs mínimos
- Comportamiento esperado.
- Comportamiento actual.
- Segmento afectado.
- Momento del journey.
- Métrica relacionada.

### Preguntas guía
1. ¿Qué acción concreta esperábamos que el usuario hiciera?
2. ¿Quién exactamente no la está haciendo?
3. ¿En qué momento del journey ocurre el drop-off?
4. ¿Cuál es el baseline y cuál era la expectativa?
5. ¿Qué evidencia muestra que este problema existe?

### Gate de salida
Puedes pasar a F1 si existe una formulación como:

> “En [segmento], después de [momento], esperamos que hagan [comportamiento], pero hoy solo [dato]. Esto afecta [métrica].”

### Trampas
- Confundir un KPI con un comportamiento.
- Definir el problema como solución: “necesitamos onboarding”.
- Mezclar segmentos con motivaciones distintas.
- Usar promedios que esconden cohortes.

## F1 — Diagnóstico

### Objetivo
Identificar hipótesis causales sobre por qué el comportamiento no ocurre.

### Inputs mínimos
- Problema F0.
- Evidencia cuantitativa o cualitativa.
- Momentos de fricción conocidos.

### Marco de diagnóstico
Clasifica causas posibles:

- **Motivación:** el usuario no quiere o no ve valor.
- **Claridad:** no entiende qué hacer o por qué.
- **Confianza:** percibe riesgo o duda del resultado.
- **Capacidad:** no tiene recursos, conocimiento o setup.
- **Fricción:** el proceso es largo, difícil o falla.
- **Incentivo:** el sistema premia otra conducta.

### Preguntas guía
1. ¿Qué señales tenemos de la causa?
2. ¿Qué explicación alternativa también podría ser cierta?
3. ¿La fricción ocurre antes, durante o después del Aha?
4. ¿El problema es de intención, comprensión o ejecución?
5. ¿Qué dato mínimo distinguiría entre hipótesis?

### Gate de salida
Puedes pasar a F2 si existe:

- Hipótesis causal principal.
- Evidencia que la sostiene.
- Evidencia faltante marcada.
- Riesgo de explicación alternativa.

### Trampas
- Diagnosticar desde opiniones internas.
- Tratar síntomas como causas.
- Elegir la causa que hace más fácil la solución preferida.
- Ignorar usuarios que sí completan el comportamiento.

## F2 — Diseño de intervención

### Objetivo
Diseñar un cambio mínimo que apunte a la causa diagnosticada.

### Inputs mínimos
- Comportamiento objetivo.
- Hipótesis causal.
- Segmento.
- Restricciones de negocio/operación.

### Tipos de intervención
- Clarificar próximo paso.
- Reducir riesgo percibido.
- Aumentar compromiso.
- Reordenar el journey.
- Simplificar configuración.
- Introducir prueba social o evidencia.
- Crear feedback inmediato.

### Preguntas guía
1. ¿Qué creencia, emoción o fricción debe cambiar?
2. ¿Cuál es el cambio mínimo que podría modificarla?
3. ¿Dónde debe aparecer la intervención?
4. ¿Qué comportamiento esperamos ver después?
5. ¿Qué daño podría causar si nos equivocamos?

### Gate de salida
Puedes pasar a F3 si la intervención tiene:

- Causa atacada.
- Mecanismo esperado.
- Segmento y momento.
- Métrica primaria.
- Riesgos.

### Trampas
- Diseñar una feature completa cuando basta un estímulo pequeño.
- Optimizar UX sin cambiar la causa.
- Agregar pasos bajo la excusa de educar.
- No definir el mecanismo psicológico/operativo.

## F3 — Experimento

### Objetivo
Convertir la intervención en un aprendizaje medible.

### Inputs mínimos
- Intervención propuesta.
- Métrica primaria.
- Eventos disponibles.
- Criterio de éxito/fallo.

### Diseño mínimo
Define:

- Hipótesis.
- Variante o intervención.
- Audiencia.
- Duración o tamaño de muestra.
- Métrica primaria.
- Métricas guardrail.
- Decisión predefinida.

### Preguntas guía
1. ¿Qué tendría que pasar para creer que funcionó?
2. ¿Qué señal temprana sería suficiente para iterar?
3. ¿Qué métrica podría mejorar falsamente?
4. ¿Qué segmento queda excluido?
5. ¿Qué decisión tomaremos con cada resultado?

### Gate de salida
Puedes pasar a F4 si están definidos:

- Éxito.
- Fallo.
- Resultado inconcluso.
- Acción para cada caso.

### Trampas
- Medir demasiadas cosas sin prioridad.
- Cambiar criterios después de ver resultados.
- Confundir engagement superficial con activación.
- No instrumentar guardrails.

## F4 — Decisión

### Objetivo
Tomar una decisión explícita con base en evidencia.

### Opciones de decisión
- Escalar.
- Iterar.
- Pausar.
- Descartar.
- Re-diagnosticar.

### Preguntas guía
1. ¿Qué ocurrió contra el criterio definido?
2. ¿Qué aprendimos sobre la causa?
3. ¿Qué no podemos concluir?
4. ¿La intervención movió comportamiento o solo métricas proxy?
5. ¿Qué decisión minimiza costo de oportunidad?

### Gate de salida
Puedes pasar a F5 si hay:

- Decisión tomada.
- Racional documentado.
- Aprendizaje explícito.
- Próximo paso.

### Trampas
- Declarar éxito por una métrica secundaria.
- Escalar sin entender mecanismo.
- Iterar eternamente sin decisión.
- Ignorar efectos negativos en guardrails.

## F5 — Patrón de aprendizaje

### Objetivo
Convertir el ciclo en memoria reutilizable para Dropi.

### Inputs mínimos
- Problema original.
- Diagnóstico.
- Intervención.
- Resultado.
- Decisión.

### Preguntas guía
1. ¿Qué patrón de comportamiento vimos?
2. ¿En qué segmento aplica?
3. ¿Qué intervención funcionó o no funcionó?
4. ¿Qué condiciones deben cumplirse para reutilizarlo?
5. ¿Qué antipatrones debemos evitar?

### Salida
Usa la plantilla “Patrón de aprendizaje” de `02_Plantillas_Entregables.md`.

### Trampas
- Guardar anécdotas como reglas generales.
- Omitir condiciones de contexto.
- No distinguir evidencia de interpretación.
- Reutilizar patrones fuera del segmento original.
