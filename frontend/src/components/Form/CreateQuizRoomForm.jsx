import Image from 'next/image';
import { useRef } from 'react';
import { useRouter } from 'next/router';
import { IoCloseSharp } from 'react-icons/io5';
import playSound from '@/helpers/playSound';
import categoriesJSON from '@/assets/categories.json';
import { useBoundStore } from '@/store/useBoundStore';

export default function CreateQuizRoomForm() {
   const dialog = useRef(null);
   const router = useRouter();
   const { quizQuery, setQuizQuery, saveQuiz, user } = useBoundStore(state => state);

   async function handleSubmit(e) {
      e.preventDefault();
      setQuizQuery('uid', user.uid);

      // Save the quiz using the current quizQuery values
      await saveQuiz();
      router.push(`/create`);
      closeDialog();
   }

   function handleInputs(e) {
      const { name, value, type, checked } = e.target;

      if (name === 'categories') {
         setQuizQuery(
            'categories',
            checked
               ? [...quizQuery.categories, value]
               : quizQuery.categories.filter(cat => cat !== value)
         );
         playSound(checked ? 'pop-up-on' : 'pop-up-off');
         return;
      }

      if (type === 'checkbox') {
         setQuizQuery(name, checked);
         playSound(checked ? 'pop-up-on' : 'pop-up-off');
         return;
      }

      setQuizQuery(name, value);
      playSound('pop');
   }

   function clickOutsideDialog(e) {
      const rect = dialog.current.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
         closeDialog();
      }
   }

   function closeDialog() {
      playSound('pop-down');
      dialog.current.classList.add('hide');
      function handleAnimationEnd() {
         dialog.current.classList.remove('hide');
         dialog.current.close();
         dialog.current.removeEventListener('animationend', handleAnimationEnd);
      }
      dialog.current.addEventListener('animationend', handleAnimationEnd);
   }

   return (
      <>
         <dialog ref={dialog} onClick={(e) => clickOutsideDialog(e)} id="createQuizRoomDialog" className='fixed top-1/2 w-5/6 sm:w-fit left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-slate-900 m-0 backdrop-blur-lg rounded-md py-9 px-8 md:px-11'>
            <button className='absolute top-2 right-2 text-3xl hover:scale-110 transition-all' onClick={closeDialog}>
               <IoCloseSharp />
            </button>

            <form onSubmit={handleSubmit}>
               <div className='flex flex-col lg:flex-row gap-4 sm:gap-8 mb-4 md:mb-8'>
                  <div className='flex gap-2 sm:gap-5 flex-col'>
                     <div className='flex flex-col gap-4 mb-6'>
                        <label className='flex flex-col'>
                           <span className='font-semibold mb-2'>Room Name</span>
                           <input
                              type='text'
                              name='roomName'
                              value={quizQuery.roomName}
                              onChange={handleInputs}
                              className='p-2 border rounded'
                              required
                           />
                        </label>
                        <label className='flex flex-col'>
                           <span className='font-semibold mb-2'>Room Description</span>
                           <textarea
                              name='roomDesc'
                              value={quizQuery.roomDesc}
                              onChange={handleInputs}
                              className='p-2 border rounded resize-none'
                              rows='3'
                              required
                           ></textarea>
                        </label>
                        <label className='flex flex-col'>
                           <span className='font-semibold mb-2'>Start Time</span>
                           <input
                              type='datetime-local'
                              name='startTime'
                              value={quizQuery.startTime}
                              onChange={handleInputs}
                              className='p-2 border rounded'
                              required
                           />
                        </label>
                        <label className='flex flex-col'>
                           <span className='font-semibold mb-2'>End Time</span>
                           <input
                              type='datetime-local'
                              name='endTime'
                              value={quizQuery.endTime}
                              onChange={handleInputs}
                              className='p-2 border rounded'
                              required
                           />
                        </label>
                     </div>
                  </div>

                  {/* <div className='flex flex-col gap-4'>

                     <fieldset className='p-1 relative'>
                        <legend className='text-lg font-semibold mb-2'>Questions</legend>
                        <input
                           type="range"
                           name="questions"
                           min="5"
                           max="50"
                           value={quizQuery.questions}
                           onChange={handleInputs}
                           className="w-full cursor-pointer"
                        />
                        <span className='block text-center mt-2 font-semibold'>{quizQuery.questions} Questions</span>
                     </fieldset>


                     <fieldset className='p-1 relative'>
                        <legend className='text-lg font-semibold mb-2'>Time</legend>
                        <div className="cntr shadow-sm relative">
                           <input
                              id="cqr-cbx2"
                              type="checkbox"
                              name="timemode"
                              checked={quizQuery.timemode}
                              onChange={handleInputs}
                              className="w-5 h-5 absolute top-0 left-0 opacity-0 z-10 cursor-pointer"
                           />
                           <label
                              htmlFor="cbx2"
                              className="cbx2 w-5 h-5 block bg-gray-200 rounded cursor-pointer"
                              title={quizQuery.timemode ? 'Disable time mode' : 'Enable time mode'}
                           ></label>
                        </div>

                        <div className='flex gap-3'>
                           {[10, 20, 30, 60].map(time => (
                              <label key={time} className="w-full">
                                 <input
                                    className='peer absolute hidden'
                                    type="radio"
                                    name="time"
                                    value={time}
                                    checked={time === Number(quizQuery.time)}
                                    onChange={handleInputs}
                                    disabled={!quizQuery.timemode}
                                 />
                                 <span className={`peer-checked:bg-blue-500 transition-colors peer-checked:text-white px-2 sm:px-4 py-2 rounded mr-3 cursor-pointer bg-gray-200 text-center w-full inline-block ${!quizQuery.timemode ? 'grayscale cursor-not-allowed' : 'active:scale-95'}`} translate="no">{time}s</span>
                              </label>
                           ))}
                        </div>
                     </fieldset>
                  </div> */}


                  {/* Categories Selection */}
                  <fieldset>
                     <legend className='text-lg font-semibold mb-2'>Categories</legend>
                     <div className='grid grid-cols-4 sm:grid-cols-2 gap-2 h-[80%]'>
                        {categoriesJSON.map(category => (
                           <label key={'cqr-' + category.name} className="relative cursor-pointer" title={category.name}>
                              <input
                                 defaultChecked={quizQuery.categories.includes(category.name)}
                                 className="peer relative h-16 opacity-0 w-full md:h-full block cursor-pointer"
                                 type="checkbox" name="categories" value={category.name} onClick={handleInputs}
                                 disabled={quizQuery.categories.length === 1 && quizQuery.categories.includes(category.name)}
                              />

                              <Image className={`absolute transition-all w-full h-full peer-checked:scale-90 p-2 rounded peer-checked:bg-[${category.color}] invert peer-checked:invert-0 peer-checked:bg-[var(--bgColor)] top-0 pointer-events-none peer-checked:outline-2 peer-checked:outline-offset-2 peer-checked:outline outline-[var(--bgColor)]`} src={`/categories-icons/${category.name.toLowerCase()}.svg`} alt={category.name} width={40} height={40} style={{ '--bgColor': category.color }} />
                           </label>
                        ))}
                     </div>
                  </fieldset>
               </div>

               <button type='submit' className='btn-primary uppercase py-3 px-6 w-full tracking-widest'>Create Room</button>
            </form>
         </dialog>
      </>
   );
}