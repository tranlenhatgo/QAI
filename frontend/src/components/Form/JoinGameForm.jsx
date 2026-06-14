export default function JoinGameForm({handleInputs, selectedQuizId, playerName}) {
   return (
      <>
            <div className='mb-4 grid gap-4 sm:grid-cols-2'>
               <div className='min-w-0'>
                  <label className='flex flex-col'>
                     <span className='mb-2 font-bold'>Game Code or Link</span>
                     <input type='text' name='quizId' className='w-full rounded-md border border-slate-300 bg-white p-2 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100' onChange={handleInputs} value={selectedQuizId || ''} required />
                  </label>
               </div>
               <div className='min-w-0'>
                  <label className='flex flex-col'>
                     <span className='mb-2 font-bold'>Player Name</span>
                     <input type='text' name='name' className='w-full rounded-md border border-slate-300 bg-white p-2 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100' onChange={handleInputs} value={playerName || ''} required />
                  </label>
               </div>
            </div>
      </>
   )
}
