import { useRef } from 'react'
import { IoCloseSharp } from 'react-icons/io5'

export default function QuizQuestionsModal({ open, onClose, quiz }) {
  const dialog = useRef(null)
  const displayQuiz = quiz

  // Open/close logic for dialog
  if (open && dialog.current && !dialog.current.open) {
    dialog.current.showModal()
  } else if (!open && dialog.current && dialog.current.open) {
    dialog.current.close()
  }

  function handleClose() {
    onClose && onClose()
    dialog.current.close()
  }

  if (!Array.isArray(displayQuiz) || displayQuiz.length === 0) {
    return null;
  }

  return (
    <dialog
      ref={dialog}
      id="quizQuestionsModal"
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-2xl bg-white text-slate-900 m-0 backdrop-blur-lg rounded-xl shadow-2xl py-8 px-4 md:px-10 border border-blue-200"
    >
      <button
        className="absolute top-3 right-3 text-3xl text-slate-500 hover:text-red-500 hover:scale-110 transition-all"
        onClick={handleClose}
        aria-label="Close"
      >
        <IoCloseSharp />
      </button>
      <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center text-blue-700 tracking-wide">
        Quiz Questions
      </h2>
      <ul className="space-y-8 max-h-[60vh] overflow-y-auto pr-2">
        {displayQuiz.map((q, idx) => (
          <li
            key={idx}
            className="bg-blue-50 rounded-lg p-4 shadow flex flex-col gap-2 border border-blue-100"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-lg">
                {idx + 1}
              </span>
              <p className="font-semibold text-lg text-blue-900">{q.question}</p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {q.answers.map((ans, i) => (
                <li
                  key={i}
                  className={`rounded px-3 py-2 border transition-all ${ans === q.correctAnswer
                      ? 'bg-green-100 border-green-400 text-green-700 font-bold'
                      : 'bg-white border-gray-200 text-gray-700'
                    }`}
                >
                  {ans}
                  {ans === q.correctAnswer && (
                    <span className="ml-2 text-green-500 font-bold">✔</span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </dialog>
  )
}