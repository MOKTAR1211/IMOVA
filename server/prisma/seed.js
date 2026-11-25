const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Immo229 demo accounts...');

  // Mot de passe sécurisé haché pour les démos : 'pass123'
  const hashedPassword = await bcrypt.hash('pass123', 10);

  // 1. Utilisateur Propriétaire
  await prisma.user.upsert({
    where: { email: 'koffi@immo229.bj' },
    update: { motDePasse: hashedPassword },
    create: {
      nom: 'Koffi Mensah',
      email: 'koffi@immo229.bj',
      motDePasse: hashedPassword,
      telephone: '+229 01 99 88 77',
      role: 'proprietaire',
    },
  });

  // 2. Utilisateur Visiteur / Acheteur
  await prisma.user.upsert({
    where: { email: 'amina@immo229.bj' },
    update: { motDePasse: hashedPassword },
    create: {
      nom: 'Amina Dossou',
      email: 'amina@immo229.bj',
      motDePasse: hashedPassword,
      telephone: '+229 01 55 44 33',
      role: 'particulier',
    },
  });

  // 3. Utilisateur Admin
  await prisma.user.upsert({
    where: { email: 'admin@immo229.bj' },
    update: { motDePasse: hashedPassword },
    create: {
      nom: 'Admin Immo229',
      email: 'admin@immo229.bj',
      motDePasse: hashedPassword,
      telephone: '+229 01 00 00 00',
      role: 'admin',
    },
  });

  console.log('Seed terminé avec succès !');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
