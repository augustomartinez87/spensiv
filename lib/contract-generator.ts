import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  convertMillimetersToTwip,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
} from 'docx'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { amountToLegalText, numberToWords } from './number-to-words'

// ── Types ──

export interface ContractLoanData {
  borrowerName: string
  personName: string | null
  capital: number
  currency: string
  installmentAmount: number
  termMonths: number | null
  startDate: Date
  monthlyRate: number
  loanType: string
  installments: {
    number: number
    dueDate: Date
    amount: number
    interest: number
    principal: number
    balance: number
  }[]
}

// ── Helpers ──

const FONT = 'Times New Roman'
const SIZE = 24 // half-points (12pt)
const RED = 'FF0000'

function text(content: string, opts?: { bold?: boolean; red?: boolean; italic?: boolean }): TextRun {
  return new TextRun({
    text: content,
    font: FONT,
    size: SIZE,
    bold: opts?.bold,
    italics: opts?.italic,
    color: opts?.red ? RED : undefined,
  })
}

function placeholder(label: string): TextRun {
  return text(`[${label}]`, { bold: true, red: true })
}

function paragraph(runs: TextRun[], opts?: { alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacing?: number }): Paragraph {
  return new Paragraph({
    children: runs,
    alignment: opts?.alignment ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts?.spacing ?? 200 },
  })
}

function clauseTitle(title: string): Paragraph {
  return new Paragraph({
    children: [text(title, { bold: true })],
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 300, after: 100 },
  })
}

function formatDate(date: Date): string {
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es })
}

function formatDateShort(date: Date): string {
  return format(date, 'dd/MM/yyyy')
}

function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1].toUpperCase()
}

function currencySymbol(currency: string): string {
  return currency === 'USD' ? 'USD' : currency === 'EUR' ? 'EUR' : '$'
}

// ── Mutuante (hardcoded) ──

const MUTUANTE = {
  nombre: 'AUGUSTO MARCELO MARTINEZ',
  dni: '43.859.871',
  domicilio: 'Alvarado 2311, Depto. 6, PB, Ciudad Autónoma de Buenos Aires',
}

// ── Contract Generator ──

