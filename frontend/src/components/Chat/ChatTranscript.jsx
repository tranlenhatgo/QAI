import { useEffect, useRef } from 'react'
import { FiMessageCircle, FiSend, FiSquare, FiZap } from 'react-icons/fi'
import DOMPurify from 'dompurify'

export function renderMarkdown(text) {
	let html = String(text || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')

	html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
	html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
	html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
	html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
	html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

	return html
		.split('\n\n')
		.map(block => {
			const trimmed = block.trim()
			if (!trimmed) return ''
			if (/^<(h[1-3]|ul|ol|li)/.test(trimmed)) return trimmed
			return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`
		})
		.join('')
}

export function ChatMessageBubble({ role, content }) {
	const bubbleClassName = role === 'user'
		? 'rounded-br-md bg-gradient-to-r bg-sky-500 text-white'
		: role === 'error'
			? 'rounded-xl border border-rose-500/30 bg-rose-500/80 text-rose-200'
			: 'rounded-bl-md border border-white/10 bg-blue-700/80 text-slate-100'

	return (
		<div className={`flex ${role === 'user' ? 'justify-end' : role === 'error' ? 'justify-center' : 'justify-start'}`}>
			<div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${bubbleClassName}`}>
				{role === 'error' ? content : <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(content)) }} />}
			</div>
		</div>
	)
}

export default function ChatTranscript({
	messages,
	streamingText,
	draft,
	setDraft,
	onSend,
	onStop,
	isConnected,
	isStreaming,
	chatMode = 'simple',
	onChatModeChange,
	canSendWithoutSocket = true,
	messageListClassName = 'space-y-3',
	composerClassName = '',
	placeholder = 'Ask a question…',
	compact = false,
	emptyState = null,
}) {
	const endRef = useRef(null)
	const inputDisabled = isStreaming || (!isConnected && !canSendWithoutSocket)
	const sendDisabled = isStreaming || (!isConnected && !canSendWithoutSocket) || !draft.trim()
	const normalizedChatMode = chatMode === 'agentic' ? 'agentic' : 'simple'

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
	}, [messages, streamingText])

	return (
		<div className={`flex h-full min-h-0 flex-col ${compact ? 'gap-3' : 'gap-4'}`}>
			<div className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'px-0 py-0' : 'px-0 py-0'}`}>
				<div className={messageListClassName}>
					{messages.length === 0 && !streamingText && emptyState ? emptyState : null}
					{messages.map((message, index) => (
						<ChatMessageBubble key={`${message.id || message.role}-${index}`} role={message.role} content={message.content} />
					))}
					{isStreaming && streamingText ? <ChatMessageBubble role="assistant" content={streamingText} /> : null}
					<div ref={endRef} />
				</div>
			</div>

			<div className={composerClassName}>
				{onChatModeChange ? (
					<div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-blue-900/30 p-1">
						<button
							type="button"
							onClick={() => onChatModeChange('simple')}
							disabled={isStreaming}
							aria-pressed={normalizedChatMode === 'simple'}
							className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${normalizedChatMode === 'simple' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
						>
							<FiMessageCircle />
							<span>Chat</span>
						</button>
						<button
							type="button"
							onClick={() => onChatModeChange('agentic')}
							disabled={isStreaming}
							aria-pressed={normalizedChatMode === 'agentic'}
							className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${normalizedChatMode === 'agentic' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
						>
							<FiZap />
							<span>Agentic</span>
						</button>
					</div>
				) : null}
				<div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-blue-600/80 p-2 shadow-inner shadow-black/10">
					<textarea
						value={draft}
						onChange={event => setDraft(event.target.value)}
						onKeyDown={event => {
							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault()
								onSend(draft)
							}
						}}
						placeholder={inputDisabled && !isConnected ? 'Reconnecting…' : placeholder}
						disabled={inputDisabled}
						rows={1}
						className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-slate-300 disabled:cursor-not-allowed"
					/>
					{isStreaming && onStop ? (
						<button
							type="button"
							onClick={onStop}
							className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 text-white transition-transform duration-200 hover:scale-105"
							aria-label="Stop generating"
							title="Stop"
						>
							<FiSquare className="text-lg" />
						</button>
					) : (
						<button
							type="button"
							onClick={() => onSend(draft)}
							disabled={sendDisabled}
							className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
							aria-label="Send message"
						>
							<FiSend className="text-lg" />
						</button>
					)}
				</div>
				<p className="mt-2 text-center text-[11px] uppercase tracking-[0.24em] text-slate-500">Shift + Enter for a new line</p>
			</div>
		</div>
	)
}
