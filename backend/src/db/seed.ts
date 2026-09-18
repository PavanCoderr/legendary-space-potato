import { getDb } from '../db';
import { LESSONS } from '../data/lessons';
import { QUIZZES } from '../data/quizzes';
import { CHALLENGES } from '../data/challenges';
import { TOPICS } from '../data/topics';

/**
 * Seed educational content from the existing frontend data modules.
 *
 * This bridges the TypeScript curriculum (src/data/) to the backend database.
 * The backend stores a normalized, simplified view of each lesson so the API
 * can serve content without importing frontend-only types (LucideIcons, etc.).
 */
export async function seedDatabase(): Promise<void> {
  const db = await getDb();
  await db.run('BEGIN');

  // Seed topics as lesson categories
  for (const topic of TOPICS) {
    await db.run(
      `INSERT OR IGNORE INTO lessons (id, title, description, \`order\`, category, duration, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      `topic-${topic.id}`,
      topic.name,
      topic.description,
      0,
      topic.id,
      '',
      'beginner',
    );
  }

  // Map lesson ids to their display order in the curriculum
  const lessonOrder: Record<string, number> = {
    qubits: 0,
    superposition: 1,
    entanglement: 2,
    gates: 3,
    algorithms: 4,
  };

  // Seed lessons + concepts
  for (const lesson of LESSONS) {
    // Serialize the example circuit for storage
    const exampleCircuit = lesson.example?.circuit;
    const circuitJson = exampleCircuit ? JSON.stringify(exampleCircuit) : null;

    await db.run(
      `INSERT OR REPLACE INTO lessons (id, title, description, \`order\`, category, duration, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      lesson.id,
      lesson.title,
      lesson.summary,
      lessonOrder[lesson.id] ?? 99,
      lesson.topic,
      `${lesson.minutes}`,
      lesson.level,
    );

    // Concepts — store the full concept block as JSON content
    await db.run(
      `INSERT OR REPLACE INTO concepts (id, lesson_id, title, content, \`order\`)
       VALUES (?, ?, ?, ?, ?)`,
      `concept-${lesson.id}`,
      lesson.id,
      lesson.concept.heading,
      JSON.stringify({
        heading: lesson.concept.heading,
        paragraphs: lesson.concept.paragraphs,
        keyPoints: lesson.concept.keyPoints,
        math: lesson.concept.math ?? [],
      }),
      0,
    );

    // Interactive lab data
    await db.run(
      `INSERT OR REPLACE INTO lesson_circuits (id, lesson_id, circuit)
       VALUES (?, ?, ?)`,
      `interactive-${lesson.id}`,
      lesson.id,
      JSON.stringify(lesson.interactive.startCircuit),
    );

    // Example circuit
    if (exampleCircuit) {
      await db.run(
        `INSERT OR REPLACE INTO lesson_circuits (id, lesson_id, circuit)
         VALUES (?, ?, ?)`,
        `example-${lesson.id}`,
        lesson.id,
        circuitJson,
      );
    }

    // Store additional lesson metadata as JSON in the lesson description
    await db.run(
      `UPDATE lessons SET description = ? WHERE id = ?`,
      JSON.stringify({
        summary: lesson.summary,
        objectives: lesson.objectives,
        prerequisites: lesson.prerequisites,
        xp: lesson.xp,
        video: lesson.video,
        visualization: lesson.visualization,
        aiPrompts: lesson.aiPrompts,
        interactive: {
          kind: lesson.interactive.kind,
          title: lesson.interactive.title,
          instructions: lesson.interactive.instructions,
          availableGates: lesson.interactive.availableGates,
          successNote: lesson.interactive.successNote,
          completionCheck: lesson.interactive.completionCheck,
        },
        example: lesson.example,
        quizIds: lesson.quizIds,
        challengeId: lesson.challengeId,
        nextLessonId: lesson.nextLessonId,
        icon: typeof lesson.icon === 'object' && lesson.icon ? lesson.icon.displayName ?? lesson.icon.name : lesson.icon ?? null,
      }),
      lesson.id,
    );
  }

  // Seed quizzes + questions
  for (const quiz of QUIZZES) {
    const lesson = LESSONS.find(l => l.id === quiz.lessonId);

    await db.run(
      `INSERT OR REPLACE INTO quizzes (id, lesson_id, title, description, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      quiz.id,
      quiz.lessonId,
      quiz.question,
      quiz.explanation,
      new Date().toISOString(),
    );

    await db.run(
      `INSERT OR REPLACE INTO quiz_questions
       (id, quiz_id, question, options, correct_index, explanation, \`order\`)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      `${quiz.id}-q-main`,
      quiz.id,
      quiz.question,
      JSON.stringify(quiz.options),
      quiz.correctIndex,
      quiz.explanation,
      0,
    );
  }

  // Seed challenges — store as reference data in a dedicated table
  await db.run(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      lesson_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      title TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      xp INTEGER NOT NULL,
      brief TEXT NOT NULL,
      objectives TEXT NOT NULL,
      hints TEXT NOT NULL,
      shots INTEGER NOT NULL,
      starter_circuit TEXT NOT NULL,
      expected_outcome TEXT,
      solution_code TEXT,
      created_at TEXT DEFAULT (datetime('now', 'utc')),
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS challenge_objectives (
      challenge_id TEXT NOT NULL,
      \`index\` INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (challenge_id, \`index\`),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS challenge_hints (
      challenge_id TEXT NOT NULL,
      \`index\` INTEGER NOT NULL,
      text TEXT NOT NULL,
      PRIMARY KEY (challenge_id, \`index\`),
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  for (const challenge of CHALLENGES) {
    await db.run(
      `INSERT OR REPLACE INTO challenges
       (id, lesson_id, topic, title, difficulty, xp, brief, objectives, hints, shots, starter_circuit, expected_outcome, solution_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      challenge.id,
      challenge.lessonId,
      challenge.topic,
      challenge.title,
      challenge.difficulty,
      challenge.xp,
      challenge.brief,
      JSON.stringify(challenge.objectives),
      JSON.stringify(challenge.hints),
      challenge.shots,
      JSON.stringify(challenge.starterCircuit),
      challenge.expectedOutcome,
      challenge.solutionCode,
      new Date().toISOString(),
    );

    // Objectives
    challenge.objectives.forEach((obj: string, i: number) => {
      db.run(
        `INSERT OR REPLACE INTO challenge_objectives (challenge_id, \`index\`, text) VALUES (?, ?, ?)`,
        challenge.id,
        i,
        obj,
      );
    });

    // Hints
    challenge.hints.forEach((hint: string, i: number) => {
      db.run(
        `INSERT OR REPLACE INTO challenge_hints (challenge_id, \`index\`, text) VALUES (?, ?, ?)`,
        challenge.id,
        i,
        hint,
      );
    });
  }

  await db.run('COMMIT');
  console.log(`[seed] Seeded ${LESSONS.length} lessons, ${QUIZZES.length} quizzes, ${CHALLENGES.length} challenges`);
}
