import { useRef, useState } from 'react'
import { FiFileText, FiTrash2, FiUploadCloud } from 'react-icons/fi'
import { useBoundStore } from '@/store/useBoundStore'

function statusClassName(status) {
	if (status === 'indexed') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
	if (status === 'failed') return 'border-rose-200 bg-rose-50 text-rose-700'
	return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default function StudyMaterials() {
	const inputRef = useRef(null)
	const [dragActive, setDragActive] = useState(false)
	const {
		user,
		setDest,
		documents,
		isUploading,
		uploadError,
		uploadStudyMaterial,
		removeDocument,
		setActiveCoachFeature,
		coachTier,
	} = useBoundStore(state => state)

	async function handleFiles(files) {
		const file = files?.[0]
		if (!file) return
		if (!user) {
			setDest('coach')
			document.getElementById('authDialog')?.showModal()
			return
		}
		const data = await uploadStudyMaterial(file)
		if (data) {
			setActiveCoachFeature('generate')
			document.getElementById('coach-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
		}
	}

	return (
		<section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm md:p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<div>
					<p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Study Materials</p>
					<h2 className="text-xl font-semibold text-slate-900">Document questions</h2>
				</div>
				<span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-slate-600">{documents.length} files</span>
			</div>

			<p className={`mb-4 rounded-md border px-3 py-2 text-xs ${coachTier === 'full' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
				<strong>{coachTier === 'full' ? 'Full mode' : 'Lite mode'}</strong> — {coachTier === 'full' ? 'Advanced AI extracts key concepts and generates high-quality questions from your documents. Automatically retries with backup if needed.' : 'Lightweight local model generates questions from your documents. May produce simpler results.'}
			</p>

			<div
				onDragOver={event => {
					event.preventDefault()
					setDragActive(true)
				}}
				onDragLeave={() => setDragActive(false)}
				onDrop={event => {
					event.preventDefault()
					setDragActive(false)
					handleFiles(event.dataTransfer.files)
				}}
				className={`flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed px-4 text-center transition-colors ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'}`}
			>
				<FiUploadCloud className="text-3xl text-blue-600" />
				<p className="mt-2 text-sm font-semibold text-slate-800">{isUploading ? 'Uploading...' : 'Drop file or browse'}</p>
				<p className="mt-1 text-xs text-slate-500">PDF, TXT, MD</p>
				<input
					ref={inputRef}
					type="file"
					accept=".pdf,.txt,.md,text/plain,application/pdf"
					className="hidden"
					onChange={event => handleFiles(event.target.files)}
				/>
				<button
					type="button"
					onClick={() => inputRef.current?.click()}
					disabled={isUploading}
					className="mt-3 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<FiUploadCloud />
					<span>Browse</span>
				</button>
			</div>

			{uploadError ? (
				<p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{uploadError}</p>
			) : null}

			<ul className="mt-4 space-y-3">
				{documents.length > 0 ? documents.map(document => (
					<li key={document.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
						<div className="flex min-w-0 items-center gap-3">
							<FiFileText className="flex-shrink-0 text-slate-500" />
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-slate-900">{document.name}</p>
								<p className="text-xs text-slate-500">{new Date(document.uploadedAt).toLocaleString()}</p>
							</div>
						</div>
						<div className="flex flex-shrink-0 items-center gap-2">
							<span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClassName(document.status)}`}>{document.status}</span>
							<button
								type="button"
								onClick={() => removeDocument(document.id)}
								className="rounded-md p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
								aria-label="Delete document"
							>
								<FiTrash2 />
							</button>
						</div>
					</li>
				)) : (
					<li className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 text-center text-sm text-slate-500">
						No documents uploaded.
					</li>
				)}
			</ul>
		</section>
	)
}
