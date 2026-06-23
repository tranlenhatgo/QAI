import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

import PageLoading from '@/components/PageLoading'
import PageError from '@/components/PageError'
import PlayHeader from '@/components/Play/PlayHeader'
import PlayBackground from '@/components/Play/PlayBackground'
import GameInfo from '@/components/Play/GameInfo'
import Footer from '@/components/PageFooter'
import Questions from '@/components/Questions/Questions'

import { FaTrophy } from 'react-icons/fa'

import queryValidator from '@/helpers/gameConfig'
import categories from '@/assets/categories.json'
import { useBoundStore } from '@/store/useBoundStore'

const BG_EFFECTS_KEY = 'play-bg-effects'
const DEFAULT_EFFECTS = { gradient: true, pattern: true, shimmer: true, particles: true }

function loadEffects() {
	if (typeof window === 'undefined') return DEFAULT_EFFECTS
	try {
		const raw = localStorage.getItem(BG_EFFECTS_KEY)
		if (raw) return { ...DEFAULT_EFFECTS, ...JSON.parse(raw) }
	} catch { /* ignore */ }
	return DEFAULT_EFFECTS
}

function saveEffects(effects) {
	try { localStorage.setItem(BG_EFFECTS_KEY, JSON.stringify(effects)) } catch { /* ignore */ }
}

export default function Play() {
	const { loading, error, getQuestions, startAdaptiveInfinity, setQueries, queries, questions, authReady, coachTier, win } = useBoundStore(state => state)
	const router = useRouter()

	const [bgEffects, setBgEffects] = useState(DEFAULT_EFFECTS)

	// Hydrate from localStorage after mount
	useEffect(() => { setBgEffects(loadEffects()) }, [])

	const toggleEffect = useCallback((key) => {
		setBgEffects(prev => {
			const next = { ...prev, [key]: !prev[key] }
			saveEffects(next)
			return next
		})
	}, [])

	const toggleAll = useCallback(() => {
		setBgEffects(prev => {
			const anyOn = Object.values(prev).some(Boolean)
			const next = { gradient: !anyOn, pattern: !anyOn, shimmer: !anyOn, particles: !anyOn }
			saveEffects(next)
			return next
		})
	}, [])

	useEffect(() => {
		if (router.isReady && !queries.quizmode) {
			const validQuery = queryValidator(router.query, { tier: coachTier })
			if (validQuery.infinitymode && !authReady) return
			const cate = validQuery.categories.map(cat => categories.find(c => c.id === cat).name)
			setQueries(validQuery)
			if (validQuery.infinitymode) startAdaptiveInfinity(validQuery.categories)
			else getQuestions(cate, validQuery.questions)
		}
	}, [router.isReady, authReady, coachTier])

	useEffect(() => { window.onbeforeunload = () => 'Are you sure you want to leave?' }, [])

	return (
		<>
			<Head><title>QAI | Play</title></Head>
			<PageLoading visible={loading} />
			{error[0] && <PageError />}
			{!loading && !error[0] && <>
				<PlayBackground effects={bgEffects} />
				<PlayHeader bgEffects={bgEffects} onToggleEffect={toggleEffect} onToggleAll={toggleAll} />
				<GameInfo />
				{win !== undefined && (
					<button
						onClick={() => {
							const dialog = document.getElementById('gameoverdialog')
							const bg = document.getElementById('gameoverbg')
							if (dialog) {
								try {
									if (typeof dialog.showModal === 'function') {
										dialog.showModal()
									} else {
										dialog.setAttribute('open', 'true')
									}
								} catch (e) {
									dialog.setAttribute('open', 'true')
								}
							}
							if (bg) {
								bg.style.display = 'block'
							}
						}}
						className="fixed top-4 right-4 z-20 flex items-center justify-center gap-2 px-4 py-2.5 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:scale-110 active:scale-95 text-slate-900 border border-slate-100 hover:text-blue-500 font-semibold text-sm"
						title="Show GameOver Screen"
					>
						<FaTrophy className="text-yellow-500 text-base" />
						<span>GameOver Summary</span>
					</button>
				)}
				<Questions />
				<Footer alert={true} />

				<style jsx global>
					{`
					body {
						background: url(play_bg.webp) center;
						background-size: 100% 100%;
					}

					@media (max-width: 1030px) {
						body {
							background-size: auto 100%;
						}
					}
				`}
				</style>
			</>
			}
		</>
	)
}
