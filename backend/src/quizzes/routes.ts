import { Router, type Request, type Response } from 'express';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getUser } from '../middleware/auth';
import { awardXp } from '../rewards';
import { QUIZZES } from '../data/quizzes';

export interface Quiz {
  id: string;
  lesson_id: string | null;
  title: string;
  description: string | null;
  questions: QuizQuestion[];
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  order: number;
}

/**
 * Register quiz-related routes.
 *
 * Routes:
 * - GET /quiz/:id — fetch a quiz with questions
 * - POST /quiz/:id/attempt — submit a quiz answer (backend-native format: question_index, selected_index)
 * - POST /quiz/submit — submit a quiz answer (frontend format: QuizAttempt with quizId, lessonId, selectedIndex, correct)
 * - GET /quiz/:id/result — get user's quiz result
*/
export function registerQuizRoutes(): Router {
  const router = Router();

  // Get a quiz by ID (lesson-specific or general)
  router.get('/:id', async (req: Request, res: Response) => {
    const user = getUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;
    const db = await getDb();

    const quiz = await db.get<Quiz & { questions?: QuizQuestion[] }>(
      'SELECT * FROM quizzes WHERE id = ?',
      id
    );

    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found' });
      return;
    }

    const questions = await db.all<QuizQuestion[]>(
      'SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY `order` ASC',
      id
    );

    // Parse options JSON if stored as text
    const parsedQuestions = questions.map(q => ({
      ...q,
      options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
    }));

    // Do not expose correct_index to the client
    const safeQuestions = parsedQuestions.map(q => {
      const { correct_index: _correct, ...rest } = q;
      return rest;
    });
    res.json({ quiz: { ...quiz, questions: safeQuestions } });
  });

  // Submit a quiz attempt — frontend contract: QuizAttempt { quizId, lessonId, selectedIndex, correct, attemptedAt }
  // Returns: { recorded: boolean, explanation?: string }
  // The 'correct' field from the client is advisory; the server re-validates against the stored answer.
  router.post('/submit', async (req: Request, res: Response) => {
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { quizId, lessonId, selectedIndex, correct: _clientCorrect, attemptedAt } = req.body;
    const db = await getDb();

    if (quizId === undefined || selectedIndex === undefined) {
      res.status(400).json({ error: 'quizId and selectedIndex are required' });
      return;
    }

    try {
      // Find the quiz question for this quiz
      const question = await db.get<QuizQuestion>(
        `SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY \`order\` ASC LIMIT 1`,
        quizId,
      );

      if (!question) {
        // Quiz not found — still accept for local-first compat, mark as not recorded
        res.json({ recorded: false, explanation: 'Quiz not found on the server.' });
        return;
      }

      const isCorrect = selectedIndex === question.correct_index;
      const now = attemptedAt ?? new Date().toISOString();

      // Find the quiz to get its lesson_id
      const quiz = await db.get<Quiz>('SELECT * FROM quizzes WHERE id = ?', quizId);
      const effectiveLessonId = lessonId ?? quiz?.lesson_id ?? null;

      await db.run(
        `INSERT INTO quiz_attempts (id, user_id, quiz_id, lesson_id, selected_index, correct, attempted_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        uuidv4(),
        user.id,
        quizId,
        effectiveLessonId,
        selectedIndex,
        isCorrect ? 1 : 0,
        now,
        now,
      );

      // Update lesson progress quiz counts
      if (effectiveLessonId) {
        const progress = await db.get(
          'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
          user.id,
          effectiveLessonId,
        );

        if (progress) {
          const newCorrect = progress.quiz_correct + (isCorrect ? 1 : 0);
          const newTotal = progress.quiz_total + 1;
          await db.run(
            `UPDATE lesson_progress SET quiz_correct = ?, quiz_total = ?, updated_at = ?
             WHERE user_id = ? AND lesson_id = ?`,
            newCorrect,
            newTotal,
            now,
            user.id,
            effectiveLessonId,
          );
        }
      }

      const response: { recorded: boolean; explanation?: string; xpAwarded?: number } = {
        recorded: true,
        explanation: isCorrect ? question.explanation : undefined,
      };

      // Award XP if this was a correct answer
      if (isCorrect) {
        const quiz = QUIZZES.find(q => q.id === quizId);
        if (quiz && quiz.xp > 0) {
          const xpResult = await awardXp(user.id, {
            amount: quiz.xp,
            reason: `Quiz correct: ${quiz.question.substring(0, 80)}...`,
            sourceType: 'quiz_correct',
            sourceId: quizId,
          });
          response.xpAwarded = quiz.xp;
          response.newXp = xpResult.xp;
        }
      }

      res.json(response);
    } catch (error) {
      console.error('Quiz submit error:', error);
      res.status(500).json({ error: 'Failed to record quiz attempt' });
    }
  });

  // Submit a quiz answer (backend-native format)
  router.post('/:id/attempt', async (req: Request, res: Response) => {
    const { id: quizId } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { question_index, selected_index } = req.body;
    const db = await getDb();

    if (question_index === undefined || selected_index === undefined) {
      res.status(400).json({ error: 'question_index and selected_index are required' });
      return;
    }

    // Get all questions for this quiz, then pick by index
    const questions = await db.all<QuizQuestion[]>(
      'SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY `order` ASC',
      quizId
    );

    const question = questions[question_index];

    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    const isCorrect = selected_index === question.correct_index;
    const now = new Date().toISOString();

    // Get the quiz to find associated lesson
    const quiz = await db.get<Quiz>('SELECT * FROM quizzes WHERE id = ?', quizId);

    await db.run(
      `INSERT INTO quiz_attempts (id, user_id, quiz_id, lesson_id, selected_index, correct, attempted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uuidv4(),
      user.id,
      quizId,
      quiz?.lesson_id ?? null,
      selected_index,
      isCorrect ? 1 : 0,
      now,
      now
    );

    // Update lesson progress quiz counts
    if (quiz?.lesson_id) {
      const progress = await db.get(
        'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
        user.id,
        quiz.lesson_id
      );

      if (progress) {
        const newCorrect = progress.quiz_correct + (isCorrect ? 1 : 0);
        const newTotal = progress.quiz_total + 1;
        await db.run(
          `UPDATE lesson_progress SET quiz_correct = ?, quiz_total = ?, updated_at = ?
           WHERE user_id = ? AND lesson_id = ?`,
          newCorrect,
          newTotal,
          now,
          user.id,
          quiz.lesson_id
        );
      }
    }

    const response: { correct: boolean; correct_index: number; explanation?: string; xpAwarded?: number } = {
      correct: isCorrect,
      correct_index: question.correct_index,
      explanation: question.explanation ?? undefined,
    };

    // Award XP if this was a correct answer
    if (isCorrect) {
      const quiz = QUIZZES.find(q => q.id === quizId);
      if (quiz && quiz.xp > 0) {
        await awardXp(user.id, {
          amount: quiz.xp,
          reason: `Quiz correct: ${quiz.question.substring(0, 80)}...`,
          sourceType: 'quiz_correct',
          sourceId: quizId,
        });
        response.xpAwarded = quiz.xp;
      }
    }

    res.json(response);
  });

  // Get quiz results for a user
  router.get('/:id/result', async (req: Request, res: Response) => {
    const { id: quizId } = req.params;
    const user = getUser(req);

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const db = await getDb();

    const attempts = await db.all(
      'SELECT * FROM quiz_attempts WHERE user_id = ? AND quiz_id = ? ORDER BY attempted_at DESC',
      user.id,
      quizId
    );

    const totalAttempts = attempts.length;
    const correctCount = attempts.filter(a => a.correct).length;

    res.json({
      quiz_id: quizId,
      total_attempts: totalAttempts,
      correct_count: correctCount,
      accuracy: totalAttempts > 0 ? correctCount / totalAttempts : 0,
    });
  });

  return router;
}
