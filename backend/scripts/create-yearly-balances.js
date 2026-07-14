// backend/scripts/create-yearly-balances.js
// AUTOMATIC: Create next year's LeaveBalance for all users
// Run on January 1st every year via cron or Railway scheduled job

import { PrismaClient } from '@prisma/client';
import { calculateAnnualLeaveQuota } from '../src/services/leave.service.js';

const prisma = new PrismaClient();

async function createYearlyBalances(targetYear = null) {
  const year = targetYear || new Date().getFullYear();
  
  console.log(`🚀 Creating ${year} Leave Balances...`);
  console.log(`📅 ${new Date().toISOString()}\n`);

  try {
    // Get all active users without balance for target year
    const users = await prisma.user.findMany({
      where: {
        employeeStatus: { not: 'Inactive' },
        leaveBalances: {
          none: { year: year }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeStatus: true,
        joinDate: true,
        createdAt: true
      }
    });

    console.log(`📊 Found ${users.length} users\n`);

    if (users.length === 0) {
      console.log(`✅ All users have ${year} balances`);
      return { year, created: 0, errors: 0, total: 0 };
    }

    let created = 0, errors = 0;

    for (const user of users) {
      try {
        // Same formula the live app uses (leave.service.js) — tenure-based
        // for PKWT/PKWTT, 0 for everyone else. No PKWTT flat-quota special
        // case; getOrCreateLeaveBalance will keep this in sync as tenure
        // progresses through the year.
        const joinDate = user.joinDate || user.createdAt;
        const annualQuota = calculateAnnualLeaveQuota(joinDate, user.employeeStatus);

        await prisma.leaveBalance.create({
          data: {
            employeeId: user.id,
            year,
            annualQuota,
            annualUsed: 0,
            annualRemaining: annualQuota,
            sickLeaveUsed: 0,
            menstrualLeaveUsed: 0,
            unpaidLeaveUsed: 0,
            toilBalance: 0,
            toilUsed: 0,
            toilExpired: 0
          }
        });

        created++;
        console.log(`✅ ${user.name} → ${annualQuota} days`);

      } catch (error) {
        errors++;
        console.error(`❌ ${user.name}: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(40));
    console.log(`Year: ${year}`);
    console.log(`✅ Created: ${created}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(40) + '\n');

    return { year, created, errors, total: users.length };

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const year = process.argv[2] ? parseInt(process.argv[2]) : new Date().getFullYear();
  
  createYearlyBalances(year)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default createYearlyBalances;