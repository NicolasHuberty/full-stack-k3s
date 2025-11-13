import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding agents...');

  // Create Lawyer Agent with Emate logic
  const lawyerAgent = await prisma.agent.upsert({
    where: { id: 'lawyer-agent-1' },
    update: {},
    create: {
      id: 'lawyer-agent-1',
      name: 'Lawyer Agent',
      description: 'Professional legal assistant with advanced document analysis capabilities. Supports translator mode for multilingual documents and smart mode for complex legal queries.',
      icon: 'Scale',
      status: 'PUBLISHED',
      systemPrompt: `Vous êtes un assistant juridique qui répondez en Français avec un formatage markdown propre.

RÈGLES DE FORMATAGE STRICTES:
- Utilisez **gras** pour les termes importants
- Utilisez des listes à puces (- ou *) pour énumérer les éléments
- Utilisez la numérotation (1., 2., 3.) pour les étapes ou points ordonnés
- N'utilisez JAMAIS de blocs de code (\`\`\`)
- Formatez le texte directement en markdown sans l'encapsuler dans des blocs de code
- Pour chaque information, mentionnez explicitement le titre du document source

Répondez à la question en vous basant uniquement sur les documents fournis.`,
      temperature: 0.0,
      model: 'gpt-4o-mini',
      isPublic: true,
      featured: true,
      graphConfig: {
        type: 'emate_rag',
        embeddingModel: 'text-embedding-3-large',
        classicalRetrievalLimit: 10,
        reflexionRetrievalLimit: 5,
        reflexionRetrievalLimitDutch: 3,
        scoreThreshold: 5,
        maxDocs: 15,
        timeout: 240,
      },
    },
  });

  console.log('Created Lawyer Agent:', lawyerAgent.id);

  // Create actions for Lawyer Agent
  await prisma.agentAction.upsert({
    where: {
      agentId_name: {
        agentId: lawyerAgent.id,
        name: 'translator_mode',
      },
    },
    update: {},
    create: {
      agentId: lawyerAgent.id,
      name: 'translator_mode',
      label: 'Translator Mode',
      icon: 'Languages',
      type: 'TOGGLE',
      defaultValue: 'false',
      order: 1,
    },
  });

  await prisma.agentAction.upsert({
    where: {
      agentId_name: {
        agentId: lawyerAgent.id,
        name: 'smart_mode',
      },
    },
    update: {},
    create: {
      agentId: lawyerAgent.id,
      name: 'smart_mode',
      label: 'Smart Mode',
      icon: 'Brain',
      type: 'TOGGLE',
      defaultValue: 'false',
      order: 2,
    },
  });

  console.log('Created Lawyer Agent actions');

  console.log('Agent seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding agents:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
