export default function JoinGameForm({handleInputs}) {
   return (
      <>
            <div className='flex flex-col sm:flex-row gap-4 sm:gap-8 mb-4'>
               <div className='flex flex-col gap-4'>
                  <label className='flex flex-col'>
                     <span className='font-semibold mb-2'>Game Code or Link</span>
                     <input type='text' name='quizId' className='p-2 border rounded' onChange={handleInputs} required />
                  </label>
               </div>
               <div className='flex flex-col gap-4'>
                  <label className='flex flex-col'>
                     <span className='font-semibold mb-2'>Player Name</span>
                     <input type='text' name='name' className='p-2 border rounded' onChange={handleInputs} required />
                  </label>
               </div>
            </div>
      </>
   )
}
