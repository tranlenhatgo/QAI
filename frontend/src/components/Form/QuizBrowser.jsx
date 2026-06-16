import { useCallback, useEffect, useState } from 'react'
import { IoSearchSharp } from 'react-icons/io5'
import categoriesJSON from '@/assets/categories.json'

export default function QuizBrowser({ onSelectQuiz, isOpen, selectedQuizId }) {
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
      if (!isOpen || loaded) return
      const timeoutId = window.setTimeout(fetchQuizzes, 300)
      return () => window.clearTimeout(timeoutId)
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
      <div className='flex flex-col gap-3'>
         <span className='font-bold'>Browse Quizzes</span>
         <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]'>
            <div className='relative flex-1'>
               <IoSearchSharp className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' />
               <input
                  type='text'
                  placeholder='Search by title...'
                  className='w-full rounded-md border border-slate-300 bg-white p-2 pl-9 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
               />
            </div>
            <select
               className='w-full rounded-md border border-slate-300 bg-white p-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
               value={selectedCategory}
               onChange={e => setSelectedCategory(e.target.value)}
            >
               <option value=''>All categories</option>
               {categoriesJSON.map(cat => (
                  <option key={cat.id} value={cat.name.toLowerCase()}>{cat.name}</option>
               ))}
            </select>
         </div>

         <div className='max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white'>
            {loading && <p className='p-3 text-sm text-slate-500'>Loading...</p>}
            {error && <p className='p-3 text-sm text-red-600'>{error}</p>}
            {!loading && !error && filtered.length === 0 && (
               <p className='p-3 text-sm text-slate-500'>No quizzes found</p>
            )}
            {filtered.map(quiz => {
               const isUnavailable = quiz.availability === 'upcoming' || quiz.availability === 'expired'
               const isSelected = quiz.quiz_id === selectedQuizId
               return (
                  <div key={quiz.quiz_id}>
                     <button
                        type='button'
                        disabled={isUnavailable}
                        aria-pressed={isSelected}
                  className={`w-full border-b p-3 text-left transition-colors last:border-b-0 ${isUnavailable ? 'cursor-not-allowed bg-slate-50 opacity-50' : isSelected ? 'bg-blue-50 ring-2 ring-inset ring-blue-500' : 'hover:bg-blue-50'}`}
                        onClick={() => onSelectQuiz(quiz)}
                     >
                        <div className='items-center gap-2'>
                           <span className='font-medium text-sm truncate'>{quiz.title || 'Untitled Quiz'}</span>
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
                  </div>)
            })}
         </div>
      </div>
   )
}
