const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeAdmin() {
  const users = await prisma.user.findMany();
  if (users.length > 0) {
    const user = await prisma.user.update({
      where: { id: users[0].id },
      data: { role: 'admin' }
    });
    console.log(`L'utilisateur ${user.email} est maintenant admin.`);
  } else {
    console.log("Aucun utilisateur trouvé.");
  }
}
makeAdmin().finally(() => prisma.$disconnect());
