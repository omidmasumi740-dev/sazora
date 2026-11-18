import { db } from '../db/schema'

/**
 * حذف کامل یک پروژه به‌همراه همهٔ داده‌های وابسته:
 * مالی، مراحل، عکس‌ها، نرخ‌ها، اندازه‌گیری‌ها، کارها، حضور و غیاب،
 * پرداخت‌ها، لاگ‌های روزانه، تراکنش‌های آینه‌ای و جداکردن نیروهای پروژه.
 */
export async function deleteProjectCascade(projectId: number): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.projects,
      db.financeEntries,
      db.stages,
      db.projectPhotos,
      db.rateItems,
      db.measurements,
      db.tasks,
      db.attendances,
      db.payments,
      db.dayLogs,
      db.transactions,
      db.workers,
    ],
    async () => {
      const entries = await db.financeEntries.where('projectId').equals(projectId).toArray()
      const payments = await db.payments.where('projectId').equals(projectId).toArray()
      const tags = [
        ...entries.map((e) => `[projEntry:${e.id}]`),
        ...payments.map((p) => `[pay:${p.id}]`),
      ]
      if (tags.length > 0) {
        const mirrorIds = (await db.transactions.toArray())
          .filter((t) => tags.some((tag) => t.note?.includes(tag)))
          .map((t) => t.id)
          .filter((id): id is number => typeof id === 'number')
        if (mirrorIds.length > 0) await db.transactions.bulkDelete(mirrorIds)
      }

      await db.attendances.where('projectId').equals(projectId).delete()
      await db.payments.where('projectId').equals(projectId).delete()
      await db.dayLogs.filter((d) => d.projectId === projectId).delete()
      await db.financeEntries.where('projectId').equals(projectId).delete()
      await db.stages.where('projectId').equals(projectId).delete()
      await db.projectPhotos.where('projectId').equals(projectId).delete()
      await db.rateItems.where('projectId').equals(projectId).delete()
      await db.measurements.where('projectId').equals(projectId).delete()
      await db.tasks.where('projectId').equals(projectId).delete()
      await db.workers.where('projectId').equals(projectId).modify({ projectId: null })
      await db.projects.delete(projectId)
    },
  )
}
