import { useEffect, useMemo, useState } from 'react'
import { FiChevronDown, FiChevronUp, FiMessageSquare, FiTrash2 } from 'react-icons/fi'
import ChatTranscript from '@/components/Chat/ChatTranscript'
import { useBoundStore } from '@/store/useBoundStore'

export default function EmbeddedChat() {
	const [collapsed, setCollapsed] = useState(false)
	const {
		chatReady,
		hydrateChat,
		setChatConfig,
		setChatSessionActive,
		connectChat,
		disconnectChat,
		ensureConversation,
		setChatMode,
		sendChatMessage,
		stopStreaming,
		setDraft,
		chatConfig,
		user,
		isConnected,
		isStreaming,
		draft,
		streamingText,
		conversations,
		activeConversationId,
		coachTier,
		clearAllConversations,
	} = useBoundStore(state => state)

	useEffect(() => {
		if (!chatReady) hydrateChat()
			setChatConfig({
				userId: user?.uid ?? 'anonymous',
				serverUrl: chatConfig.serverUrl,
				transport: 'websocket',
				tier: coachTier,
				hiddenPaths: ['/', '/chat', '/play', '/coach'],
			})
		setChatSessionActive(true)
		ensureConversation()
		connectChat()

		return () => {
			setChatSessionActive(false)
			disconnectChat()
		}
	}, [chatReady, hydrateChat, setChatConfig, user?.uid, chatConfig.serverUrl, coachTier, setChatSessionActive, ensureConversation, connectChat, disconnectChat])

	const activeConversation = useMemo(
		() => conversations.find(conversation => conversation.id === activeConversationId) || null,
		[conversations, activeConversationId],
	)
	const messages = activeConversation?.messages || []
	const isWebhookMode = (chatConfig?.transport || 'webhook') === 'webhook'
	const chatMode = chatConfig?.chatMode === 'agentic' ? 'agentic' : 'simple'
	const tierLabel = coachTier === 'lite' ? 'Lite tier' : 'Full tier'
	const modeLabel = chatMode === 'agentic' ? 'agentic mode' : 'chat mode'

	return (
		<section className="rounded-lg border border-gray-200 bg-white shadow-sm">
			<div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
				<div className="flex items-center gap-3">
					<span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
					<div>
						<p className="text-sm font-semibold text-slate-900">AI Study Coach</p>
						<p className="text-xs text-slate-500">{isStreaming ? 'Thinking...' : `${tierLabel}, ${modeLabel}`}</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => { if (window.confirm('Delete all chat history?')) clearAllConversations() }}
						className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
						title="Delete all chat history"
					>
						<FiTrash2 />
					</button>
					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-gray-50"
					>
						<FiMessageSquare />
						{collapsed ? <FiChevronUp /> : <FiChevronDown />}
					</button>
				</div>
			</div>

			{!collapsed ? (
				<div className="h-[32rem] min-h-0 bg-slate-900 px-4 py-4">
					<p className={`mb-3 rounded-md border px-3 py-2 text-xs ${coachTier === 'full' ? 'border-indigo-300/30 bg-indigo-500/10 text-indigo-300' : 'border-amber-300/30 bg-amber-500/10 text-amber-300'}`}>
						<strong>{coachTier === 'full' ? 'Full mode' : 'Lite mode'}</strong> — {coachTier === 'full' ? 'Smart coach with full capabilities: analyzes your quiz history, gives personalized recommendations, performs deep reasoning, searches the web, and references your study materials.' : 'Basic coach with limited capabilities: can review your quiz history and give recommendations.'}
					</p>
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
						placeholder="Message AI Study Coach..."
						compact={true}
						emptyState={(
							<div className="flex h-full min-h-[16rem] items-center justify-center rounded-md border border-dashed border-white/10 bg-white/5 px-4 text-center text-sm text-slate-400">
								No messages yet.
							</div>
						)}
					/>
				</div>
			) : null}
		</section>
	)
}
