# Prompt para verificación de cálculos financieros — Spensiv

Necesito que verifiques si los cálculos financieros de mi simulador de créditos son correctos. Te voy a dar las fórmulas que usa mi sistema y quiero que:

1. Valides si cada fórmula es financieramente correcta
2. Me des ejemplos numéricos para comparar contra mi sistema
3. Señales cualquier error conceptual o de implementación

---

## 1. Conversiones de tasas

Mi sistema usa estas conversiones:

- **TNA a tasa mensual:** `mensual = TNA / 12`
- **Tasa mensual a TEA:** `TEA = (1 + mensual)^12 - 1`
- **TNA a tasa diaria (ACT/365):** `diaria = TNA / 365`

**Verificá:**
- Si TNA = 120% (1.20 como decimal), ¿cuánto da la tasa mensual, la TEA, y la tasa diaria?
- ¿Es correcto usar TNA/12 para la tasa mensual en sistema francés, o debería usar otra conversión?

---

## 2. Sistema francés (cuota fija)

Fórmula de cuota:
```
cuota = capital × r × (1+r)^n / ((1+r)^n - 1)
donde r = TNA/12, n = cantidad de meses
```

Tabla de amortización:
```
Para cada período i:
  interés_i = saldo_{i-1} × r
  capital_i = cuota - interés_i
  saldo_i = saldo_{i-1} - capital_i
  
Último período: capital_n = saldo_{n-1} (cierre exacto)
```

**Verificá con este ejemplo:**
- Capital: $1.000.000
- TNA: 120% (r mensual = 0.10)
- Plazo: 12 meses
- ¿Cuánto da la cuota exacta?
- ¿Cuánto es el total pagado?
- ¿Cuánto es el interés total?

---

## 3. Redondeo de cuota hacia arriba

Mi sistema permite redondear la cuota al múltiplo superior (ej: múltiplos de $1.000):
```
cuota_redondeada = ceil(cuota_exacta / múltiplo) × múltiplo
```

Después de redondear, recalcula la TNA efectiva resultante usando IRR (la cuota más alta implica una TNA más alta que la target).

**Verificá:**
- Si la cuota exacta es $146.763, redondeada a $147.000, ¿es correcto que la TNA efectiva suba?
- ¿El enfoque de recalcular la TNA efectiva via IRR es la forma correcta de reflejarlo?

---

## 4. Cálculo de TIR (IRR)

Para préstamos con cuotas mensuales regulares:
```
Flujos: [-capital, cuota_1, cuota_2, ..., cuota_n]
Resolver: NPV(r) = Σ CF_i / (1+r)^i = 0
Método: búsqueda por bisección
Resultado: r = TIR mensual
  → TNA = r × 12
  → TEA = (1+r)^12 - 1
```

**Verificá:**
- Para el ejemplo de arriba ($1.000.000, 12 cuotas, TNA 120%), ¿la TIR mensual debería ser exactamente 10%?
- ¿Es correcto convertir TIR mensual a TNA multiplicando por 12?

---

## 5. Préstamos con fechas irregulares (vencimiento inteligente)

Cuando las cuotas no caen en períodos mensuales exactos (ej: 2do día hábil de cada mes), el interés se calcula por días reales:

```
Para cada período i:
  días_i = días calendario desde fecha anterior hasta fecha_i
  tasa_período_i = (TNA / 365) × días_i
  interés_i = saldo_{i-1} × tasa_período_i
```

La cuota fija se calcula con factores de descuento:
```
FD_0 = 1 / (1 + tasa_período_0)
FD_1 = FD_0 / (1 + tasa_período_1)
...
cuota = capital / Σ FD_i
```

Para la TIR se usa XIRR:
```
NPV(rate) = Σ CF_i / (1 + rate)^(días_i / 365.25) = 0
donde días_i = días calendario desde la fecha de desembolso hasta la fecha_i
Método: Newton-Raphson
Resultado: rate = TEA directa
  → mensual = (1+rate)^(1/12) - 1
  → TNA = mensual × 12
```

**Verificá:**
- ¿Es correcto usar TNA/365 × días para accrual diario (convención ACT/365)?
- ¿La fórmula de factores de descuento acumulados para calcular la cuota fija es correcta?
- ¿Es correcto que XIRR devuelve directamente la TEA?
- Ejemplo: préstamo $1.000.000, TNA 120%, inicio 01/04/2026, primera cuota 06/05/2026 (2do hábil de mayo), ¿cuánto da la cuota si son 12 períodos?

---

## 6. Préstamo bullet (pago único al vencimiento)

```
Valor nominal = capital × (1 + tasa_mensual)^n
Accrual exponencial mes m: valor_m = capital × (1 + tasa_mensual)^m
Flujos TIR: [-capital, 0, 0, ..., 0, valor_nominal]
```

**Verificá:**
- Capital $1.000.000, TNA 120%, 6 meses
- ¿Cuánto da el valor nominal?
- ¿La TIR mensual debería ser exactamente 10%?

---

## 7. Reglas de tasas

El sistema permite configurar:
- **Tipos de deudor** con TNA base (ej: "Conocido" = 110%, "Desconocido" = 130%)
- **Ajustes por duración:**
  - 0-3 meses: +0%
  - 3-6 meses: +5%
  - 6-9 meses: +10%
  - 9-12 meses: +15%
  - 12+ meses: +50%

TNA sugerida = TNA base del tipo + ajuste por duración

**Verificá:**
- ¿Tiene sentido financiero que a mayor plazo, mayor TNA? ¿Es una práctica estándar?
- Si tipo "Conocido" tiene base 110% y el plazo es 9 meses, la TNA sugerida sería 110% + 15% = 125%. ¿Este esquema aditivo es razonable o sería mejor multiplicativo?

---

## 8. Scoring de personas y valor esperado

```
Categorías:
  score ≥ 10: riesgo bajo, prob. default 2%
  7 ≤ score < 10: riesgo medio, prob. default 8%
  4 ≤ score < 7: riesgo alto, prob. default 18%
  score < 4: riesgo crítico, prob. default 40%

Valor esperado = (1 - prob_default) × interés_total - prob_default × capital
```

**Verificá:**
- ¿La fórmula de EV es correcta conceptualmente?
- Ejemplo: capital $1.000.000, interés total $800.000, prob default 8%
  - EV = 0.92 × 800.000 - 0.08 × 1.000.000 = 736.000 - 80.000 = $656.000
  - ¿Es correcto?

---

## Resumen — Lo que necesito que me digas

1. ¿Hay alguna fórmula incorrecta o que use una convención financiera equivocada?
2. ¿Los resultados numéricos de los ejemplos coinciden con lo que calcularías vos?
3. ¿Hay algún caso borde donde mis fórmulas podrían fallar (ej: tasas muy altas, plazos muy cortos)?
4. ¿La conversión TNA ↔ TEA ↔ tasa mensual es consistente en todo el sistema?
5. ¿El uso de ACT/365 para períodos irregulares es la convención correcta para Argentina?