export function generateContract(loan: ContractLoanData): Document {
  const capital = loan.capital
  const capitalLetras = amountToLegalText(capital, loan.currency)
  const cuotaMonto = loan.installmentAmount
  const cuotaLetras = amountToLegalText(cuotaMonto, loan.currency)
  const cantCuotas = loan.termMonths ?? loan.installments.length
  const primeraCuota = loan.installments[0]?.dueDate ?? loan.startDate
  const ultimaCuota = loan.installments[loan.installments.length - 1]?.dueDate ?? loan.startDate
  const diaVto = primeraCuota.getDate()
  const cur = currencySymbol(loan.currency)
  const personDisplayName = loan.personName ?? loan.borrowerName

  const headerMonth = format(loan.startDate, "MMMM yyyy", { locale: es }).toUpperCase()

  const sections = [{
    properties: {
      page: {
        margin: {
          top: convertMillimetersToTwip(30),
          bottom: convertMillimetersToTwip(25),
          left: convertMillimetersToTwip(30),
          right: convertMillimetersToTwip(25),
        },
        pageNumbers: { start: 1 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              text(`CONTRATO DE MUTUO – ${lastName(MUTUANTE.nombre)} / ${lastName(personDisplayName)} – ${headerMonth}`, { bold: true }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              text('Página '),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE }),
              text(' de '),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: SIZE }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
    },
    children: [
      // ── Title ──
      new Paragraph({
        children: [text('CONTRATO DE MUTUO', { bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      // ── Parties ──
      paragraph([
        text('Entre el Sr. '),
        text(MUTUANTE.nombre, { bold: true }),
        text(', DNI N° '),
        text(MUTUANTE.dni, { bold: true }),
        text(', con domicilio en '),
        text(MUTUANTE.domicilio),
        text(', en adelante "'),
        text('el Mutuante', { bold: true }),
        text('", por una parte; y '),
        placeholder('NOMBRE COMPLETO MUTUARIA/O'),
        text(', DNI N° '),
        placeholder('DNI MUTUARIA/O'),
        text(', con domicilio en '),
        placeholder('DOMICILIO COMPLETO MUTUARIA/O'),
        text(', en adelante "'),
        text('la Mutuaria', { bold: true }),
        text('", por la otra; convienen en celebrar el presente contrato de mutuo dinerario, sujeto a las siguientes cláusulas:'),
      ]),

      // ── PRIMERA ──
      clauseTitle('PRIMERA – OBJETO Y ENTREGA DEL CAPITAL:'),
      paragraph([
        text('El Mutuante ha entregado a la Mutuaria en carácter de préstamo la suma de '),
        text(capitalLetras, { bold: true }),
        text(` (${cur}${capital.toLocaleString('es-AR')})`),
        text(' mediante '),
        placeholder('MEDIO DE ENTREGA'),
        text(' el día '),
        placeholder('FECHA DE ENTREGA DEL DINERO'),
        text(', sirviendo el correspondiente comprobante de transferencia como recibo suficiente de la entrega.'),
      ]),

      // ── SEGUNDA ──
      clauseTitle('SEGUNDA – PLAN DE CUOTAS E INTERÉS COMPENSATORIO:'),
      paragraph([
        text('La Mutuaria se obliga a restituir el capital más un interés compensatorio pactado de común acuerdo, mediante el pago de '),
        text(`${cantCuotas} (${numberToWords(cantCuotas)})`, { bold: true }),
        text(' cuotas mensuales, iguales y consecutivas de '),
        text(cuotaLetras, { bold: true }),
        text(` (${cur}${cuotaMonto.toLocaleString('es-AR')})`),
        text(' cada una. La primera cuota vencerá el día '),
        text(formatDate(primeraCuota), { bold: true }),
        text(` y las restantes el día ${diaVto} de cada mes subsiguiente, hasta la cuota N° ${cantCuotas} con vencimiento el `),
        text(formatDate(ultimaCuota), { bold: true }),
        text('. Cada cuota incluye proporcionalmente capital e interés compensatorio, conformando un costo financiero total conocido y aceptado por ambas partes.'),
      ]),

      // ── TERCERA ──
      clauseTitle('TERCERA – INTERESES PUNITORIOS:'),
      paragraph([
        text('Sobre los saldos en mora se aplicará un interés punitorio del '),
        placeholder('X%'),
        text(' ('),
        placeholder('X EN LETRAS'),
        text(' por ciento) mensual, proporcional al tiempo efectivo de mora, calculado sobre el monto de la cuota o cuotas impagas.'),
      ]),

      // ── CUARTA ──
      clauseTitle('CUARTA – MORA AUTOMÁTICA:'),
      paragraph([
        text('La mora se producirá de pleno derecho por el solo vencimiento de cada cuota, sin necesidad de interpelación judicial ni extrajudicial previa, de conformidad con lo dispuesto en el artículo 886 del Código Civil y Comercial de la Nación.'),
      ]),

      // ── QUINTA ──
      clauseTitle('QUINTA – IMPUTACIÓN DE PAGOS:'),
      paragraph([
        text('El Mutuante imputará los pagos de la Mutuaria en el siguiente orden: primero a cancelar gastos, luego intereses punitorios, luego intereses compensatorios y por último al capital adeudado.'),
      ]),

      // ── SEXTA ──
      clauseTitle('SEXTA – CADUCIDAD DE PLAZOS:'),
      paragraph([
        text('El incumplimiento de cualquier cuota en tiempo y forma facultará al Mutuante a dar por vencidos todos los plazos pendientes y exigir el pago total e inmediato de la suma adeudada, incluyendo capital, intereses compensatorios y punitorios devengados.'),
      ]),

      // ── SÉPTIMA ──
      clauseTitle('SÉPTIMA – GARANTÍA MEDIANTE PAGARÉ:'),
      paragraph([
        text('En garantía de la restitución íntegra del préstamo, la Mutuaria librará a favor del Mutuante un pagaré por la suma de '),
        text(capitalLetras, { bold: true }),
        text(` (${cur}${capital.toLocaleString('es-AR')})`),
        text(', el cual será devuelto a la Mutuaria una vez cancelada la totalidad de las cuotas. En caso de accionarse judicialmente, el Mutuante podrá hacerlo por el pagaré o por este contrato, pero nunca por ambos instrumentos simultáneamente, a fin de evitar la doble persecución del mismo crédito.'),
      ]),

      // ── OCTAVA ──
      clauseTitle('OCTAVA – PAGO ANTICIPADO:'),
      paragraph([
        text('La Mutuaria podrá cancelar anticipadamente el saldo adeudado en cualquier momento, debiendo abonar el capital pendiente más los intereses compensatorios devengados hasta la fecha de cancelación efectiva, sin penalidad alguna por pago anticipado.'),
      ]),

      // ── NOVENA ──
      clauseTitle('NOVENA – GASTOS Y COSTAS:'),
      paragraph([
        text('Todos los gastos judiciales, extrajudiciales, honorarios profesionales y costas que se deriven del cobro de las sumas adeudadas en virtud del presente contrato serán a exclusivo cargo de la Mutuaria.'),
      ]),

      // ── DÉCIMA ──
      clauseTitle('DÉCIMA – JURISDICCIÓN Y DOMICILIOS:'),
      paragraph([
        text('A todos los efectos legales derivados de este contrato, las partes se someten a la jurisdicción de los Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires, constituyendo domicilios especiales en los indicados precedentemente, donde serán válidas todas las notificaciones judiciales y extrajudiciales.'),
      ]),

      // ── Closing ──
      new Paragraph({
        children: [],
        spacing: { after: 300 },
      }),
      paragraph([
        text('Se firman dos (2) ejemplares de un mismo tenor y a un solo efecto en la Ciudad Autónoma de Buenos Aires, a los '),
        placeholder('COMPLETAR FECHA DE FIRMA'),
        text('.-'),
      ]),

      // ── Signature block ──
      new Paragraph({ children: [], spacing: { after: 800 } }),

      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorders(),
                children: [
                  new Paragraph({ children: [text('_________________________')], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [text('Firma del Mutuante', { bold: true })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [text(MUTUANTE.nombre)], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [text(`DNI ${MUTUANTE.dni}`)], alignment: AlignmentType.CENTER }),
                ],
                verticalAlign: VerticalAlign.BOTTOM,
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                borders: noBorders(),
                children: [
                  new Paragraph({ children: [text('_________________________')], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [text('Firma de la Mutuaria', { bold: true })], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [placeholder('NOMBRE MUTUARIA/O')], alignment: AlignmentType.CENTER }),
                  new Paragraph({ children: [placeholder('DNI MUTUARIA/O')], alignment: AlignmentType.CENTER }),
                ],
                verticalAlign: VerticalAlign.BOTTOM,
              }),
            ],
          }),
        ],
      }),
    ],
  }]

  return new Document({ sections })
}

