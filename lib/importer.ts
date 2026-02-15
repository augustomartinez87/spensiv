/**
 * Parser para el formato de Excel de Augusto
 * Formato esperado (pestaña Movimientos):
 * Fecha	Descripción	Categoría	Subcategoría	Tipo de Gasto	Medio de Pago	Banco	Tarjeta	Monto	Cuotas
 */

export function parseExcelPaste(text: string) {
    const lines = text.trim().split('\n')
    const results = []

    for (const line of lines) {
        // Intentar separar por Tab (Excel) o por múltiples espacios
        let cols = line.split('\t')
        if (cols.length < 5) {
            cols = line.split(/\s{2,}/) // Split by 2 or more spaces
        }

        if (cols.length < 9) continue // Ignorar lineas incompletas

        const dateStr = cols[0].trim()
        const description = cols[1].trim()
        const category = cols[2].trim()
        const subcategory = cols[3].trim()
        const expenseTypeStr = cols[4].trim()
        const paymentMethodStr = cols[5].trim()
        const bank = cols[6].trim()
        const cardName = cols[7].trim()
        const amountStr = cols[8].trim()
        const installmentsStr = cols[9]?.trim() || '1'

        // 1. Limpiar monto: "$ 609.000,00" -> 609000
        const amount = parseFloat(
            amountStr
                .replace('$', '')
                .replace(/\./g, '')
                .replace(',', '.')
                .trim()
        )

        // 2. Mapear Fecha: "06/06/2025" -> Date
        const [day, month, year] = dateStr.split('/').map(Number)
        const date = new Date(year, month - 1, day).toISOString()

        // 3. Mapear Tipo de Gasto
        let expenseType: 'structural' | 'emotional_recurrent' | 'emotional_impulsive' = 'structural'
        if (expenseTypeStr.toLowerCase().includes('impulsivo')) expenseType = 'emotional_impulsive'
        if (expenseTypeStr.toLowerCase().includes('recurrente')) expenseType = 'emotional_recurrent'

        // 4. Mapear Medio de Pago
        let paymentMethod: 'credit_card' | 'cash' | 'transfer' | 'debit_card' = 'cash'
        if (paymentMethodStr.toLowerCase().includes('crédito')) paymentMethod = 'credit_card'
        if (paymentMethodStr.toLowerCase().includes('transferencia')) paymentMethod = 'transfer'
        if (paymentMethodStr.toLowerCase().includes('débito')) paymentMethod = 'debit_card'
        if (paymentMethodStr.toLowerCase().includes('efectivo')) paymentMethod = 'cash'

        results.push({
            date,
            description,
            category,
            subcategory,
            expenseType,
            paymentMethod,
            bank,
            cardName,
            amount,
            installments: parseInt(installmentsStr) || 1,
        })
    }

    return results
}

/**
 * Parser para ingresos desde Excel
 * Formato esperado:
 * Fecha | Descripción | Categoría | Subcategoría | Monto | Mes_Impacto
 */
export function parseIncomesPaste(text: string) {
    const lines = text.trim().split('\n')
    const results = []

    for (const line of lines) {
        let cols = line.split('\t')
        if (cols.length < 5) {
            cols = line.split(/\s{2,}/)
        }

        if (cols.length < 5) continue

        const dateStr = cols[0].trim()
        const description = cols[1].trim()
        const category = cols[2].trim()
        const subcategory = cols[3].trim() || undefined
        const amountStr = cols[4].trim()
        const impactMonth = cols[5]?.trim() || undefined // "2026-02" format optional

        // Limpiar monto: "$ 609.000,00" -> 609000
        const amount = parseFloat(
            amountStr
                .replace('$', '')
                .replace(/\./g, '')
                .replace(',', '.')
                .trim()
        )

        // Mapear Fecha: "06/06/2025" -> Date
        const [day, month, year] = dateStr.split('/').map(Number)
        const date = new Date(year, month - 1, day).toISOString()

        // Mapear categoría a valores del schema
        let incomeCategory = 'other_income'
        const catLower = category.toLowerCase()
        if (catLower.includes('sueldo') || catLower.includes('salario') || catLower.includes('activo')) {
            incomeCategory = 'active_income'
        }

        results.push({
            date,
            description,
            category: incomeCategory,
            subcategory,
            amount,
            impactMonth,
        })
    }

    return results
}

/**
 * Generar CSV de ejemplo para el usuario
 */
export function generateTemplateCSV() {
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Subcategoría', 'Tipo de Gasto', 'Medio de Pago', 'Banco', 'Tarjeta', 'Monto', 'Cuotas']
    const example = ['01/01/2026', 'Compra Ejemplo', 'Lujos', 'Salidas', 'Emocional - Recurrente', 'Crédito', 'BBVA', 'Visa Signature', '10000', '3']

    return [headers.join('\t'), example.join('\t')].join('\n')
}
