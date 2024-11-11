const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const user1 = await prisma.user.create({
        data: {
          email: 'user1@example.com',
          password: 'password123',  // Remplacez par un mot de passe hashé si nécessaire
          name: 'User One',
        },
      });
    
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@example.com',
          password: 'password123',  // Remplacez par un mot de passe hashé si nécessaire
          name: 'User Two',
        },
      });
    
      // Ajouter des signalements
      const report1 = await prisma.report.create({
        data: {
          title: 'Pollution de l\'air',
          description: 'Signalement concernant la qualité de l\'air dans la zone X.',
          userId: user1.id,  // Associez le signalement à l'utilisateur
          latitude: 48.8566,
          longitude: 2.3522,
          type: 'Pollution',
        },
      });
  console.log('Seeding...');
  await prisma.report.create({
    data: {
      title: 'Pollution de l\'air',
      description: 'Un signalement concernant la pollution de l\'air',
      userId: 1,
      latitude: 48.8566,
      longitude: 2.3522,
      type: 'pollution',
    },
  });
  console.log('Seed finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