// ── Pagaré Guide Generator ──

export function generatePagareGuide(loan: ContractLoanData): Document {
  const capital = loan.capital
  const capitalLetras = numberToWords(capital)
  const ultimaCuota = loan.installments[loan.installments.length - 1]?.dueDate ?? loan.startDate
  const cur = currencySymbol(loan.currency)
  const personDisplayName = loan.personName ?? loan.borrowerName

  const totalCuotas = loan.installments.reduce((sum, i) => sum + i.amount, 0)
  const totalIntereses = totalCuotas - capital

  const sections = [{
    properties: {
      page: {
        margin: {
          top: convertMillimetersToTwip(30),
          bottom: convertMillimetersToTwip(25),
          left: convertMillimetersToTwip(30),
          right: convertMillimetersToTwip(25),
        },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [text('GUÍA PERSONAL – NO FORMA PARTE DEL CONTRATO', { bold: true })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
    },
    children: [
      new Paragraph({
        children: [text('GUÍA PARA COMPLETAR EL PAGARÉ', { bold: true })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      paragraph([
        text(`Préstamo a: ${personDisplayName} — Capital: ${cur}${capital.toLocaleString('es-AR')}`, { bold: true }),
      ]),

      // ── Talón superior ──
      clauseTitle('TALÓN SUPERIOR (registro personal):'),
      paragraph([text('• N°: '), text('1', { bold: true })]),
      paragraph([text(`• $: `), text(`${capital.toLocaleString('es-AR')}`, { bold: true })]),
      paragraph([text('• Cantidad: '), text(capitalLetras, { bold: true })]),
      paragraph([text('• Vencimiento: '), text(formatDateShort(ultimaCuota), { bold: true })]),
      paragraph([text('• Fecha: '), placeholder('MISMA FECHA QUE EL CONTRATO')]),

      // ── Cuerpo principal ──
      clauseTitle('CUERPO PRINCIPAL DEL PAGARÉ:'),
      paragraph([text('• SELLADO $: '), text('vacío', { italic: true })]),
      paragraph([text('• N°: '), text('1', { bold: true })]),
      paragraph([text('• VENCE EL: '), text(formatDateShort(ultimaCuota), { bold: true })]),
      paragraph([text(`• Por $: `), text(`${capital.toLocaleString('es-AR')}`, { bold: true })]),
      paragraph([text('• DE (lugar y fecha): '), text('Buenos Aires, '), placeholder('FECHA DE FIRMA')]),
      paragraph([text('• Antes de "pagaré" escribir: '), text('"Debo y"', { bold: true })]),
      paragraph([text('• a ___ y a su orden: '), text(MUTUANTE.nombre, { bold: true })]),
      paragraph([text('• la cantidad de pesos: '), text(capitalLetras, { bold: true })]),
      paragraph([text('• por igual valor recibido en: '), text('efectivo', { bold: true })]),
      paragraph([text('• pagadero en: '), text('Ciudad Autónoma de Buenos Aires', { bold: true })]),
      paragraph([text('• Firmante: '), text(personDisplayName, { bold: true })]),
      paragraph([text('• Calle: '), placeholder('CALLE DE DOMICILIO MUTUARIA/O')]),
      paragraph([text('• Localidad: '), placeholder('LOCALIDAD')]),
      paragraph([text('• Teléfono: '), placeholder('TELÉFONO')]),
      paragraph([text('• FIRMA: la Mutuaria firma al pie')]),

      // ── Advertencias ──
      clauseTitle('ADVERTENCIAS CRÍTICAS:'),
      paragraph([text('⚠ NO escribir ninguna referencia al contrato de mutuo en el pagaré.', { bold: true, red: true })]),
      paragraph([text('⚠ NO dejar espacios en blanco sin completar. Trazar líneas en campos vacíos.', { bold: true, red: true })]),
      paragraph([text('⚠ La firma debe coincidir con la que figura en el DNI.', { bold: true, red: true })]),
      paragraph([text('⚠ Guardar el pagaré original en lugar seguro.', { bold: true, red: true })]),
      paragraph([text('⚠ Al cancelarse la deuda, devolver el pagaré a la Mutuaria.', { bold: true, red: true })]),

      // ── Cronograma ──
      clauseTitle('CRONOGRAMA DE CUOTAS:'),
      ...loan.installments.map((inst) =>
        paragraph([
          text(`Cuota ${inst.number}: `),
          text(formatDateShort(inst.dueDate), { bold: true }),
          text(` — ${cur}${inst.amount.toLocaleString('es-AR')}`),
        ], { spacing: 80 })
      ),
      new Paragraph({ children: [], spacing: { after: 100 } }),
      paragraph([
        text(`Total a restituir: ${cur}${totalCuotas.toLocaleString('es-AR')}`, { bold: true }),
      ]),
      paragraph([
        text(`Capital: ${cur}${capital.toLocaleString('es-AR')} + Intereses compensatorios: ${cur}${Math.round(totalIntereses).toLocaleString('es-AR')}`),
      ]),
    ],
  }]

  return new Document({ sections })
}

// ── Download helpers ──

export async function downloadContract(loan: ContractLoanData): Promise<void> {
  const doc = generateContract(loan)
  const blob = await Packer.toBlob(doc)
  const personName = (loan.personName ?? loan.borrowerName).replace(/\s+/g, '_')
  const month = format(loan.startDate, 'yyyy-MM')
  saveAs(blob, `Contrato_Mutuo_${personName}_${month}.docx`)
}

export async function downloadPagareGuide(loan: ContractLoanData): Promise<void> {
  const doc = generatePagareGuide(loan)
  const blob = await Packer.toBlob(doc)
  const personName = (loan.personName ?? loan.borrowerName).replace(/\s+/g, '_')
  const month = format(loan.startDate, 'yyyy-MM')
  saveAs(blob, `Guia_Pagare_${personName}_${month}.docx`)
}

export async function downloadBothDocuments(loan: ContractLoanData): Promise<void> {
  await downloadContract(loan)
  // Small delay so browser doesn't block second download
  await new Promise((r) => setTimeout(r, 500))
  await downloadPagareGuide(loan)
}

// ── Helper: no borders for signature table ──

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: none, bottom: none, left: none, right: none }
}
