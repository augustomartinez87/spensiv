# Sistema de Cobradores — Documentacion Funcional

## 1. Que se implemento

### El concepto

Un **cobrador** es una persona intermediaria que se encarga de cobrar cuotas de prestamos en tu nombre. Vos le prestas plata a alguien, pero no tenés contacto directo con el deudor — el cobrador es quien gestiona el cobro y después te transfiere.

Ejemplo clasico: le prestas a "Juan" a traves de "Tello". Tello conoce a Juan, le cobra, y después te pasa la plata.

### Que problema resuelve

Sin esta feature, todos los prestamos aparecen como si vos cobraras directamente. En la practica, cuando tenes 10+ prestamos gestionados por 2-3 cobradores, necesitas:

- Saber qué prestamos gestiona cada cobrador
- Mandarle a cada cobrador un resumen claro de qué tiene que cobrar
- No tener que armar ese resumen a mano cada semana

### Que hay en la UI

| Componente | Donde esta | Para que sirve |
|---|---|---|
| **Selector de cobrador** | Crear prestamo / Detalle del prestamo | Asignar o cambiar cobrador |
| **Chip en tarjetas** | Vista lista de prestamos | Ver de un vistazo qué cobrador tiene cada prestamo |
| **Filtro por cobrador** | Vista tabla | Filtrar prestamos por cobrador especifico |
| **Vista "Cobradores"** | Toggle en header de prestamos | Ver todos los prestamos agrupados por cobrador |
| **Mensaje de cobro** | Dentro de cada grupo en vista Cobradores | Generar texto listo para WhatsApp |

### Relacion con el resto del sistema

- Un cobrador es **opcional** — los prestamos directos siguen funcionando exactamente igual
- Un cobrador puede tener **multiples prestamos**
- Un prestamo puede tener **un solo cobrador** (o ninguno)
- Los cobradores son **independientes de las Personas** (deudores) — un cobrador no tiene score de riesgo ni perfil economico
- Si eliminas un cobrador, sus prestamos quedan activos pero sin cobrador asignado

---

## 2. Como se usa paso a paso

### Paso 1: Crear un cobrador

Se puede crear de dos formas:
- **Inline**, al crear un prestamo: tocas el "+" junto al selector de cobrador
- **Desde la vista Cobradores**: boton crear (si no tenes ninguno todavia)

Solo necesitas el **nombre**. El telefono es opcional pero recomendable si vas a copiar mensajes.

> **Buena practica:** Usa el nombre con el que realmente le hablas (ej: "Tello", no "Carlos Alberto Tello Rodriguez").

### Paso 2: Asignar cobrador a un prestamo

**Al crear el prestamo:**
1. Completas los datos normales del prestamo (deudor, capital, tasa, etc.)
2. En el campo "Cobrador (opcional)" seleccionas al cobrador
3. Creas el prestamo

**En un prestamo existente:**
1. Entras al detalle del prestamo
2. Tocas "Asignar cobrador"
3. Seleccionas y confirmas

> **Buena practica:** Asigna el cobrador al momento de crear el prestamo. Si lo haces despues, es facil olvidarse.

### Paso 3: Ver prestamos agrupados

1. En la pagina de Prestamos, toca el boton **"Cobradores"** en el toggle de vistas (junto a Lista, Tabla, Calendario)
2. Vas a ver tarjetas agrupadas por cobrador
3. Cada tarjeta muestra: cantidad de prestamos, capital total, proximo cobro total
4. Dentro de cada tarjeta, los prestamos individuales con su proxima cuota

> **Buena practica:** Usa esta vista al principio de la semana para tener el panorama general de cobranza.

### Paso 4: Generar mensaje de cobro

1. En la vista Cobradores, toca **"Mensaje de cobro"** en la tarjeta del cobrador
2. Se abre un dialogo con el mensaje pre-armado
3. Podes editarlo si queres agregar algo
4. Toca "Copiar al portapapeles"
5. Pegalo en WhatsApp

> **Buena practica:** Genera el mensaje, revisalo 5 segundos, y mandalo. No lo edites mucho — la idea es que sea automatico.

### Paso 5: Registrar pagos

Cuando el cobrador te avisa que cobro:
1. Entras al detalle del prestamo
2. Registras el pago normalmente (boton "Registrar pago")
3. El sistema actualiza cuotas, saldos, etc.

> **Importante:** El sistema no trackea si el cobrador ya cobro o no. Vos registras el pago cuando el cobrador te transfiere la plata.

---

## 3. Logica de negocio

### Cuando un prestamo deberia tener cobrador

| Situacion | Cobrador? |
|---|---|
| Le prestas a un amigo directo y vos le cobras | No |
| Le prestas a alguien que te refirio Tello, y Tello cobra | Si — cobrador: Tello |
| Tenes una deuda propia (soy deudor) | No — los cobradores solo aplican a "soy prestamista" |
| Prestamo sin interes a un familiar | No |

**Regla simple:** si vos NO sos quien le manda el mensaje de "che, me debes la cuota", entonces necesitas un cobrador.

### Criterio de inclusion en mensajes

El mensaje solo incluye cuotas **accionables** para el cobrador:

1. **Vencidas** (bloque rojo): cuotas cuya fecha ya paso y no estan pagadas. Siempre se incluyen sin importar hace cuanto vencieron.
2. **Proximas a vencer** (bloque amarillo): cuotas que vencen dentro de los proximos **7 dias**.
3. **Cuotas lejanas** (>7 dias): se **excluyen** del mensaje para no generar ruido.

Si un prestamo no tiene cuotas en ninguna de esas categorias, no aparece en el mensaje.

### Multiples monedas

