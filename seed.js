// seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Crée un utilisateur
  const user = await prisma.user.create({
    data: {
      email: 'testuser@example.com',
      password: 'password123',
      name: 'Test User',
    },
  });
  console.log('User created:', user);

  // Crée un groupe avec l'utilisateur comme propriétaire
  const group = await prisma.group.create({
    data: {
      name: 'Group 1',
      description: 'This is a test group.',
      ownerId: user.id,
    },
  });
  console.log('Group created:', group);

  // Crée une publication pour l'utilisateur
  const post = await prisma.post.create({
    data: {
      title: 'First Post',
      content: 'This is the content of the first post.',
      authorId: user.id,
    },
  });
  console.log('Post created:', post);

  // Crée un signalement pour l'utilisateur
  const report = await prisma.report.create({
    data: {
      title: 'Test Report',
      description: 'This is a test report for a noise complaint.',
      userId: user.id,
    },
  });
  console.log('Report created:', report);

  // Crée un commentaire sur le report
  const comment = await prisma.comment.create({
    data: {
      text: 'This is a comment on the report.',
      reportId: report.id,
      userId: user.id,
    },
  });
  console.log('Comment created:', comment);

  // Crée un like sur le post
  const like = await prisma.like.create({
    data: {
      postId: post.id,
      userId: user.id,
    },
  });
  console.log('Like created:', like);

  // Crée un vote sur le report
  const vote = await prisma.vote.create({
    data: {
      type: 'up',
      reportId: report.id,
      userId: user.id,
    },
  });
  console.log('Vote created:', vote);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
