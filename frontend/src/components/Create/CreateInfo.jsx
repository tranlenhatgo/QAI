import { useState } from "react";
import { IoMdSave } from "react-icons/io";
import categoriesJSON from '@/assets/categories.json';
import Image from "next/image";
import { useBoundStore } from '@/store/useBoundStore';

const QuestionSidebar = () => {
	const { saveQuestions, update, updateQuizQuestions } = useBoundStore(state => state);
	const [timeMode, setTimeMode] = useState(false);
	const [selectedTime, setSelectedTime] = useState(30);
	const [selectedCategories, setSelectedCategories] = useState([]);

	const handleCategoryToggle = (categoryId) => {
		setSelectedCategories(prev =>
			prev.includes(categoryId)
				? prev.filter(id => id !== categoryId)
				: [...prev, categoryId]
		);
	};

	const handleSave = () => {
		if (update) {
			updateQuizQuestions();
		} else {
			saveQuestions();
		}
	};

	return (
		<>
			{/* Sidebar - Sticky on desktop */}
			<aside className="bg-white rounded-lg shadow-md p-4 space-y-4 xl:sticky xl:top-6 h-fit">
				{/* Save Button */}
				<button
					onClick={handleSave}
					className="w-full btn-primary flex items-center justify-center space-x-2 text-lg py-3"
				>
					<IoMdSave className="text-xl" />
					<span>Save Quiz</span>
				</button>

				{/* Time Mode Toggle */}
				<fieldset className='border rounded-md p-3 text-center'>
					<div className='text-lg font-semibold mb-2 text-slate-900'>Time Mode</div>
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
				<div className='bg-white p-2 rounded-md grid grid-cols-4 gap-2 justify-items-center flex-1'>
					{categoriesJSON.map(category => (
						<label key={category.id} className="relative cursor-pointer w-full h-full" title={category.name}>
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