Si el cobrador tiene prestamos en ARS y USD:
- Los totales se muestran **por separado** — nunca se suman monedas distintas
- Cada linea del mensaje ya incluye el monto formateado con su moneda

### Prestamos sin cuotas

Prestamos zero-rate (sin interes, tipo "te presto y me devolves cuando puedas") no generan schedule de cuotas, asi que:
- No aparecen en el mensaje de cobro
- No aparecen en el detalle de "proximo cobro" de la vista Cobradores
- Si aparecen en el conteo de prestamos y capital total

### Bloques del mensaje

```
Hola [cobrador]! Te paso el detalle:     <- Saludo

🔴 *VENCIDAS:*                            <- Cuotas pasadas, accion urgente
- Juan: cuota 2/6 del 10/04, $100.000

🟡 *PRÓXIMAS (7 días):*                   <- Cuotas que vencen pronto
- Pedro: cuota 3/6 del 15/04, $50.000

*Total: $150.000*                          <- Suma por moneda

Avisame cuando hayas cobrado...            <- CTA para el cobrador
```

---

## 4. Ejemplo real de uso

### Escenario

Sos prestamista. Tenes 3 prestamos gestionados por **Tello**:

| Deudor | Capital | Cuota actual | Vencimiento | Estado |
|---|---|---|---|---|
| Juan Perez | $500.000 | 2/6 — $100.000 | 2 de abril | Vencida (3 dias) |
| Maria Lopez | $300.000 | 4/12 — $35.000 | 8 de abril | Proxima (3 dias) |
| Carlos Ruiz | $200.000 | 1/3 — $80.000 | 20 de abril | Lejana (15 dias) |

Hoy es **5 de abril**.

### Mensaje generado

```
Hola Tello! Te paso el detalle:

🔴 *VENCIDAS:*
- Juan Perez: cuota 2/6 del 2/04, $ 100.000,00

🟡 *PRÓXIMAS (7 días):*
- Maria Lopez: cuota 4/12 del 8/04, $ 35.000,00

*Total: $ 135.000,00*

Avisame cuando hayas cobrado así lo registramos. 🙌
```

**Nota:** Carlos Ruiz no aparece porque su cuota vence en 15 dias (fuera de la ventana de 7).

### Que haces

1. Abris vista Cobradores
2. Ves la tarjeta de Tello: 3 prestamos, $1.000.000 capital, $135.000 proximo cobro
3. Tocas "Mensaje de cobro"
4. Copias y pegas en WhatsApp a Tello
5. Cuando Tello te transfiere, registras los pagos en cada prestamo

---

## 5. Limitaciones actuales

### Lo que NO hace el sistema hoy

| Limitacion | Que implica |
|---|---|
| No trackea si el cobrador cobro | Vos registras el pago cuando te transfieren, no cuando el cobrador cobra al deudor |
| No registra comisiones del cobrador | Si Tello se queda con un %, lo manejas por fuera |
| No tiene estado "cobrado pero no transferido" | No podes distinguir "Tello ya cobro pero no me paso la plata" de "Tello no cobro todavia" |
| No envia mensajes automaticamente | Genera el texto, pero vos lo copias y pegas manualmente |
| Un prestamo solo puede tener 1 cobrador | Si el cobrador cambia, reasignas manualmente |
| No hay historial de cambios de cobrador | Si reasignas un prestamo, no queda registro de quién lo tenia antes |

### Riesgos operativos

- **Olvidarte de registrar el pago:** si Tello te transfiere y no lo cargas, las cuotas siguen apareciendo como vencidas. El proximo mensaje va a incluir cuotas ya cobradas.
- **No asignar cobrador:** si creas prestamos sin cobrador, no aparecen en la vista Cobradores y te los perdes.
- **Cobrador eliminado:** si eliminas un cobrador, sus prestamos quedan "sueltos" sin cobrador. Tenes que reasignarlos manualmente si queres que aparezcan en otro cobrador.

---

## 6. Mejores practicas

### Organizacion de la cobranza

- **Asigna cobrador siempre al crear el prestamo.** Es el momento donde tenes la info fresca. Despues es facil olvidarse.
- **Usa nombres cortos y claros** para cobradores. "Tello" > "Carlos Alberto".
- **Un cobrador = una persona real.** No crees cobradores por zona o tipo — eso complica mas de lo que ayuda.

### Evitar olvidos

- **Revisa la vista Cobradores 1-2 veces por semana.** Ahi ves de un vistazo si hay vencidas acumulandose.
- **Genera y envia mensajes cada lunes** (o el dia que te sirva). La consistencia es clave — el cobrador se acostumbra a recibir el detalle y no tenes que perseguirlo.
- **Registra pagos el mismo dia que te transfieren.** Si lo dejas para despues, se acumula y el proximo mensaje sale mal.

### Priorizar deudas

- El mensaje ya ordena vencidas primero. Si Tello tiene poco tiempo, que se enfoque en las del bloque rojo.
- En la vista Cobradores, los montos de "proximo cobro" te dicen rapidamente quién tiene mas plata pendiente.

### Escalar a mas volumen

- **Mas cobradores = mas delegacion.** Cada cobrador recibe solo lo que le compete.
- **El filtro por cobrador en la tabla** es util para analizar performance: quién tiene mas vencidas, quién cobra mas rapido.
- **Si un cobrador se satura**, reasigna prestamos a otro desde el detalle de cada prestamo.

### Consejos operativos

| Frecuencia | Accion |
|---|---|
| Al crear prestamo | Asignar cobrador |
| Lunes (o dia fijo) | Generar y enviar mensajes a cada cobrador |
| Al recibir transferencia | Registrar pago inmediatamente |
| Fin de mes | Revisar vista Cobradores para detectar morosos |
| Si algo no cierra | Entrar al detalle del prestamo y verificar cuotas |
