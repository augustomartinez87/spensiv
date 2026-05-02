/**
 * Migra Loan.borrowerName → Loan.concept para préstamos con Persona vinculada.
 *
 * Política:
 * - Si loan.personId == null → no toca nada (borrowerName sigue siendo la fuente).
 * - Si loan.personId != null:
 *     - Si loan.borrowerName == person.name (trim insensitive) → concept = null
 *     - En cualquier otro caso → concept = loan.borrowerName (VERBATIM, sin parsear)
 *
 * No modifica `borrowerName` (queda como dato legacy).
 *
 * Uso:
 *   npx tsx scripts/migrate-loan-concept.ts --dry   # solo imprime lo que haría
 *   npx tsx scripts/migrate-loan-concept.ts --apply # aplica los cambios
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--apply')

  if (dryRun && !args.includes('--dry')) {
    console.log('Uso: --dry (default) para ver el plan, --apply para ejecutar.')
    console.log()
  }

  const loans = await prisma.loan.findMany({
    select: {
      id: true,
      borrowerName: true,
      concept: true,
      personId: true,
      person: { select: { name: true } },
    },
  })

  const withPerson = loans.filter((l) => l.personId !== null)
  const willSetConcept: typeof loans = []
  const willClearConcept: typeof loans = []
  const noChange: typeof loans = []

  for (const l of withPerson) {
    const personName = (l.person?.name ?? '').trim()
    const borrower = l.borrowerName.trim()
    const sameName = personName.toLowerCase() === borrower.toLowerCase()
    const targetConcept = sameName ? null : l.borrowerName

    if (targetConcept === l.concept) {
      noChange.push(l)
    } else if (targetConcept === null) {
      willClearConcept.push(l)
    } else {
      willSetConcept.push(l)
    }
  }

  console.log('='.repeat(60))
  console.log(`MIGRACION DE CONCEPT (${dryRun ? 'DRY RUN' : 'APLICANDO'})`)
  console.log('='.repeat(60))
  console.log()
  console.log(`Total prestamos con Persona:   ${withPerson.length}`)
  console.log(`  Set concept (verbatim):      ${willSetConcept.length}`)
  console.log(`  Clear concept (=person.name):${willClearConcept.length}`)
  console.log(`  Sin cambio:                  ${noChange.length}`)
  console.log()

  if (willSetConcept.length > 0) {
    console.log('--- Set concept ---')
    willSetConcept.forEach((l) => {
      console.log(`  [${l.id.slice(0, 8)}] Persona="${l.person?.name}" | concept ← "${l.borrowerName}"`)
    })
    console.log()
  }

  if (willClearConcept.length > 0) {
    console.log('--- Clear concept (borrowerName == person.name) ---')
    willClearConcept.forEach((l) => {
      console.log(`  [${l.id.slice(0, 8)}] Persona="${l.person?.name}"`)
    })
    console.log()
  }

  if (dryRun) {
    console.log('Dry run — no se aplicaron cambios. Corré con --apply para ejecutar.')
    return
  }

  let updated = 0
  for (const l of [...willSetConcept, ...willClearConcept]) {
    const personName = (l.person?.name ?? '').trim()
    const sameName = personName.toLowerCase() === l.borrowerName.trim().toLowerCase()
    await prisma.loan.update({
      where: { id: l.id },
      data: { concept: sameName ? null : l.borrowerName },
    })
    updated++
  }

  console.log(`Aplicado: ${updated} prestamos actualizados.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
