import { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/router'
import { FiExternalLink, FiTrash2, FiX } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'
import ChatTranscript from './ChatTranscript'

export default function StudyCoachWidget() {
	const router = useRouter()
	const [widgetHeight, setWidgetHeight] = useState(null)
	const resizingRef = useRef(false)
	const startYRef = useRef(0)
	const startHeightRef = useRef(0)
	const containerRef = useRef(null)
	const {
		chatReady,
		hydrateChat,
		chatConfig,
		isOpen,
		isConnected,
		isStreaming,
		draft,
		setDraft,
		setChatMode,
		closeChat,
		sendChatMessage,
		stopStreaming,
		conversations,
		activeConversationId,
		streamingText,
		clearAllConversations,
	} = useBoundStore(state => state)

	useEffect(() => {
		if (!chatReady) {
			hydrateChat()
		}
	}, [chatReady, hydrateChat])

	const handleResizeStart = useCallback((e) => {
		e.preventDefault()
		resizingRef.current = true
		startYRef.current = e.clientY || e.touches?.[0]?.clientY
		startHeightRef.current = containerRef.current?.offsetHeight || 400
		document.body.style.userSelect = 'none'
	}, [])

	useEffect(() => {
		function handleMove(e) {
			if (!resizingRef.current) return
			const clientY = e.clientY || e.touches?.[0]?.clientY
			const delta = startYRef.current - clientY
			const newHeight = Math.min(Math.max(startHeightRef.current + delta, 250), window.innerHeight - 100)
			setWidgetHeight(newHeight)
		}
		function handleEnd() {
			if (!resizingRef.current) return
			resizingRef.current = false
			document.body.style.userSelect = ''
		}
		window.addEventListener('mousemove', handleMove)
		window.addEventListener('mouseup', handleEnd)
		window.addEventListener('touchmove', handleMove)
		window.addEventListener('touchend', handleEnd)
		return () => {
			window.removeEventListener('mousemove', handleMove)
			window.removeEventListener('mouseup', handleEnd)
			window.removeEventListener('touchmove', handleMove)
			window.removeEventListener('touchend', handleEnd)
		}
	}, [])

	const isHidden = chatConfig.hiddenPaths?.some(path => router.pathname === path)
	const isWebhookMode = (chatConfig?.transport || 'webhook') === 'webhook'
	const chatMode = chatConfig?.chatMode === 'agentic' ? 'agentic' : 'simple'
	const statusText = isConnected
		? (isStreaming ? 'Thinking...' : (chatMode === 'agentic' ? 'Agentic mode' : 'Chat mode'))
		: 'Reconnecting...'
	const activeConversation = useMemo(
		() => conversations.find(conversation => conversation.id === activeConversationId) || null,
		[conversations, activeConversationId],
	)
	const messages = activeConversation?.messages || []

	if (isHidden) return null

	return (
		<div
			ref={containerRef}
			style={widgetHeight ? { height: `${widgetHeight}px` } : undefined}
			className={`fixed bottom-16 right-4 z-[60] origin-bottom-right w-[min(24rem,calc(100vw-1.5rem))] flex flex-col overflow-hidden rounded-[1.5rem] border border-blue-700/50 bg-slate-200 text-slate-100 shadow-[0_28px_80px_rgba(15,23,42,0.5)] transition-all duration-300 md:right-6 ${!widgetHeight ? 'h-[min(32rem,calc(100vh-11rem))]' : ''} ${isOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-95 opacity-0'
				}`}
		>
			{/* Resize handle */}
			<div
				onMouseDown={handleResizeStart}
				onTouchStart={handleResizeStart}
				className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10 flex items-center justify-center hover:bg-blue-500/20 transition-colors"
			>
				<div className="w-10 h-1 rounded-full bg-white/30" />
			</div>
			<div className="flex items-center justify-between border-b border-blue-700/40 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
				<div className="flex items-center gap-3">
					<span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.7)]' : 'bg-amber-400'}`} />
					<div>
						<p className="text-sm font-semibold tracking-wide text-white">AI Study Coach</p>
						<p className="text-xs text-slate-400">{statusText}</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => { if (window.confirm('Delete all chat history?')) clearAllConversations() }}
						className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-red-400"
						title="Delete all chat history"
					>
						<FiTrash2 />
					</button>
					<button
						type="button"
						onClick={() => router.push('/chat')}
						className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
						title="Open full chat"
					>
						<FiExternalLink />
					</button>
					<button
						type="button"
						onClick={closeChat}
						className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
						aria-label="Close study coach chat"
					>
						<FiX />
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4">
				<ChatTranscript
					messages={messages}
					streamingText={streamingText}
					draft={draft}
					setDraft={setDraft}
					onSend={sendChatMessage}
					onStop={stopStreaming}
					isConnected={isConnected}
					isStreaming={isStreaming}
					chatMode={chatMode}
					onChatModeChange={setChatMode}
					canSendWithoutSocket={isWebhookMode}
					messageListClassName="space-y-3"
					composerClassName="mt-4"
					placeholder="Ask a question…"
					compact={true}
				/>
			</div>
		</div>
	)
}
