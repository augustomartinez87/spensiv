import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const loans = await prisma.loan.findMany({
    select: {
      id: true,
      borrowerName: true,
      personId: true,
      direction: true,
      status: true,
      person: { select: { name: true, alias: true } },
    },
  })

  const total = loans.length
  const lender = loans.filter((l) => l.direction === 'lender')
  const borrower = loans.filter((l) => l.direction === 'borrower')

  // Focus on lender loans (donde personId tiene sentido)
  const withPerson = lender.filter((l) => l.personId !== null)
  const withoutPerson = lender.filter((l) => l.personId === null)

  // De los que tienen Person: clasificación
  const exactMatch: typeof lender = []
  const conventionMatch: typeof lender = [] // borrowerName empieza con person.name + " - "
  const reverseConvention: typeof lender = [] // borrowerName termina con " - " + person.name
  const stale: typeof lender = [] // borrowerName no contiene person.name en absoluto
  const otherMismatch: typeof lender = []

  for (const l of withPerson) {
    const personName = (l.person?.name ?? '').trim()
    const borrower = l.borrowerName.trim()
    if (!personName) continue
    if (borrower === personName) {
      exactMatch.push(l)
    } else if (borrower.startsWith(personName + ' - ')) {
      conventionMatch.push(l)
    } else if (borrower.endsWith(' - ' + personName)) {
      reverseConvention.push(l)
    } else if (!borrower.toLowerCase().includes(personName.toLowerCase())) {
      stale.push(l)
    } else {
      otherMismatch.push(l)
    }
  }

  // De los que NO tienen Person: ¿usan la convención "X - Y"?
  const noPersonWithDash = withoutPerson.filter((l) => l.borrowerName.includes(' - '))
  const noPersonPlain = withoutPerson.filter((l) => !l.borrowerName.includes(' - '))

  // Imprimir
  console.log('='.repeat(60))
  console.log('ANALISIS DE NOMBRES DE PRESTAMOS')
  console.log('='.repeat(60))
  console.log()
  console.log(`Total prestamos:           ${total}`)
  console.log(`  direction=lender:        ${lender.length}`)
  console.log(`  direction=borrower:      ${borrower.length}`)
  console.log()
  console.log('--- Lender loans (que vinculan personas) ---')
  console.log(`Con Persona vinculada:     ${withPerson.length} (${pct(withPerson.length, lender.length)})`)
  console.log(`Sin Persona:               ${withoutPerson.length} (${pct(withoutPerson.length, lender.length)})`)
  console.log()

  if (withPerson.length > 0) {
    console.log('--- De los que tienen Persona, como esta el borrowerName ---')
    console.log(`Coincide exacto con Person.name:        ${exactMatch.length} (${pct(exactMatch.length, withPerson.length)})`)
    console.log(`Convencion "Persona - concepto":        ${conventionMatch.length} (${pct(conventionMatch.length, withPerson.length)})`)
    console.log(`Convencion inversa "concepto - Persona": ${reverseConvention.length} (${pct(reverseConvention.length, withPerson.length)})`)
    console.log(`No contiene Person.name (DESINCRONIZADO): ${stale.length} (${pct(stale.length, withPerson.length)})`)
    console.log(`Otro mismatch (parcial):                ${otherMismatch.length} (${pct(otherMismatch.length, withPerson.length)})`)
    console.log()

    if (conventionMatch.length > 0) {
      console.log('--- Ejemplos con convencion "Persona - concepto" ---')
      conventionMatch.slice(0, 8).forEach((l) => {
        const concept = l.borrowerName.replace(l.person!.name + ' - ', '')
        console.log(`  Persona="${l.person!.name}" | borrowerName="${l.borrowerName}" | concepto extraido="${concept}"`)
      })
      console.log()
    }

    if (reverseConvention.length > 0) {
      console.log('--- Ejemplos con convencion INVERSA "concepto - Persona" ---')
      reverseConvention.slice(0, 8).forEach((l) => {
        const concept = l.borrowerName.replace(' - ' + l.person!.name, '')
        console.log(`  Persona="${l.person!.name}" | borrowerName="${l.borrowerName}" | concepto extraido="${concept}"`)
      })
      console.log()
    }

    if (stale.length > 0) {
      console.log('--- Ejemplos DESINCRONIZADOS (borrowerName no contiene Person.name) ---')
      stale.slice(0, 8).forEach((l) => {
        console.log(`  Persona="${l.person!.name}" | borrowerName="${l.borrowerName}" | status=${l.status}`)
      })
      console.log()
    }

    if (otherMismatch.length > 0) {
      console.log('--- Ejemplos con mismatch parcial ---')
      otherMismatch.slice(0, 8).forEach((l) => {
        console.log(`  Persona="${l.person!.name}" | borrowerName="${l.borrowerName}"`)
      })
      console.log()
    }
  }

  if (withoutPerson.length > 0) {
    console.log('--- Lender SIN Persona vinculada ---')
    console.log(`Con guion " - " (convencion):  ${noPersonWithDash.length}`)
    console.log(`Sin guion (texto plano):       ${noPersonPlain.length}`)
    console.log()
    console.log('--- Ejemplos SIN Persona ---')
    withoutPerson.slice(0, 8).forEach((l) => {
      console.log(`  borrowerName="${l.borrowerName}" | status=${l.status}`)
    })
  }

  // Detectar Personas con multiples loans
  const byPerson = new Map<string, number>()
  for (const l of withPerson) {
    if (!l.personId) continue
    byPerson.set(l.personId, (byPerson.get(l.personId) ?? 0) + 1)
  }
  const personsWithMultiple = Array.from(byPerson.values()).filter((c) => c > 1).length
  const personsTotal = byPerson.size
  console.log()
  console.log('--- Personas con multiples prestamos ---')
  console.log(`Personas con prestamos:         ${personsTotal}`)
  console.log(`Con mas de 1 prestamo activo:   ${personsWithMultiple} (${pct(personsWithMultiple, personsTotal)})`)
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%'
  return ((n / total) * 100).toFixed(1) + '%'
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
