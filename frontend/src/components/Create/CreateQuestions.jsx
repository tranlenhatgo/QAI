import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { IoMdSave } from 'react-icons/io';
import { FaRegQuestionCircle } from 'react-icons/fa';
import { AiFillBulb, AiFillFile, AiFillFolder, AiOutlineCaretUp } from "react-icons/ai";
import { IoCloseSharp } from 'react-icons/io5';
import Image from 'next/image';
import { useBoundStore } from '@/store/useBoundStore';
import fileToGenerate from '@/helpers/quiz/fileToGenerate';
import { BsArrowRepeat } from 'react-icons/bs';

const QuizQuestionCreator = () => {
  const [currentQuestion, setCurrentQuestion] = useState({ question: '', answers: ['', '', '', ''], correctAnswer: '', category: '' });
  const { addCreatedQuestion, createdQuestions, removeCreatedQuestion, saveQuestions, quizId, generateQuestion, update, updateQuizQuestions, setCreateQuestions } = useBoundStore(state => state);
  const [fileSelected, setFileSelected] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({ type: '', message: '' });
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateStatus, setGenerateStatus] = useState({ type: '', message: '' });

  // Cleanup uploaded file when component unmounts (page navigation)
  useEffect(() => {
    return () => {
      setFileSelected(false);
      setUploadStatus({ type: '', message: '' });
      setGenerateStatus({ type: '', message: '' });
    };
  }, []);

  const addQuestion = () => {
    if (!currentQuestion.question.trim()) {
      alert("Please enter a question.");
      return;
    }
    if (!currentQuestion.correctAnswer) {
      alert("Please select the correct answer.");
      return;
    }
    addCreatedQuestion(currentQuestion);
    setCurrentQuestion({ question: '', answers: ['', '', '', ''], correctAnswer: '' });
  };

  const updateQuestion = (value) => {
    setCurrentQuestion({ ...currentQuestion, question: value });
  };

  const updateOption = (index, value) => {
    const updatedAnswers = [...currentQuestion.answers];
    updatedAnswers[index] = value;
    setCurrentQuestion({ ...currentQuestion, answers: updatedAnswers });
  };

  const clearUploadedFile = () => {
    setFileSelected(false);
    setUploadStatus({ type: '', message: '' });
    setGenerateStatus({ type: '', message: '' });
    // Reset file input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
  };

  const selectCorrectAnswer = (aIndex) => {
    const selectedAnswer = currentQuestion.answers[aIndex];
    if (!selectedAnswer.trim()) {
      alert("Please provide an answer before selecting it as correct.");
      return;
    }
    setCurrentQuestion({ ...currentQuestion, correctAnswer: selectedAnswer });
  };

  const selectListAnswer = (qIndex, aIndex, event) => {
    // Update the correct answer in the store/state
    const updatedQuestions = createdQuestions.map((q, i) =>
      i === qIndex ? { ...q, correctAnswer: q.answers[aIndex] } : q
    );
    // If using Zustand or similar:
    // add a setCreatedQuestions or similar action in your store
    if (typeof setCreatedQuestions === 'function') {
      setCreateQuestions(updatedQuestions);
    }

    // Visual feedback (optional)
    const buttons = event.target.closest('ul').querySelectorAll('button');
    buttons.forEach((btn) => btn.classList.remove('correctAnswer'));

    event.target.parentNode.classList.add('shake-left-right');
    event.target.classList.add('correctAnswer');
    setTimeout(() => {
      event.target.parentNode.classList.remove('shake-left-right');
    }, 600);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center">
          <FaRegQuestionCircle className="mr-2 text-blue-500" /> Question Creator
        </h2>
        <div className="flex items-center justify-end space-x-2 mt-2 md:mt-0">
          <button
            onClick={() => setCurrentQuestion({ question: '', answers: ['', '', '', ''], correctAnswer: '' })}
            className="btn-primary flex items-center space-x-2 text-sm px-3 py-2 md:text-base md:px-5 md:py-3"
            title="Clear current question"
          >
            <BsArrowRepeat />
            <span className="hidden md:inline">Clear</span>
          </button>
        </div>
      </div>

      <div className="border-b pb-4 mb-4">
        <input
          type="text"
          placeholder="Enter your question"
          value={currentQuestion.question}
          onChange={(e) => updateQuestion(e.target.value)}
          className="w-full p-2 border rounded-md focus:ring"
        />
        <div className="mt-2 space-y-2">
          {currentQuestion.answers.map((opt, oIndex) => (
            <div key={oIndex} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder={`Answer ${['A', 'B', 'C', 'D'][oIndex]}`}
                value={opt}
                onChange={(e) => updateOption(oIndex, e.target.value)}
                className="w-full p-2 border rounded-md focus:ring"
              />
              <button
                type="button"
                className={`p-2 rounded-md ${currentQuestion.correctAnswer === opt && opt.trim() !== '' ? 'bg-green-500 text-white' : 'bg-gray-200'
                  }`}
                onClick={() => selectCorrectAnswer(oIndex)}
              >
                ✓
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-4 my-4">
          <button
            onClick={addQuestion}
            className="btn-primary flex items-center space-x-2 w-full md:w-auto text-sm px-3 py-2 md:text-base md:px-5 md:py-3"
          >
            <FiPlus /> <span>Add Question</span>
          </button>
          
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">AI Question Generation</h3>
            <div className="space-y-3">
              <input
                type="file"
                id="fileInput"
                className="hidden"
                accept="application/pdf, .txt, .docx, .doc, .pptx, .ppt"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (file && quizId) {
                    setUploadLoading(true);
                    setUploadStatus({ type: '', message: '' });
                    setFileSelected(false);
                    try {
                      await fileToGenerate(file, quizId);
                      setFileSelected(true);
                      setUploadStatus({ type: 'success', message: 'File uploaded successfully! Click "Generate Questions" to proceed.' });
                    } catch (error) {
                      setUploadStatus({ type: 'error', message: error.message || 'Failed to upload file. Please try again.' });
                      setFileSelected(false);
                    } finally {
                      setUploadLoading(false);
                    }
                  }
                }}
              />

              <button
                className="btn-primary flex items-center justify-center space-x-2 w-full text-sm px-3 py-2 md:text-base md:px-5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => document.getElementById('fileInput').click()}
                disabled={uploadLoading}
              >
                {uploadLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <AiFillFile /> <span>Upload File</span>
                  </>
                )}
              </button>

              {uploadStatus.message && (
                <p className={`text-sm ${uploadStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                  {uploadStatus.message}
                </p>
              )}

              {fileSelected && !uploadLoading && (
                <>
                  {/* Clear File Button */}
                  <button
                    className="btn-secondary flex items-center justify-center space-x-2 w-full text-sm px-3 py-2 border border-gray-300 hover:bg-gray-100"
                    onClick={clearUploadedFile}
                  >
                    <IoCloseSharp /> <span>Clear File</span>
                  </button>

                  <button
                    className="btn-primary flex items-center justify-center space-x-2 w-full text-sm px-3 py-2 md:text-base md:px-5 md:py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      setGenerateLoading(true);
                      setGenerateStatus({ type: '', message: '' });
                      try {
                        await generateQuestion(quizId);
                        setGenerateStatus({ type: 'success', message: 'Question generated successfully! You can generate more or upload a different file.' });
                        // Don't clear fileSelected - keep the file for multiple generations
                      } catch (error) {
                        setGenerateStatus({ type: 'error', message: error.message || 'Failed to generate question. Please try again.' });
                      } finally {
                        setGenerateLoading(false);
                      }
                    }}
                    disabled={generateLoading}
                  >
                    {generateLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <AiFillBulb /> <span>Generate Questions</span>
                      </>
                    )}
                  </button>

                  {generateStatus.message && (
                    <p className={`text-sm ${generateStatus.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                      {generateStatus.message}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {createdQuestions.map((question, i) => (
        <div key={i} className="mb-6 relative">
          <button
            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-600 m-2"
            onClick={() => removeCreatedQuestion(i)}
          >
            ✕
          </button>
          <p className='rounded-md h-32 md:h-[6.5rem] flex justify-center items-center bg-blue-500 px-5 md:px-10 py-6 text-white text-xl font-semibold mb-3'>
            {question.question}
          </p>
          <ul className={`md:columns-2 mt-4 ${'answers-' + (i + 1)}`}>
            {question.answers.map((answer, j) => (
              <li key={j + answer} className="relative">
                <button className={`${'answer-' + (j + 1)} peer btn-primary w-full shadow-sm pl-12 py-3 px-5 rounded mb-6 ${answer.length > 24 ? 'text-sm' : ''} ${answer === question.correctAnswer ? 'correctAnswer' : ''}`}
                  onClick={(e) => selectListAnswer(i, j, e)}> {answer || '---'} </button>
                <Image className='absolute pointer-events-none left-2 top-1 peer-disabled:translate-y-0 peer-hover:translate-y-[0.25em] peer-active:translate-y-[0.75em] transition-transform z-20 invert' src={`/letters/letter-${['a', 'b', 'c', 'd'][j]}.svg`} width={40} height={40} alt={`Question ${j + 1}]}`} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default QuizQuestionCreator;