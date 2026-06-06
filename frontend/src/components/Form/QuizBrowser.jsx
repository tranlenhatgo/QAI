import { useCallback, useEffect, useState } from 'react'
import { IoSearchSharp } from 'react-icons/io5'
import categoriesJSON from '@/assets/categories.json'

export default function QuizBrowser({ onSelectQuiz, isOpen }) {
   const [quizzes, setQuizzes] = useState([])
   const [search, setSearch] = useState('')
   const [selectedCategory, setSelectedCategory] = useState('')
   const [loading, setLoading] = useState(false)
   const [error, setError] = useState(null)
   const [loaded, setLoaded] = useState(false)

   const fetchQuizzes = useCallback(async () => {
      setLoading(true)
      setError(null)
      try {
         const res = await fetch('/api/quiz/list-all')
         const data = await res.json().catch(() => ({}))
         if (!res.ok) throw new Error(data.message || 'Failed to load quizzes')
         setQuizzes(data)
         setLoaded(true)
      } catch (err) {
         setError(err.message)
      } finally {
         setLoading(false)
      }
   }, [])

   useEffect(() => {
      if (isOpen && !loaded) fetchQuizzes()
   }, [isOpen, loaded, fetchQuizzes])

   const filtered = quizzes.filter(q => {
      const matchesSearch = !search ||
         q.title?.toLowerCase().includes(search.toLowerCase()) ||
         q.categories?.some(c => c.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory = !selectedCategory ||
         q.categories?.some(c => c.toLowerCase() === selectedCategory.toLowerCase())
      return matchesSearch && matchesCategory
   })

   return (
      <div className='flex flex-col gap-2'>
         <span className='font-semibold'>Browse Quizzes</span>
         <div className='flex gap-2'>
            <div className='relative flex-1'>
               <IoSearchSharp className='absolute left-2 top-1/2 -translate-y-1/2 text-gray-400' />
               <input
                  type='text'
                  placeholder='Search by title...'
                  className='w-full p-2 pl-8 border rounded text-sm'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
               />
            </div>
            <select
               className='p-2 border rounded text-sm bg-white'
               value={selectedCategory}
               onChange={e => setSelectedCategory(e.target.value)}
            >
               <option value=''>All categories</option>
               {categoriesJSON.map(cat => (
                  <option key={cat.id} value={cat.name.toLowerCase()}>{cat.name}</option>
               ))}
            </select>
         </div>

         <div className='max-h-48 overflow-y-auto border rounded'>
            {loading && <p className='text-sm text-gray-500 p-2'>Loading...</p>}
            {error && <p className='text-sm text-red-500 p-2'>{error}</p>}
            {!loading && !error && filtered.length === 0 && (
               <p className='text-sm text-gray-500 p-2'>No quizzes found</p>
            )}
            {filtered.map(quiz => {
               const isUnavailable = quiz.availability === 'upcoming' || quiz.availability === 'expired'
               return (
               <button
                  key={quiz.quiz_id}
                  type='button'
                  disabled={isUnavailable}
                  className={`w-full text-left p-2 border-b last:border-b-0 transition-colors ${isUnavailable ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50'}`}
                  onClick={() => onSelectQuiz(quiz)}
               >
                  <div className='flex items-center gap-2'>
                     <span className='font-medium text-sm truncate flex-1'>{quiz.title || 'Untitled Quiz'}</span>
                     {quiz.availability === 'upcoming' && (
                        <span className='shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700'>Upcoming</span>
                     )}
                     {quiz.availability === 'expired' && (
                        <span className='shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700'>Expired</span>
                     )}
                  </div>
                  {quiz.categories?.length > 0 && (
                     <div className='text-xs text-gray-500 truncate'>
                        {quiz.categories.join(', ')}
                     </div>
                  )}
                  {quiz.availability === 'upcoming' && quiz.start_time && (
                     <div className='text-[10px] text-amber-600 mt-0.5'>Starts {new Date(quiz.start_time).toLocaleString()}</div>
                  )}
               </button>
               )
            })}
         </div>
      </div>
   )
}
