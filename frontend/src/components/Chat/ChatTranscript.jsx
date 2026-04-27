import { useEffect, useRef } from 'react'
import { FiSend } from 'react-icons/fi'

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
		? 'rounded-br-md bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950'
		: role === 'error'
			? 'rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200'
			: 'rounded-bl-md border border-white/10 bg-slate-800/90 text-slate-100'

	return (
		<div className={`flex ${role === 'user' ? 'justify-end' : role === 'error' ? 'justify-center' : 'justify-start'}`}>
			<div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${bubbleClassName}`}>
				{role === 'error' ? content : <span dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />}
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
	isConnected,
	isStreaming,
	canSendWithoutSocket = true,
	messageListClassName = 'space-y-3',
	composerClassName = '',
	placeholder = 'Ask a question…',
	compact = false,
}) {
	const endRef = useRef(null)
	const inputDisabled = isStreaming || (!isConnected && !canSendWithoutSocket)
	const sendDisabled = isStreaming || (!isConnected && !canSendWithoutSocket) || !draft.trim()

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
	}, [messages, streamingText])

	return (
		<div className={`flex h-full min-h-0 flex-col ${compact ? 'gap-3' : 'gap-4'}`}>
			<div className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'px-0 py-0' : 'px-0 py-0'}`}>
				<div className={messageListClassName}>
					{messages.map((message, index) => (
						<ChatMessageBubble key={`${message.id || message.role}-${index}`} role={message.role} content={message.content} />
					))}
					{isStreaming && streamingText ? <ChatMessageBubble role="assistant" content={streamingText} /> : null}
					<div ref={endRef} />
				</div>
			</div>

			<div className={composerClassName}>
				<div className="flex items-end gap-3 rounded-2xl border border-white/10 bg-slate-900/80 p-2 shadow-inner shadow-black/10">
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
						className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
					/>
					<button
						type="button"
						onClick={() => onSend(draft)}
						disabled={sendDisabled}
						className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white transition-transform duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
						aria-label="Send message"
					>
						<FiSend className="text-lg" />
					</button>
				</div>
				<p className="mt-2 text-center text-[11px] uppercase tracking-[0.24em] text-slate-500">Shift + Enter for a new line</p>
			</div>
		</div>
	)
}