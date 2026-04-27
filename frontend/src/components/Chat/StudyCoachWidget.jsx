import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { FiExternalLink, FiX } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'
import ChatTranscript from './ChatTranscript'

export default function StudyCoachWidget() {
	const router = useRouter()
	const {
		chatReady,
		hydrateChat,
		chatConfig,
		isOpen,
		isConnected,
		isStreaming,
		draft,
		setDraft,
		closeChat,
		sendChatMessage,
		conversations,
		activeConversationId,
		streamingText,
	} = useBoundStore(state => state)

	useEffect(() => {
		if (!chatReady) {
			hydrateChat()
		}
	}, [chatReady, hydrateChat])

	const isHidden = chatConfig.hiddenPaths?.some(path => router.pathname === path)
	const isWebhookMode = (chatConfig?.transport || 'webhook') === 'webhook'
	const statusText = isConnected
		? (isStreaming ? 'Thinking...' : (isWebhookMode ? 'Webhook API mode' : 'Connected'))
		: 'Reconnecting...'
	const activeConversation = useMemo(
		() => conversations.find(conversation => conversation.id === activeConversationId) || null,
		[conversations, activeConversationId],
	)
	const messages = activeConversation?.messages || []

	if (isHidden) return null

	return (
		<div
			className={`fixed bottom-16 right-4 z-[60] origin-bottom-right w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950 text-slate-100 shadow-[0_28px_80px_rgba(15,23,42,0.5)] transition-all duration-300 md:right-6 ${
				isOpen ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-3 scale-95 opacity-0'
			}`}
		>
				<div className="flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-950 px-4 py-3">
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

				<div className="max-h-[min(32rem,calc(100vh-11rem))] overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_35%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(15,23,42,0.99))] px-4 py-4">
					<ChatTranscript
						messages={messages}
						streamingText={streamingText}
						draft={draft}
						setDraft={setDraft}
						onSend={sendChatMessage}
						isConnected={isConnected}
						isStreaming={isStreaming}
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