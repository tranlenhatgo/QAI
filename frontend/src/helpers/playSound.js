const audioCache = new Map()
const lastPlayedAt = new Map()
const MIN_INTERVAL_MS = 80

export default function playSound(sound, volume = 0.25) {
	if (typeof window === 'undefined' || localStorage.getItem('sound') !== 'true') return

	const now = performance.now()
	const previous = lastPlayedAt.get(sound) || 0
	if (now - previous < MIN_INTERVAL_MS) return
	lastPlayedAt.set(sound, now)

	let audio = audioCache.get(sound)
	if (!audio) {
		audio = new Audio(`/sounds/${sound}.mp3`)
		audio.preload = 'auto'
		audioCache.set(sound, audio)
	}

	audio.volume = volume
	audio.currentTime = 0
	audio.play().catch(() => {})
}
