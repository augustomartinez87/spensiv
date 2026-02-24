import { PrismaClient } from '@prisma/client'
import { LoanAccountingService } from '../server/services/loan-accounting.service'

const prisma = new PrismaClient()

async function ensureLegacyCashflowsForPayment(args: {
  loanId: string
  paymentId: string
  paymentDate: Date
  direction: string
  interest: number
  principal: number
}) {
  const sign = args.direction === 'lender' ? 1 : -1

  if (args.interest > 0) {
    const exists = await prisma.loanRealCashflow.findFirst({
      where: { paymentId: args.paymentId, component: 'interest_current' },
      select: { id: true },
    })

    if (!exists) {
      await prisma.loanRealCashflow.create({
        data: {
          loanId: args.loanId,
          paymentId: args.paymentId,
          flowDate: args.paymentDate,
          amountSigned: Number((args.interest * sign).toFixed(2)),
          component: 'interest_current',
        },
      })
    }
  }

  if (args.principal > 0) {
    const exists = await prisma.loanRealCashflow.findFirst({
      where: { paymentId: args.paymentId, component: 'principal' },
      select: { id: true },
    })

    if (!exists) {
      await prisma.loanRealCashflow.create({
        data: {
          loanId: args.loanId,
          paymentId: args.paymentId,
          flowDate: args.paymentDate,
          amountSigned: Number((args.principal * sign).toFixed(2)),
          component: 'principal',
        },
      })
    }
  }
}

async function run() {
  const service = new LoanAccountingService(prisma)

  const loans = await prisma.loan.findMany({
    include: {
      loanInstallments: {
        orderBy: { number: 'asc' },
      },
    },
  })

  for (const loan of loans) {
    await service.ensureInitialDisbursementCashflow(loan.id)

    for (const installment of loan.loanInstallments) {
      if (!installment.isPaid) continue

      const externalRef = `legacy_installment_${installment.id}`
      let payment = await prisma.loanPayment.findFirst({
        where: {
          loanId: loan.id,
          externalRef,
        },
      })

      if (!payment) {
        payment = await prisma.loanPayment.create({
          data: {
            loanId: loan.id,
            paymentDate: installment.dueDate,
            amount: installment.amount,
            currency: loan.currency,
            note: 'Backfill legacy installment payment',
            externalRef,
          },
        })
      }

      await ensureLegacyCashflowsForPayment({
        loanId: loan.id,
        paymentId: payment.id,
        paymentDate: payment.paymentDate,
        direction: loan.direction,
        interest: Number(installment.interest),
        principal: Number(installment.principal),
      })
    }

    await service.rebuildMonthlyAccruals(loan.id, new Date())
    await service.recalculateIrrCache(loan.id)
  }
}

run()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
