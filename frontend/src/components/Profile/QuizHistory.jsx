import { useEffect, useState } from "react";
import { useBoundStore } from "@/store/useBoundStore";
import categoriesJSON from "@/assets/categories.json";
import { BsArrowRepeat } from "react-icons/bs";
import { FiTrash2 } from "react-icons/fi";
import QuizQuestionsModal from './QuizQuestionsModal'
import ProfileLeaderboard from './ProfileLeaderboard'
import { useRouter } from "next/router";

export default function QuizHistory() {
   const { quizzes, history, getQuizByUserId, getQuestionsByQuizId, quizQuestions, setCreatedQuestions, setUpdate, isAuthenticated, deleteQuiz } = useBoundStore(state => state);
   const [activeTab, setActiveTab] = useState('history');
   const [modalOpen, setModalOpen] = useState(false);
   const [selectedQuiz, setSelectedQuiz] = useState(null);
   const [pendingQuizId, setPendingQuizId] = useState(null);
   const router = useRouter();

   useEffect(() => {
      if (pendingQuizId && quizQuestions.length > 0) {
         setModalOpen(true);
         setPendingQuizId(null);
      }
   }, [quizQuestions, pendingQuizId]);

   const historyToDisplay = history?.length > 0 ? history : [];
   const quizzesToDisplay = quizzes?.length > 0 ? quizzes : [];

   return (
      <aside className='bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg w-full px-6 py-6 flex flex-col justify-start text-slate-900 border border-blue-100'>

         {/* Tabs */}
         <div className="flex space-x-8 border-b-2 border-gray-300 mb-6">
            <button
               className={`pb-3 text-base font-semibold transition-all ${activeTab === 'history'
                  ? 'border-b-4 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-blue-500'
                  }`}
               onClick={() => setActiveTab('history')}
            >
               Quiz History
            </button>
            <button
               className={`pb-3 text-base font-semibold transition-all ${activeTab === 'created'
                  ? 'border-b-4 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-blue-500'
                  }`}
               onClick={() => setActiveTab('created')}
            >
               Created Quizzes
            </button>
            <button
               className={`pb-3 text-base font-semibold transition-all ${activeTab === 'leaderboard'
                  ? 'border-b-4 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-blue-500'
                  }`}
               onClick={() => setActiveTab('leaderboard')}
            >
               Leaderboard
            </button>
         </div>

         {/* Tab Content */}
         {activeTab === 'history' && (
            <div className='overflow-y-auto max-h-[calc(100vh-250px)]'>
               <ul className='space-y-4'>
                  {historyToDisplay.map((quiz, index) => {
                     // Extract correctAnswers and totalQuestions from the score field
                     const [correctAnswers, totalQuestions] = quiz.score.split('/').map(Number);
                     const percentage = ((correctAnswers / totalQuestions) * 100).toFixed(1);

                     // Determine the color class based on the percentage
                     const getColorClass = (percentage) => {
                        if (percentage < 33.33) return 'text-red-500'; // 0-1/3
                        if (percentage < 66.67) return 'text-orange-400'; // 1/3-2/3
                        return 'text-green-500'; // 2/3+
                     };

                     return (
                        <li key={index} className='p-4 bg-white border border-blue-200 rounded-lg hover:shadow-md transition-shadow flex items-center gap-4'>
                           <div className='relative w-20 h-20 flex-shrink-0'>
                              <svg className='w-full h-full' viewBox="0 0 36 36">
                                 <path
                                    className="text-gray-300"
                                    d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                 />
                                 <path
                                    className={getColorClass(percentage)}
                                    d="M18 2.0845
                              a 15.9155 15.9155 0 0 1 0 31.831
                              a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeDasharray={`${percentage}, 100`}
                                 />
                              </svg>
                              <div className='absolute inset-0 flex items-center justify-center text-xs font-bold'>
                                 {correctAnswers}/{totalQuestions}
                              </div>
                           </div>
                           <div className='flex-1 min-w-0'>
                              <p className='font-bold text-slate-900 truncate'>{quiz.quizTitle}</p>
                              <p className='text-sm text-gray-600'>{new Date(quiz.updatedAt).toLocaleDateString()}</p>
                              <p className='text-sm font-semibold'><span className={getColorClass(percentage)}>{percentage}%</span></p>
                           </div>
                        </li>
                     );
                  })}
                  {historyToDisplay.length === 0 && (
                     <li className='p-4 bg-blue-50 border border-blue-200 rounded-lg text-center text-gray-500'>
                        <p>No quiz history available.</p>
                     </li>
                  )}
               </ul>
            </div>
         )}

         {activeTab === 'created' && (
            <div className='overflow-y-auto max-h-[calc(100vh-250px)]'>
               <ul className='space-y-4'>
                  {quizzesToDisplay.map((quiz, index) => (
                     <li key={index} className='p-4 bg-white border border-blue-200 rounded-lg hover:shadow-md transition-shadow'>
                        <div className="flex justify-between items-start gap-3">
                           <div className='flex-1 min-w-0'>
                              <p className='font-bold text-slate-900'>{quiz.title}</p>
                              <p className='text-sm text-gray-600 line-clamp-2'>{quiz.description}</p>
                              <p className='text-xs mt-2'>
                                 <span
                                    className={`font-bold px-2 py-1 rounded-full ${quiz.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                       quiz.status === 'INACTIVE' ? 'bg-gray-100 text-gray-700' :
                                          quiz.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                                             'bg-red-100 text-red-700' // For DELETED
                                       }`}
                                 >
                                    {quiz.status}
                                 </span>
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                 {quiz.categories?.map((category, i) => {
                                    const categoryData = categoriesJSON.find(cat => cat.name.toUpperCase() === category.replace(/_/g, ' '));
                                    return (
                                       <div
                                          key={i}
                                          className="w-8 h-8 flex items-center justify-center rounded-full shadow-sm"
                                          style={{
                                             backgroundColor: categoryData?.color || '#ccc',
                                          }}
                                          title={categoryData?.name || category}
                                       >
                                          <img
                                             src={`/categories-icons/${category.toLowerCase().replace(/_/g, ' ')}.svg`}
                                             alt={category}
                                             className="w-5 h-5"
                                          />
                                       </div>
                                    );
                                 })}
                              </div>
                           </div>
                           <div className="flex flex-col gap-2 flex-shrink-0">
                              <button
                                 className="btn-primary px-3 py-1 text-xs rounded whitespace-nowrap"
                                 onClick={async () => {
                                    setPendingQuizId(quiz.quiz_id);
                                    await getQuestionsByQuizId(quiz.quiz_id);
                                 }}
                              >
                                 View
                              </button>
                              <button
                                 className="btn-secondary px-3 py-1 text-xs rounded whitespace-nowrap"
                                 onClick={async () => {
                                    setUpdate(true);
                                    await setCreatedQuestions(quiz.quiz_id);
                                    router.push(`/create`);
                                 }}
                              >
                                 Edit
                              </button>
                              <button
                                 className="px-3 py-1 text-xs rounded whitespace-nowrap bg-red-100 text-red-600 hover:bg-red-200 transition-colors flex items-center gap-1 justify-center"
                                 onClick={async () => {
                                    if (window.confirm('Are you sure you want to delete this quiz?')) {
                                       await deleteQuiz(quiz.quiz_id);
                                    }
                                 }}
                              >
                                 <FiTrash2 className="w-3 h-3" />
                                 Delete
                              </button>
                           </div>
                        </div>
                     </li>
                  ))}
                  {quizzesToDisplay.length === 0 && (
                     <li className='p-4 bg-blue-50 border border-blue-200 rounded-lg text-center text-gray-500'>
                        <p>No created quizzes available.</p>
                     </li>
                  )}
               </ul>
               {/* Modal for viewing questions */}
               <QuizQuestionsModal
                  open={modalOpen}
                  onClose={() => setModalOpen(false)}
                  quiz={quizQuestions}
               />
            </div>
         )}

         {activeTab === 'leaderboard' && (
            <div className='overflow-y-auto max-h-[calc(100vh-250px)]'>
               <ProfileLeaderboard history={historyToDisplay} />
            </div>
         )}
      </aside>
   )
}
