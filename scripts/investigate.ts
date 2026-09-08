import { analyze } from "../lib/analytics/investigator";
import { renderCliReport } from "../lib/analytics/render";
import { prisma } from "../lib/db";

async function main() {
  const arg = process.argv[2];
  const endDate = arg
    ? new Date(arg)
    : new Date("2026-09-07T00:00:00.000Z");

  const report = await analyze(prisma, endDate);

  renderCliReport(report);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });