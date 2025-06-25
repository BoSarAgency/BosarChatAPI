import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminEmail = 'admin@bosar.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: 'Admin User',
        role: UserRole.admin,
      },
    });

    console.log('✅ Admin user created:', admin.email);
  } else {
    console.log('ℹ️ Admin user already exists:', existingAdmin.email);
  }

  // Create sample agent user
  const agentEmail = 'agent@bosar.com';
  const existingAgent = await prisma.user.findUnique({
    where: { email: agentEmail },
  });

  if (!existingAgent) {
    const hashedPassword = await bcrypt.hash('agent123', 10);

    const agent = await prisma.user.create({
      data: {
        email: agentEmail,
        password: hashedPassword,
        name: 'Agent User',
        role: UserRole.agent,
      },
    });

    console.log('✅ Agent user created:', agent.email);
  } else {
    console.log('ℹ️ Agent user already exists:', existingAgent.email);
  }

  // Create default bot settings
  const existingBotSettings = await prisma.botSettings.findFirst();

  if (!existingBotSettings) {
    const botSettings = await prisma.botSettings.create({
      data: {
        model: 'gpt-4',
        temperature: 0.7,
        systemInstructions:
          'You are a helpful customer service assistant. Be polite, professional, and helpful. If you cannot answer a question, suggest that the customer speak with a human agent.',
        tools: [
          {
            type: 'function',
            name: 'search_knowledge_base',
            description: 'Search the knowledge base for relevant information',
          },
          {
            type: 'function',
            name: 'escalate_to_human',
            description: 'Escalate the conversation to a human agent',
          },
        ],
      },
    });

    console.log('✅ Default bot settings created:', botSettings.id);

    // Create sample FAQ entries
    const faqEntries = [
      {
        question: 'What are your business hours?',
        answer: 'Our business hours are Monday to Friday, 9 AM to 5 PM EST.',
      },
      {
        question: 'How can I contact support?',
        answer:
          'You can contact support through this chat, email us at support@bosar.com, or call us at 1-800-BoSar-HELP.',
      },
      {
        question: 'What is your refund policy?',
        answer:
          'We offer a 30-day money-back guarantee on all purchases. Please contact support to initiate a refund.',
      },
    ];

    for (const faq of faqEntries) {
      await prisma.fAQ.create({
        data: {
          ...faq,
          botSettingsId: botSettings.id,
        },
      });
    }

    console.log('✅ Sample FAQ entries created');
  } else {
    console.log('ℹ️ Bot settings already exist');
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
