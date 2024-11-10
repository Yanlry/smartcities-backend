// Exemple de script pour mettre à jour l'abonnement
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateSubscription() {
  await prisma.user.update({
    where: { id: 2 }, // ID de l'utilisateur
    data: { isSubscribed: true }, // Définit isSubscribed sur true
  });
  console.log("L'utilisateur est maintenant abonné");
}

updateSubscription().finally(() => prisma.$disconnect());
