import { useEffect, useState } from "react";
import { useBoundStore } from "@/store/useBoundStore";
import categoriesJSON from "@/assets/categories.json";
import { BsArrowRepeat } from "react-icons/bs";
import QuizQuestionsModal from './QuizQuestionsModal'
import ProfileLeaderboard from './ProfileLeaderboard'
import { useRouter } from "next/router";

export default function QuizHistory() {
   const { quizzes, history, getQuizByUserId, getQuestionsByQuizId, quizQuestions, setCreatedQuestions, setUpdate } = useBoundStore(state => state);
   const [activeTab, setActiveTab] = useState('history');
   const [modalOpen, setModalOpen] = useState(false);
   const [selectedQuiz, setSelectedQuiz] = useState(null);
   const [loading, setLoading] = useState(true);
   const [pendingQuizId, setPendingQuizId] = useState(null);
   const router = useRouter();

   useEffect(() => {
      (async () => {
         setLoading(true);
         if (typeof getQuizByUserId === 'function') {
            await getQuizByUserId(); // <-- Call the function!
         }
         setLoading(false);
      })();
   }, []);

   useEffect(() => {
      if (pendingQuizId && quizQuestions.length > 0) {
         setModalOpen(true);
         setPendingQuizId(null);
      }
   }, [quizQuestions, pendingQuizId]);

   const historyToDisplay = history?.length > 0 ? history : [];
   const quizzesToDisplay = quizzes?.length > 0 ? quizzes : [];

   if (loading) {
      return (
         <div className="text-slate-900 !bg-[length:30rem] mainHome px-6 py-4 text-2xl flex items-center justify-center absolute top-0 left-0 w-screen h-screen cursor-progress">
            <div title="Loading..." className='p-8 rounded-full bg-white'>
               <svg className="loader" xmlns="http://www.w3.org/2000/svg" version="1.2" baseProfile="tiny" x="0" y="0" viewBox="0 0 200 200" space="preserve"><path className="loaderreverse" d="M200 100c0-30.3-13.5-57.5-34.8-75.8 -4.8-4.1-12.2-3-15.8 2.3v0c-3 4.5-2.4 10.7 1.8 14.2 16.6 14.4 27.1 35.6 27.1 59.3s-10.5 44.9-27.1 59.3c-4.1 3.6-4.8 9.7-1.8 14.2v0c3.6 5.3 11 6.4 15.8 2.3C186.5 157.5 200 130.3 200 100z" /><path d="M156.7 100c0-14.9-5.8-28.5-15.2-38.6 -4.6-4.9-12.6-4.1-16.3 1.4l-0.4 0.6c-2.8 4.1-2.2 9.5 1.2 13.2 5.7 6.2 9.1 14.4 9.1 23.5 0 9-3.4 17.3-9.1 23.5 -3.3 3.7-3.9 9-1.2 13.2l0.4 0.6c3.7 5.6 11.7 6.3 16.3 1.4C150.9 128.5 156.7 114.9 156.7 100z" /></svg>
            </div>
         </div>
      );
   }

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
