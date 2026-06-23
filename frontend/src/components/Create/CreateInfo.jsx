import { useState } from "react";
import { FiSettings, FiClock, FiGrid } from "react-icons/fi";
import categoriesJSON from '@/assets/categories.json';
import Image from "next/image";

const QuestionSidebar = ({ questions }) => {
	const [timeMode, setTimeMode] = useState(false);
	const [selectedTime, setSelectedTime] = useState(30);

	const [showInfo, setShowInfo] = useState(false);
	const [selectedCategories, setSelectedCategories] = useState([]);

	const handleCategoryToggle = (categoryId) => {
		setSelectedCategories(prev =>
			prev.includes(categoryId) ? [] : [categoryId]
		);
	};

	return (
		<>
			{/* Info Toggle Button */}
			<button
				title={showInfo ? "Hide settings" : "Show settings"}
				onClick={() => setShowInfo((prev) => !prev)}
				className="fixed bottom-4 left-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-md border-2 border-blue-100 bg-white text-slate-900 shadow-[0_3px_0_#dbeafe] transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none 2xl:hidden"
			>
				<FiSettings className="text-lg" />
			</button>

			{/* Sidebar */}
			<aside
				className={`fixed z-10 h-fit w-56 transition-all lg:bottom-4 left-4 md:top-1/2 md:-translate-y-1/2 text-center text-slate-900 font-medium 2xl:!scale-100 2xl:!opacity-100 2xl:!pointer-events-auto ${showInfo ? "bottom-14 scale-100 opacity-100 pointer-events-auto" : "bottom-0 scale-0 opacity-0 pointer-events-none"
					}`}
			>
				{/* Time Mode Toggle */}
				<fieldset className='rounded-md border-2 border-blue-100 bg-white p-3 text-center mb-2 shadow-[0_4px_0_#dbeafe]'>
					<div className='flex items-center justify-center gap-2 mb-2'>
						<FiClock className="text-blue-600" />
						<span className='text-sm font-bold text-slate-900'>Time Mode</span>
					</div>
					<div className="flex justify-center items-center gap-2">
						<button
							type="button"
							onClick={() => setTimeMode(prev => !prev)}
							className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
								timeMode
									? 'bg-blue-600 text-white shadow-[0_2px_0_#1d4ed8]'
									: 'bg-gray-100 text-slate-600 hover:bg-gray-200'
							}`}
						>
							{timeMode ? "Enabled" : "Disabled"}
						</button>
					</div>

					{/* Time Options */}
					{timeMode && (
						<div className='grid grid-cols-2 gap-1.5 mt-3'>
							{[10, 20, 30, 60].map(time => (
								<button
									key={time}
									type="button"
									onClick={() => setSelectedTime(time)}
									className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
										selectedTime === time
											? 'bg-blue-600 text-white shadow-[0_2px_0_#1d4ed8]'
											: 'border border-gray-200 bg-gray-50 text-slate-600 hover:bg-gray-100'
									}`}
								>
									{time}s
								</button>
							))}
						</div>
					)}
				</fieldset>

				{/* Categories Selection */}
				<div className='rounded-md border-2 border-blue-100 bg-white p-3 shadow-[0_4px_0_#dbeafe]'>
					<div className='flex items-center justify-center gap-2 mb-2'>
						<FiGrid className="text-blue-600" />
						<span className='text-sm font-bold text-slate-900'>Category</span>
					</div>
					<div className="grid grid-cols-2 gap-2 justify-items-center">
						{categoriesJSON.map(category => (
							<label key={category.id} className="relative cursor-pointer" title={category.name}>
								<input
									checked={selectedCategories.includes(category.id)}
									className="peer hidden"
									type="checkbox"
									onChange={() => handleCategoryToggle(category.id)}
								/>

								<Image
									className={`p-2 rounded-md transition-all w-full h-full peer-checked:scale-90 peer-checked:outline-2 peer-checked:outline-offset-2`}
									src={`/categories-icons/${category.name.toLowerCase()}.svg`}
									alt={category.name}
									width={40}
									height={40}
									style={{
										backgroundColor: selectedCategories.includes(category.id) ? category.color : 'transparent',
										filter: selectedCategories.includes(category.id) ? 'invert(0)' : 'invert(1)',
										borderRadius: '8px',
										outline: selectedCategories.includes(category.id) ? `2px solid ${category.color}` : 'none',
									}}
								/>
							</label>
						))}
					</div>
				</div>
			</aside>
		</>
	);
};

export default QuestionSidebar;
