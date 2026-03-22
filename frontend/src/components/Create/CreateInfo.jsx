import { useState } from "react";
import { AiFillInfoCircle } from "react-icons/ai";
import categoriesJSON from '@/assets/categories.json';
import Image from "next/image";
import playSound from '@/helpers/playSound'

const QuestionSidebar = ({ questions }) => {
	const [timeMode, setTimeMode] = useState(false);
	const [selectedTime, setSelectedTime] = useState(30);

	const [mode, setMode] = useState('');
	const [showInfo, setShowInfo] = useState(false);
	const [selectedCategories, setSelectedCategories] = useState([]);

	const handleCategoryToggle = (categoryId) => {
		setSelectedCategories(prev =>
			prev.includes(categoryId)
				? prev.filter(id => id !== categoryId)
				: [...prev, categoryId]
		);
	};

	return (
		<>
			{/* Info Toggle Button */}
			<button
				title={showInfo ? "Hide info" : "Show info"}
				onClick={() => setShowInfo((prev) => !prev)}
				className="fixed bottom-4 left-4 2xl:hidden bg-white z-20 rounded-md p-1"
			>
				<AiFillInfoCircle className="text-[28px] text-slate-900" />
			</button>

			{/* Sidebar */}
			<aside
				className={`fixed w-55 h-fit transition-all z-10 shadow-lg lg:bottom-4 left-4 md:top-1/2 md:-translate-y-1/2 text-center text-slate-900 font-medium 2xl:!scale-100 2xl:!opacity-100 ${showInfo ? "bottom-12 scale-100 opacity-100" : "bottom-0 scale-20 opacity-0"
					}`}
			>
				{/* Time Mode Toggle */}
				<fieldset className='bg-white p-2 rounded-md text-center mb-2'>
					<div className='text-lg font-semibold mb-1'>Time Mode</div>
					<div className="flex justify-center items-center gap-2">
						<input
							id="timeModeToggle"
							type="checkbox"
							checked={timeMode}
							onChange={() => setTimeMode(prev => !prev)}
							className="w-5 h-5 cursor-pointer"
						/>
						<label htmlFor="timeModeToggle" className="cursor-pointer">
							{timeMode ? "Enabled" : "Disabled"}
						</label>
					</div>

					{/* Time Options */}
					{timeMode && (
						<div className='grid grid-cols-2 gap-1 justify-center mt-2'>
							{[10, 20, 30, 60].map(time => (
								<label key={time} className="cursor-pointer mb-1">
									<input
										className="peer hidden"
										type="radio"
										name="time"
										value={time}
										checked={selectedTime === time}
										onChange={() => setSelectedTime(time)}
									/>
									<span className="peer-checked:bg-blue-500 peer-checked:text-white px-3 py-1 rounded bg-gray-200 text-center transition-all">
										{time}s
									</span>
								</label>
							))}
						</div>
					)}
				</fieldset>

				{/* Categories Selection */}
				<div className='bg-white p-2 rounded-md grid grid-cols-2 gap-2 justify-items-center'>
					{categoriesJSON.map(category => (
						<label key={category.id} className="relative cursor-pointer" title={category.name}>
							<input
								checked={selectedCategories.includes(category.id)}
								className="peer hidden"
								type="checkbox"
								onChange={() => handleCategoryToggle(category.id)}
							/>

							<Image
								className={`p-2 rounded transition-all w-full h-full peer-checked:scale-90 peer-checked:outline-2 peer-checked:outline-offset-2`}
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
			</aside>

			{/* Background Style */}
			<style jsx global>
				{`
          #__next {
            background: linear-gradient(0deg, rgb(0 0 0 / 10%) 0%, rgba(255, 255, 255, 0.05) 100%);
          }
        `}
			</style>
		</>
	);
};

export default QuestionSidebar;
