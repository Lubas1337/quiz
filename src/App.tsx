import {useState, useEffect} from 'react'
import mammoth from 'mammoth'
import './App.css'

type QuizMode = 'all' | 'partial' | null;
type Theme = 'light' | 'dark';

interface QuizQuestion {
    question: string;
    variants: string[];
    correctAnswers: string[];
    isMultiSelect: boolean;
}

const MINIMUM_QUESTIONS = 30;

const AVAILABLE_QUIZZES = [
    {id: 'fullstack', name: 'Fullstack', file: '/fullstack.docx'},
    {id: 'os rk2', name: 'OS RK2', file: '/osrk2.docx'},
    {id: 'os rk1', name: 'OS RK1', file: '/os_rk1.docx'},
    {id: 'philosophy', name: 'Philosophy', file: '/pshyc.docx'},
    {id: 'Webka', name: 'Web Dev', file: '/webka2.docx'},
    {id: 'ix', name: 'UI/UX', file: '/ix.docx'},
    {id: 'culturology', name: 'Culturology', file: '/culturology.docx'},
]

// Icons
const SunIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
)

const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
)

// Confetti
const Confetti = () => {
    const colors = ['#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
    const pieces = Array.from({length: 40}, (_, i) => ({
        id: i,
        color: colors[Math.floor(Math.random() * colors.length)],
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.3}s`,
        duration: `${2 + Math.random() * 1}s`,
        size: `${6 + Math.random() * 6}px`,
    }))

    return (
        <div className="confetti-container">
            {pieces.map((p) => (
                <div
                    key={p.id}
                    className="confetti"
                    style={{
                        left: p.left,
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                        animation: `confetti-fall ${p.duration} ease-out ${p.delay} forwards`,
                    }}
                />
            ))}
        </div>
    )
}

function App() {
    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [currentQuestion, setCurrentQuestion] = useState(0)
    const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
    const [score, setScore] = useState(0)
    const [showResult, setShowResult] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [showNextButton, setShowNextButton] = useState(false)
    const [totalAnswered, setTotalAnswered] = useState(0)
    const [canFinishEarly, setCanFinishEarly] = useState(false)
    const [quizMode, setQuizMode] = useState<QuizMode>(null)
    const [selectedQuizId, setSelectedQuizId] = useState<string>(AVAILABLE_QUIZZES[0].id)
    const [showConfetti, setShowConfetti] = useState(false)
    const [theme, setTheme] = useState<Theme>(() => {
        const saved = localStorage.getItem('quiz-theme')
        return (saved as Theme) || 'light'
    })

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark')
        localStorage.setItem('quiz-theme', theme)
    }, [theme])

    useEffect(() => {
        if (quizMode) {
            loadQuestions()
        }
    }, [quizMode])

    useEffect(() => {
        if (totalAnswered >= MINIMUM_QUESTIONS) {
            setCanFinishEarly(true)
        }
    }, [totalAnswered])

    const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

    const loadQuestions = async () => {
        try {
            setIsLoading(true)
            setError(null)

            const selectedQuiz = AVAILABLE_QUIZZES.find(q => q.id === selectedQuizId)
            if (!selectedQuiz) throw new Error('Quiz not found')

            const response = await fetch(selectedQuiz.file)
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

            const blob = await response.blob()
            const result = await mammoth.extractRawText({arrayBuffer: await blob.arrayBuffer()})
            let content = result.value
                .replace(/\n+/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/<\/variant>/g, '')
                .replace(/<\/variantright>/g, '')
                .replace(/<\/question>/g, '')
                .trim()

            if (!content) throw new Error('No content found')

            const parsed = content.split('<question>')
                .filter(Boolean)
                .map(q => {
                    const questionMatch = q.match(/(.*?)(?=<variant|<variantright)/)
                    if (!questionMatch) return null

                    const question = questionMatch[1].trim()
                    const variants: string[] = []
                    const rightAnswers: string[] = []

                    const variantMatches = q.match(/<variant>(.*?)(?=<variant|<variantright|$)/g) || []
                    variantMatches.forEach(v => {
                        const variant = v.replace(/<variant>/, '').trim()
                        if (variant) variants.push(variant)
                    })

                    const rightMatches = q.match(/<variantright>(.*?)(?=<variant|<variantright|$)/g) || []
                    rightMatches.forEach(r => {
                        const rightAnswer = r.replace(/<variantright>/, '').trim()
                        if (rightAnswer) {
                            rightAnswers.push(rightAnswer)
                            if (!variants.includes(rightAnswer)) variants.push(rightAnswer)
                        }
                    })

                    if (!question || rightAnswers.length === 0 || variants.length === 0) return null

                    return {
                        question,
                        variants: shuffleArray(variants),
                        correctAnswers: rightAnswers,
                        isMultiSelect: rightAnswers.length > 1
                    }
                })
                .filter((q): q is QuizQuestion => q !== null)

            if (parsed.length === 0) throw new Error('No valid questions found')

            const finalQuestions = quizMode === 'partial'
                ? shuffleArray(parsed).slice(0, MINIMUM_QUESTIONS)
                : shuffleArray(parsed)

            setQuestions(finalQuestions)
            setIsLoading(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load')
            setQuestions([])
            setIsLoading(false)
        }
    }

    const shuffleArray = <T,>(array: T[]): T[] => {
        const arr = [...array]
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
        }
        return arr
    }

    const handleAnswerClick = (variant: string) => {
        const currentQ = questions[currentQuestion]

        if (currentQ.isMultiSelect) {
            const newAnswers = [...selectedAnswers]
            if (newAnswers.includes(variant)) {
                newAnswers.splice(newAnswers.indexOf(variant), 1)
            } else {
                newAnswers.push(variant)
            }
            setSelectedAnswers(newAnswers)
        } else {
            setSelectedAnswers([variant])
            const isCorrect = currentQ.correctAnswers[0] === variant
            if (isCorrect) {
                setScore(s => s + 1)
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 2000)
            }
            setTotalAnswered(t => t + 1)
            setShowNextButton(true)
        }
    }

    const handleCheckMulti = () => {
        const currentQ = questions[currentQuestion]
        const isCorrect =
            currentQ.correctAnswers.length === selectedAnswers.length &&
            currentQ.correctAnswers.every(a => selectedAnswers.includes(a))

        if (isCorrect) {
            setScore(s => s + 1)
            setShowConfetti(true)
            setTimeout(() => setShowConfetti(false), 2000)
        }
        setShowNextButton(true)
        setTotalAnswered(t => t + 1)
    }

    const handleNext = () => {
        if (currentQuestion + 1 < questions.length) {
            setCurrentQuestion(c => c + 1)
            setSelectedAnswers([])
            setShowNextButton(false)
        } else {
            setShowResult(true)
        }
    }

    const resetQuiz = () => {
        setCurrentQuestion(0)
        setSelectedAnswers([])
        setScore(0)
        setShowResult(false)
        setShowNextButton(false)
        setTotalAnswered(0)
        setCanFinishEarly(false)
    }

    // Theme Toggle Button
    const ThemeToggle = () => (
        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? <MoonIcon/> : <SunIcon/>}
        </button>
    )

    // Quiz Selection Screen
    if (!quizMode) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center px-4">
                <ThemeToggle/>

                <div className="text-center mb-10 animate-in">
                    <h1 className="text-4xl sm:text-5xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>
                        Quiz
                    </h1>
                    <p style={{color: 'var(--text-muted)'}}>Test your knowledge</p>
                </div>

                <div className="w-full max-w-sm mb-8 animate-in delay-1" style={{opacity: 0}}>
                    <label className="block text-sm font-medium mb-2" style={{color: 'var(--text-secondary)'}}>
                        Choose topic
                    </label>
                    <select
                        value={selectedQuizId}
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                        className="select"
                    >
                        {AVAILABLE_QUIZZES.map(q => (
                            <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                    </select>
                </div>

                <div className="w-full max-w-sm space-y-4">
                    <button
                        onClick={() => setQuizMode('partial')}
                        className="mode-card w-full flex items-center gap-4 animate-in delay-2"
                        style={{opacity: 0}}
                    >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                             style={{background: 'var(--accent)', color: 'white'}}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className="font-semibold text-lg" style={{color: 'var(--text-primary)'}}>Quick Mode</div>
                            <div className="text-sm" style={{color: 'var(--text-muted)'}}>{MINIMUM_QUESTIONS} questions</div>
                        </div>
                    </button>

                    <button
                        onClick={() => setQuizMode('all')}
                        className="mode-card w-full flex items-center gap-4 animate-in delay-3"
                        style={{opacity: 0}}
                    >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                             style={{background: 'var(--success)', color: 'white'}}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                        </div>
                        <div className="text-left">
                            <div className="font-semibold text-lg" style={{color: 'var(--text-primary)'}}>Full Mode</div>
                            <div className="text-sm" style={{color: 'var(--text-muted)'}}>All questions</div>
                        </div>
                    </button>
                </div>
            </div>
        )
    }

    // Loading
    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <ThemeToggle/>
                <div className="loader mb-4"/>
                <p style={{color: 'var(--text-muted)'}}>Loading...</p>
            </div>
        )
    }

    // Error
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4">
                <ThemeToggle/>
                <div className="card p-8 text-center max-w-sm w-full">
                    <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
                         style={{background: 'var(--error-light)'}}>
                        <svg className="w-7 h-7" style={{color: 'var(--error)'}} fill="none" stroke="currentColor"
                             viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold mb-2" style={{color: 'var(--text-primary)'}}>Error</h2>
                    <p className="mb-6" style={{color: 'var(--text-muted)'}}>{error}</p>
                    <button onClick={loadQuestions} className="btn btn-primary w-full">
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <ThemeToggle/>
                <p style={{color: 'var(--text-muted)'}}>Loading...</p>
            </div>
        )
    }

    const currentQ = questions[currentQuestion]
    const progress = ((currentQuestion + 1) / questions.length) * 100

    // Quiz Screen
    return (
        <div className="min-h-screen py-4 px-4">
            <ThemeToggle/>
            {showConfetti && <Confetti/>}

            <div className="max-w-2xl mx-auto">
                {!showResult ? (
                    <div className="animate-in">
                        {/* Progress */}
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-medium" style={{color: 'var(--text-secondary)'}}>
                                    {currentQuestion + 1} / {questions.length}
                                </span>
                                <span className="text-sm" style={{color: 'var(--text-muted)'}}>
                                    Score: {score}
                                </span>
                            </div>
                            <div className="progress-track">
                                <div className="progress-fill" style={{width: `${progress}%`}}/>
                            </div>
                        </div>

                        {/* Question Card */}
                        <div className="card p-6 sm:p-8 mb-6">
                            <div className="flex justify-between items-start gap-4 mb-6">
                                <h2 className="text-lg sm:text-xl font-medium leading-relaxed"
                                    style={{color: 'var(--text-primary)'}}>
                                    {currentQ.question}
                                </h2>
                                <button
                                    onClick={() => setShowResult(true)}
                                    className="text-sm px-3 py-1.5 rounded-lg flex-shrink-0"
                                    style={{
                                        color: 'var(--error)',
                                        background: 'var(--error-light)',
                                    }}
                                >
                                    End
                                </button>
                            </div>

                            {currentQ.isMultiSelect && (
                                <div className="inline-block px-3 py-1 rounded-full text-sm mb-4"
                                     style={{background: 'var(--accent-light)', color: 'var(--accent)'}}>
                                    Select multiple
                                </div>
                            )}

                            {/* Options */}
                            <div className="space-y-3">
                                {currentQ.variants.map((variant, i) => {
                                    const isSelected = selectedAnswers.includes(variant)
                                    const isCorrect = currentQ.correctAnswers.includes(variant)
                                    const showResult = showNextButton

                                    let className = 'option'
                                    if (showResult) {
                                        if (isCorrect) className += ' correct'
                                        else if (isSelected) className += ' incorrect animate-shake'
                                    } else if (isSelected) {
                                        className += ' selected'
                                    }

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => !showNextButton && handleAnswerClick(variant)}
                                            disabled={showNextButton}
                                            className={className}
                                            style={{
                                                animationDelay: `${i * 0.05}s`,
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`w-5 h-5 flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                                                        currentQ.isMultiSelect ? 'rounded' : 'rounded-full'
                                                    }`}
                                                    style={{
                                                        borderColor: showResult
                                                            ? isCorrect ? 'var(--success)' : isSelected ? 'var(--error)' : 'var(--border-color)'
                                                            : isSelected ? 'var(--accent)' : 'var(--border-color)',
                                                        background: (isSelected || (showResult && isCorrect))
                                                            ? showResult
                                                                ? isCorrect ? 'var(--success)' : 'var(--error)'
                                                                : 'var(--accent)'
                                                            : 'transparent',
                                                    }}
                                                >
                                                    {(isSelected || (showResult && isCorrect)) && (
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
                                                        </svg>
                                                    )}
                                                </div>
                                                <span style={{
                                                    color: showResult && isCorrect ? 'var(--success)'
                                                        : showResult && isSelected && !isCorrect ? 'var(--error)'
                                                            : 'var(--text-primary)'
                                                }}>
                                                    {variant}
                                                </span>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        {currentQ.isMultiSelect && selectedAnswers.length > 0 && !showNextButton && (
                            <button onClick={handleCheckMulti} className="btn btn-primary w-full animate-pop">
                                Check Answer
                            </button>
                        )}

                        {showNextButton && (
                            <button onClick={handleNext} className="btn btn-primary w-full animate-pop">
                                {currentQuestion === questions.length - 1 ? 'See Results' : 'Next'}
                            </button>
                        )}
                    </div>
                ) : (
                    // Results
                    <div className="text-center animate-in">
                        <div className="card p-8 sm:p-10">
                            <h2 className="text-2xl font-bold mb-2" style={{color: 'var(--text-primary)'}}>
                                Complete!
                            </h2>
                            <p className="mb-8" style={{color: 'var(--text-muted)'}}>Here's how you did</p>

                            {/* Score Ring */}
                            <div className="relative w-40 h-40 mx-auto mb-8">
                                <svg className="w-full h-full score-ring" viewBox="0 0 120 120">
                                    <circle className="score-ring-bg" cx="60" cy="60" r="52" strokeWidth="10"/>
                                    <circle
                                        className="score-ring-fill"
                                        cx="60" cy="60" r="52" strokeWidth="10"
                                        strokeDasharray={`${(score / totalAnswered) * 327} 327`}
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-4xl font-bold animate-pop" style={{color: 'var(--accent)'}}>
                                        {Math.round((score / totalAnswered) * 100)}%
                                    </span>
                                </div>
                            </div>

                            <p className="text-lg mb-2" style={{color: 'var(--text-primary)'}}>
                                <span className="font-bold" style={{color: 'var(--accent)'}}>{score}</span> out of {totalAnswered} correct
                            </p>

                            <div className="p-4 rounded-xl mb-8" style={{
                                background: score / totalAnswered >= 0.7 ? 'var(--success-light)' : 'var(--accent-light)',
                                color: score / totalAnswered >= 0.7 ? 'var(--success)' : 'var(--accent)'
                            }}>
                                {score / totalAnswered >= 0.8 ? 'Excellent!' :
                                    score / totalAnswered >= 0.6 ? 'Good job!' : 'Keep practicing!'}
                            </div>

                            <button
                                onClick={() => {
                                    setQuizMode(null)
                                    resetQuiz()
                                }}
                                className="btn btn-primary"
                            >
                                Play Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default App
