# Auditoría UX/UI & Guía de Diseño - Spensiv

Esta guía establece los principios de diseño, reglas del sistema y auditoría de UX/UI para la aplicación Spensiv, enfocada en mantener una experiencia coherente, accesible y estética para una aplicación de finanzas personales.

## 1. Análisis de QA y UX

### Consistencia Visual
- **Observación**: Buena cohesión general en el uso del modo oscuro y los colores de acento (azul, verde, rojo).
- **Mejora Propuesta**: Estandarizar el uso de gradientes en barras de progreso y gráficos. Evitar la mezcla inconsistente de colores planos y degradados. Unificar el radio de borde (`roundness`) de tarjetas y botones para que la curvatura sea idéntica en todos los componentes y flujos.

### Jerarquía y Legibilidad
- **Problema**: En la pantalla de Préstamos, la información secundaria (TNA, TEM, fechas) compite visualmente con el monto principal, ya que ambos usan tamaños de fuente muy similares.
- **Solución**: Aumentar drásticamente el contraste tipográfico. Los valores principales (ej. monto total, cuota) deben ser más pesados (Bold) y grandes. Las etiquetas secundarias deben ser más tenues (Medium/Regular, color `muted` o con menor opacidad). Implementar `tabular-nums` (fuente monoespaciada para números) en todos los saldos financieros para evitar saltos visuales al cambiar valores.

### Accesibilidad
- **Problema**: Textos grises oscuros sobre fondos negros o grises muy oscuros (como en el sidebar y etiquetas de gráficos) presentan un bajo ratio de contraste.
- **Solución**: Garantizar que todos los textos críticos e informativos cumplan con el estándar WCAG AA (ratio mínimo 4.5:1). Aumentar la luminosidad de los textos secundarios para asegurar su legibilidad.
- **Área de Click (Target Size)**: En la versión de escritorio, los botones iconográficos (como acciones de editar o eliminar en tablas) deben tener un área de click invisible mínima de 44x44px.

### Usabilidad en Flujos Clave
- **Registro de Cobro**: El botón "Registrar cobro" en las tarjetas de préstamos es muy pequeño o confuso. Debe convertirse en un componente de acción clave con mayor área de interacción y peso visual.
- **Claridad de Números (Microcopias)**: En el dashboard, los subtítulos (ej. "Prom: $41k/día · Último: hoy") tienen un tamaño de texto muy chico y carecen de un contraste adecuado. Se deben agrandar ligeramente y usar variables de color que destaquen mejor sobre el fondo.

---

## 2. Reglas del Sistema de Diseño (Propuestas)

### Paleta de Colores
- **Surface**: `#0B0E11` (Fondo principal de la aplicación)
- **Elevated**: `#161B22` (Fondo para tarjetas, modales y secciones elevadas)
- **Primary**: `#2D8CFF` (Acciones principales, botones primarios, enlaces)
- **Success**: `#00C853` (Rendimientos positivos, cobros realizados, ingresos)
- **Warning/Error**: `#FF5252` (Mora, vencimientos inminentes, gastos, alertas)

*Nota: Estos colores se deben integrar en `tailwind.config.ts` ajustando las variables HSL correspondientes para mantener la compatibilidad fluida con TailwindCSS.*

### Tipografía
- **Headlines (Títulos)**: *Inter Bold*. Usar para títulos de secciones, montos principales y destacar datos financieros clave.
- **Body (Cuerpo)**: *Inter Regular/Medium*. Usar para descripciones, etiquetas, subtítulos y texto general.
- **Monospace / Tabular Nums**: Para cifras financieras (saldos, inversiones) es crucial que la fuente use *tabular nums* (números de ancho fijo) para evitar resaltos horizontales y vibraciones visuales cuando los valores fluctúan.

---

## 3. Hallazgos Adicionales: Relevamiento Interactivo en Vivo

A partir de la auditoría analizada en la plataforma (Dashboard, Cartera y Movimientos), se determinaron las siguientes oportunidades de mejora rápida:

- **Dashboard**: El contraste entre los botones principales de acciones ("Nuevo Ingreso" versus "Nuevo Gasto") requiere revisión. Ambos deberían tener un peso visual claro, o diferenciarse por frecuencia de uso (ej. Gasto primary solid, Ingreso primary outline). 
- **Filtros en Tablas de Movimientos**: La disposición es clara, pero no tienen un indicador visual fuerte de estado "Activo". Agregar un punto de notificación o cambiar sutilmente el color del borde al seleccionar un filtro mejora drásticamente el feedback.
- **Estados Vacíos (Empty States)**: Cuando no hay datos (ej. un mes sin movimientos o sin préstamos), incorporar mensajes ilustrativos atractivos con Call to Actions ("Cargá tu primer gasto") en vez de solo mostrar una tabla vacía.
- **Responsive (Gráficos y Header)**: El Bottom Navigation está excelente y muy bien implementado. En móviles, se recomienda asegurar un scroll horizontal (`overflow-x-auto`) natural en los gráficos de Flujo Proyectado para evitar que las barras se amontonen, y considerar reubicar el badge de la cotización MEP ya que puede competir junto a las acciones principales superiores.

---

## 4. Sugerencias de Mejora Estética y Funcional

- **Gráficos y Datos**: Utilizar áreas sombreadas suaves bajo las líneas de tendencia de los gráficos. Esto aporta una sensación de profundidad y modernidad muy propia del nivel de diseño en fintechs.
- **Micro-interacciones**: Asegurar que las tarjetas (especialmente las interactuables como los préstamos individuales) tengan estados de hover sutiles pero efectivos (ej. un ligero cambio en el color de fondo al tono `Elevated` o de bordes, y un `hover:-translate-y-1 transition-transform`).
- **Visualización de Deuda (Mora)**: Implementar un sistema de indicadores sutil pero agresivo en visibilidad para la mora (ej. un borde rojo sutil en la tarjeta `border-l-4 border-destructive/80`). Evitar cubrir toda la tarjeta de rojo para no asustar al usuario, pero dejar el estado crítico sumamente claro.

---

## 5. Auditoría Específica de Préstamos (Loans)

Tras un relevamiento visual detallado en vivo en la vista de Préstamos, se detectaron puntos clave y se resolvieron las siguientes normativas UX:

- **Redundancia de Acciones Primarias (CTAs)**: Se identificó la presencia simultánea de dos botones "Nuevo Préstamo" (uno en el header superior global y otro al costado de los tabs). Debe conservarse **uno solo** (preferentemente el del header global) para evitar ruido visual.
- **Jerarquía en Tarjetas de Resumen**: Los labels de los campos secundarios ("Esta semana", "Capital activo") se pierden al tener el mismo color y peso en blanco que los valores numéricos. Los nombres de estas etiquetas deben pasarse a `text-muted-foreground` para elevar el contraste relativo de los números.
- **Acción Oculta ("Registrar cobro")**: El botón de "Registrar cobro" en las tarjetas de préstamos individuales se mimetiza con el texto estático (color atenuado, sin contornos). Debe volverse un área de acción interactiva clara convirtiéndolo en un botón `variant="secondary"` o `variant="outline"`.
- **Mora No Evidente en Tarjeta Múltiple**: Aunque la "Alerta de Mora" masiva arriba funciona excelente, en la lista del feed no hay una señalética rápida en la tarjeta misma que indique que *eso puntual* está moroso. Incorporar una tira roja de lado del contenedor (`border-l-4`) puede dar aviso rápido e inequívoco sin destruir el diseño minimalista.
