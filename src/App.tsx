import { useState, useEffect } from 'react'
import mammoth from 'mammoth'
import './App.css'

interface QuizQuestion {
  question: string;
  variants: string[];
  correctAnswer: string;
}

function App() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showNextButton, setShowNextButton] = useState(false)

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/culturology.docx')
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob()
      const result = await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() })
      
      // Clean up the content
      let content = result.value || ''
      content = content
        .replace(/\n+/g, ' ') // Remove newlines
        .replace(/\s+/g, ' ') // Normalize spaces
        .replace(/<\/variant>/g, '') // Remove closing variant tags
        .replace(/<\/variantright>/g, '') // Remove closing variantright tags
        .replace(/<\/question>/g, '') // Remove closing question tags
        .trim()

      if (!content) {
        throw new Error('No content found in document')
      }

      // Split content by questions
      const questions = content.split('<question>')
        .filter(Boolean) // Remove empty strings
        .map(q => {
          // Extract question text
          const questionMatch = q.match(/(.*?)(?=<variant|<variantright)/)
          if (!questionMatch) return null

          const question = questionMatch[1].trim()
          
          // Extract variants
          const variants: string[] = []
          const variantMatches = q.match(/<variant>(.*?)(?=<variant|<variantright|$)/g) || []
          variantMatches.forEach(v => {
            const variant = v.replace(/<variant>/, '').trim()
            if (variant) variants.push(variant)
          })

          // Extract right answer
          const rightMatch = q.match(/<variantright>(.*?)(?=<variant|$)/)
          if (!rightMatch) return null

          const rightAnswer = rightMatch[1].trim()
          if (rightAnswer && !variants.includes(rightAnswer)) {
            variants.push(rightAnswer)
          }

          if (!question || !rightAnswer || variants.length === 0) return null

          return {
            question,
            variants: shuffleArray(variants),
            correctAnswer: rightAnswer
          }
        })
        .filter((q): q is QuizQuestion => q !== null)

      if (questions.length === 0) {
        throw new Error('No valid questions found in the document. Please check the document format.')
      }

      console.log(`Successfully parsed ${questions.length} questions`)
      setQuestions(questions)
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading questions:', error)
      setError(error instanceof Error ? error.message : 'Failed to load questions')
      setQuestions([])
      setIsLoading(false)
    }
  }

  // Utility function to shuffle array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array]
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
    }
    return newArray
  }

  const handleAnswerClick = (variant: string) => {
    setSelectedAnswer(variant)
    if (variant === questions[currentQuestion].correctAnswer) {
      setScore(score + 1)
    }
    setShowNextButton(true)
  }

  const handleNextQuestion = () => {
    if (currentQuestion + 1 < questions.length) {
      setCurrentQuestion(currentQuestion + 1)
      setSelectedAnswer(null)
      setShowNextButton(false)
    } else {
      setShowResult(true)
    }
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setScore(0)
    setShowResult(false)
    setShowNextButton(false)
  }

  const handleEndQuiz = () => {
    setShowResult(true)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500 text-center">
          <p className="text-xl font-bold mb-4">Error loading questions</p>
          <p>{error}</p>
          <button 
            onClick={() => loadQuestions()}
            className="mt-4 bg-cyan-500 text-white py-2 px-4 rounded-md hover:bg-cyan-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return <div className="flex justify-center items-center h-screen">Loading questions...</div>
  }

  return (
    <div className="min-h-screen bg-white py-2 sm:py-6 flex flex-col justify-center">
      <div className="relative py-2 sm:py-3 w-full px-2 sm:px-4 mx-auto max-w-[95%] sm:max-w-3xl">
        {!showResult ? (
          <div className="w-full mx-auto">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-8">
                <h2 className="text-2xl sm:text-4xl font-bold text-gray-800 text-center sm:text-left">
                  Question {currentQuestion + 1} of {questions.length}
                </h2>
                <button
                  onClick={handleEndQuiz}
                  className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-300 
                    hover:border-red-400 rounded-lg transition-colors duration-300 w-full sm:w-auto"
                >
                  End Quiz
                </button>
              </div>
              
              <p className="text-xl sm:text-2xl text-gray-700 font-medium mb-4 sm:mb-8 text-left">
                {questions[currentQuestion].question}
              </p>

              <div className="space-y-3 sm:space-y-4 flex flex-col">
                {questions[currentQuestion].variants.map((variant, index) => {
                  const isSelected = selectedAnswer === variant
                  const isCorrect = variant === questions[currentQuestion].correctAnswer
                  const showCorrectness = selectedAnswer !== null

                  return (
                    <button
                      key={index}
                      onClick={() => !selectedAnswer && handleAnswerClick(variant)}
                      disabled={selectedAnswer !== null}
                      className={`w-full p-3 sm:p-4 text-left transition-all duration-300 flex items-center
                        ${!showCorrectness 
                          ? 'hover:bg-gray-50 active:bg-gray-100 rounded-lg border border-gray-200' 
                          : isCorrect
                            ? 'bg-green-50 border border-green-200 rounded-lg'
                            : isSelected
                              ? 'bg-red-50 border border-red-200 rounded-lg'
                              : 'rounded-lg border border-gray-200 opacity-60'
                        }
                      `}
                    >
                      <div className="flex items-center w-full">
                        <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex-shrink-0 mr-3 sm:mr-4
                          ${!showCorrectness 
                            ? isSelected ? 'border-blue-500' : 'border-gray-300'
                            : isCorrect
                              ? 'border-green-500'
                              : isSelected
                                ? 'border-red-500'
                                : 'border-gray-300'
                          }
                        `}>
                          {(isSelected || (showCorrectness && isCorrect)) && (
                            <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 m-auto rounded-full
                              ${!showCorrectness 
                                ? 'bg-blue-500'
                                : isCorrect
                                  ? 'bg-green-500'
                                  : 'bg-red-500'
                              }
                            `} />
                          )}
                        </div>
                        <span className={`text-base sm:text-lg flex-grow
                          ${showCorrectness && isCorrect ? 'text-green-700 font-medium' : ''}
                          ${showCorrectness && isSelected && !isCorrect ? 'text-red-700 font-medium' : ''}
                        `}>
                          {variant}
                        </span>
                        {showCorrectness && isCorrect && (
                          <svg 
                            className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 flex-shrink-0" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M5 13l4 4L19 7" 
                            />
                          </svg>
                        )}
                        {showCorrectness && isSelected && !isCorrect && (
                          <svg 
                            className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 flex-shrink-0" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path 
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              strokeWidth={2} 
                              d="M6 18L18 6M6 6l12 12" 
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {showNextButton && (
                <button
                  onClick={handleNextQuestion}
                  className="mt-6 sm:mt-8 w-full bg-blue-500 text-white py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg 
                    text-base sm:text-lg font-semibold hover:bg-blue-600 transition-colors duration-300"
                >
                  {currentQuestion === questions.length - 1 ? 'Finish Quiz' : 'Next Question'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center px-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4 sm:mb-6">Quiz Complete!</h2>
            <div className="mb-6 sm:mb-8">
              <div className="text-5xl sm:text-6xl font-bold text-blue-500 mb-2">
                {Math.round((score / questions.length) * 100)}%
              </div>
              <p className="text-lg sm:text-xl text-gray-600">
                You got {score} out of {questions.length} questions right
              </p>
            </div>
            <button
              onClick={resetQuiz}
              className="bg-blue-500 text-white py-2.5 sm:py-3 px-6 sm:px-8 rounded-lg text-base sm:text-lg 
                font-semibold hover:bg-blue-600 transition-colors duration-300"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
