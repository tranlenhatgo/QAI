import Head from 'next/head'
import MainHome from '@/components/Home/MainHome'
import GameModes from '@/components/Home/GameModes'
import Categories from '@/components/Home/Categories'
import HomeHeader from '@/components/Home/HomeHeader'
import { useEffect } from 'react'

export default function Main () {
	useEffect(() => { window.onbeforeunload = () => null }, [])

	return (
		<>
			<Head>
				<title>Qao?</title>
			</Head>
			<MainHome />
			<GameModes />
			<Categories />
			<style jsx global>
				{`
				#__next {
					display: grid;
	        grid-template-columns: 1fr;
				}
        @media (min-width: 1024px) {
          #__next {
            grid-template-columns: 1.4fr 1fr;
          }
			  `}
			</style>
		</>
	)
}
