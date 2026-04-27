function parseScore(score = '') {
  const [correctRaw, totalRaw] = String(score).split('/');
  const correct = Number(correctRaw);
  const total = Number(totalRaw);

  const safeCorrect = Number.isFinite(correct) ? correct : 0;
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const percentage = safeTotal > 0 ? (safeCorrect / safeTotal) * 100 : 0;

  return {
    correct: safeCorrect,
    total: safeTotal,
    percentage,
  };
}

function getRankBadgeStyle(rank) {
  if (rank === 0) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  if (rank === 1) return 'bg-slate-100 text-slate-700 border-slate-300';
  if (rank === 2) return 'bg-orange-100 text-orange-700 border-orange-300';
  return 'bg-blue-100 text-blue-700 border-blue-300';
}

export default function ProfileLeaderboard({ history = [] }) {
  const attempts = history.map((quiz, index) => {
    const { correct, total, percentage } = parseScore(quiz?.score);
    return {
      id: `${quiz?.quizId || quiz?.id || quiz?.quizTitle || 'quiz'}-${index}`,
      title: quiz?.quizTitle || 'Untitled Quiz',
      updatedAt: quiz?.updatedAt,
      correct,
      total,
      percentage,
    };
  });

  const totalCompleted = attempts.length;
  const totalCorrectAnswers = attempts.reduce((sum, item) => sum + item.correct, 0);
  const totalQuestions = attempts.reduce((sum, item) => sum + item.total, 0);
  const averageAccuracy = totalQuestions > 0 ? (totalCorrectAnswers / totalQuestions) * 100 : 0;
  const excellentRuns = attempts.filter(item => item.percentage >= 80).length;

  const topAttempts = [...attempts].sort((a, b) => {
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return b.correct - a.correct;
  });

  const bestAttempt = topAttempts[0] || null;

  return (
    <div className='space-y-5'>
      <section className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'>
        <article className='bg-white border border-blue-200 rounded-lg p-4 shadow-sm'>
          <p className='text-xs font-semibold text-gray-600 uppercase tracking-wide'>Total Quizzes</p>
          <p className='text-2xl font-bold text-blue-700 mt-1'>{totalCompleted}</p>
        </article>
        <article className='bg-white border border-blue-200 rounded-lg p-4 shadow-sm'>
          <p className='text-xs font-semibold text-gray-600 uppercase tracking-wide'>Total Score</p>
          <p className='text-2xl font-bold text-blue-700 mt-1'>{totalCorrectAnswers}/{totalQuestions}</p>
        </article>
        <article className='bg-white border border-blue-200 rounded-lg p-4 shadow-sm'>
          <p className='text-xs font-semibold text-gray-600 uppercase tracking-wide'>Avg Accuracy</p>
          <p className='text-2xl font-bold text-green-600 mt-1'>{averageAccuracy.toFixed(1)}%</p>
        </article>
        <article className='bg-white border border-blue-200 rounded-lg p-4 shadow-sm'>
          <p className='text-xs font-semibold text-gray-600 uppercase tracking-wide'>Excellent Runs</p>
          <p className='text-2xl font-bold text-orange-500 mt-1'>{excellentRuns}</p>
        </article>
      </section>

      <section className='bg-white border border-blue-200 rounded-xl p-4 shadow-sm'>
        <div className='flex flex-wrap items-center justify-between gap-3 mb-3'>
          <h3 className='text-lg font-bold text-slate-900'>Overall Leaderboard</h3>
          {bestAttempt && (
            <p className='text-sm text-gray-600'>
              Best: <span className='font-semibold text-green-600'>{bestAttempt.percentage.toFixed(1)}%</span> on{' '}
              <span className='font-semibold text-slate-800'>{bestAttempt.title}</span>
            </p>
          )}
        </div>

        {topAttempts.length > 0 ? (
          <ul className='space-y-3'>
            {topAttempts.slice(0, 10).map((attempt, index) => (
              <li
                key={attempt.id}
                className='flex items-center gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50/60'
              >
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${getRankBadgeStyle(index)}`}>
                  {index + 1}
                </div>

                <div className='min-w-0 flex-1'>
                  <p className='font-semibold text-slate-900 truncate'>{attempt.title}</p>
                  <p className='text-xs text-gray-600'>
                    {attempt.updatedAt ? new Date(attempt.updatedAt).toLocaleDateString() : 'Recently played'}
                  </p>
                </div>

                <div className='text-right'>
                  <p className='text-sm font-bold text-blue-700'>
                    {attempt.correct}/{attempt.total}
                  </p>
                  <p className='text-xs font-semibold text-green-600'>
                    {attempt.percentage.toFixed(1)}%
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className='rounded-lg border border-blue-200 bg-blue-50 p-6 text-center text-gray-600'>
            Complete a quiz to appear on your overall leaderboard.
          </div>
        )}
      </section>
    </div>
  );
}
