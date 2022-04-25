const MAP_SIZE = 500
const NU_CENTER = ol.proj.fromLonLat([-87.6753, 42.056])

// downtown center, uncomment to use downtown instead, or make your own
// const NU_CENTER = ol.proj.fromLonLat([-87.6813, 42.049])
const AUTOMOVE_SPEED = 1
const UPDATE_RATE = 100
/*
 Apps are made out of a header (title/controls) and footer
 and some number of columns
 If its vertical, the columns can become sections in one column
 */


let landmarkCount = 0

let gameState = {
	pokemonEncounter: false,
	pokemonCaught: [],
	inventory: {'Great Balls': 0, 'Ultra Balls': 0},
	landmarksVisited: [],
	messages: []
}

// Create an interactive map
// Change any of these functions
let map = new InteractiveMap({
	mapCenter: NU_CENTER,

	// Ranges
	ranges: [60, 40, 20, 1], // must be in reverse order

	async initializeMap() {
		this.loadLandmarks("landmarks-natural-nu", (landmark) => {
			return true
		})

		// Pokemon Landmarks
		for (var i = 0; i < 20; i++) {
			let position = clonePolarOffset(NU_CENTER, 400*Math.random() + 300, 20*Math.random())
			let pokemon = await getPokemon()
			this.createLandmark({
				pos: position,
				pokemon: pokemon,
				name: pokemon.name,
			})
		}
	},

	update() {
		// Do something each frame
	},

	initializeLandmark: (landmark, isPlayer) => {
		// Add data to any landmark when it's created

		// Any openmap data?
		if (landmark.openMapData) {
			// console.log(landmark.openMapData)
			landmark.name = landmark.openMapData.name || words.getRandomWord()
			landmark.color = Math.round(Math.random()*360)
		}
		
		if (landmark.pokemon) {
		}
		
		landmark.id = landmarkCount++
		return landmark
	}, 

	onEnterRange: (landmark, newLevel, oldLevel, dist) => {
		console.log(`Entered ${landmark.name}: ${oldLevel} => ${newLevel}`)
		if (newLevel == 2 && landmark.pokemon) {
			// Encounter a pokemon
			beginEncounter(landmark)
		}

		if (newLevel == 2 && !landmark.pokemon && !gameState.landmarksVisited.includes(landmark.name)) {
			gameState.landmarksVisited.push(landmark.name)
			// Get some loot
			getLoot(landmark)
		}
	},

	onExitRange: (landmark, newLevel, oldLevel, dist) => {
		console.log(`Exited ${landmark.name}: ${oldLevel} => ${newLevel}`)

		if (gameState.pokemonEncounter && landmark == gameState.pokemonEncounter.landmark) {
			endEncounter("ran")
		}

	},
	
	
	featureToStyle: (landmark) => {
		if (landmark.isPlayer) {
			return {
				icon: "person_pin_circle",
				noBG: true 
			}
		}

		if (landmark.pokemon) {
			return {
				icon: landmark.pokemon.sprite,
				noBG: true,
				iconColor: "#00000000"
			}
		}
		
		return {
			label: landmark.name + "\n" + landmark.distanceToPlayer +"m",
			fontSize: 8,
			icon: "person_pin_circle",
			iconColor: [217, .73, .96],
			noBG: true 
		}
	},

	
})



window.onload = (event) => {
	const app = new Vue({
		template: `
		<div id="app">
		<header></header>
			<div id="main-columns">
				<div class="main-column" style="flex:1;">
					<div id="messages" class="main-column" style="flex:1;overflow:scroll;max-height:200px;flex-direction: column-reverse;">
						<div v-for="message in gameState.messages">
							{{message}}
						</div>
					</div>

					<div style="display: flex; flex-wrap: wrap">
						<h3 style="position: absolute;">Pokemon Caught:</h3>
						<div v-for="pkmn in gameState.pokemonCaught">
							<img :src="pkmn.sprite" />
						</div>
					</div>
				</div>

				<div id="mapDiv" class="main-column" style="overflow:hidden;width:${MAP_SIZE}px;height:${MAP_SIZE}px; display:flex; align-items: center;">
					<location-widget :map="map" />
					<p>Great Balls: {{gameState.inventory['Great Balls']}}</p>
					<p>Ultra Balls: {{gameState.inventory['Ultra Balls']}}</p>
					<div v-if="gameState.pokemonEncounter" style="display:flex; align-items: center; flex-flow: wrap;">
						<button @click="throwBait()">Throw Bait</button>
						<button @click="throwMud()">Throw Mud</button> 
						<button @click="throwBall()">Throw Pokeball</button>
						<button @click="throwBall('Great Ball')">Throw Great Ball</button>
						<button @click="throwBall('Ultra Ball')">Throw Ultra Ball</button>	
					</div>
				</div>

			</div>	
		<footer></footer>
		</div>`,

		data: {
			map: map,
			gameState: gameState
		},

		methods: {
			throwBait,
			throwBall,
			throwMud,
		},
		
		components: Object.assign({
			"location-widget": locationWidget,
		}),

		el: "#app"
	})

};







function logMsg(msg) {
	gameState.messages.push(msg)
	var element = document.getElementById("messages");
	setTimeout(() => { element.scrollTop = element.scrollHeight + element.clientHeight }, 10) 
}



async function getPokemon() {
	let id = Math.floor(Math.random() * 898)
	let p = {}

	let shiny = (Math.random() < .01)
	let spriteType = shiny ? "front_shiny" : "front_default"

	// Access the PokeAPI
	return fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
		.then(response => response.json())
		.then(data => {
			p.id = id
			p.sprite = data.sprites[spriteType]
			p.name = data.species.name.charAt(0).toUpperCase() + data.species.name.slice(1)
			return fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.name.toLowerCase()}`)
		})
		.then(response => response.json())
		.then(data => {
			p.captureRate = Math.max(data.capture_rate, 25)
			p.fleeRate = 25
			p.shiny = shiny
			p.name = shiny ? "Shiny " + p.name : p.name
			return p
		})
}

async function beginEncounter(landmark) {
	if (gameState.pokemonEncounter) return
	gameState.pokemonEncounter = true

	let pokemon = landmark.pokemon
	logMsg(`Whoa! You encountered a wild ${pokemon.name}!`)
	gameState.pokemonEncounter = {
		landmark: landmark,
		pokemon: pokemon,
		modifiers: {
			escape: 0,
			catch: 0,
		}
	}
}

function endEncounter(method) {
	if (!gameState.pokemonEncounter) return
	let pokemon = gameState.pokemonEncounter.pokemon
	let landmark = gameState.pokemonEncounter.landmark

	if (method == "caught") {
		logMsg(`Nice! You caught the wild ${pokemon.name}!`)
		gameState.pokemonCaught.push(pokemon)
	}

	if (method == "fleed") {
		logMsg(`Oh no! The wild ${pokemon.name} got away!`)
	}

	if (method == "ran") {
		logMsg(`You ran away from the encounter with the wild ${pokemon.name}!`)
	}

	// Remove Pokemon landmark from map
	let landmarkId = map.landmarks.findIndex(mark => mark == landmark) 
	map.landmarks.splice(landmarkId, 1)
	map.markerLayer.getSource().removeFeature(landmark.marker)

	gameState.pokemonEncounter = false
}

function pokemonEscaped(pkmn, modifiers) {
	let escapeMultiplier = (modifiers.escape >= 0) ? (2 + modifiers.escape) / 2 : 2 / (2 + Math.abs(modifiers.escape))
	return Math.random() * 255 < (pkmn.fleeRate * escapeMultiplier)
}

function pokemonCaught(pkmn, modifiers, ballType) {
	let catchMultiplier = (modifiers.catch >= 0) ? (2 + modifiers.catch) / 2 : 2 / Math.abs((2 + modifiers.catch))
	let ballMultiplier = (ballType == "Great Ball") ? 1.5 : (ballType == "Ultra Ball") ? 2 : (ballType == "Master Ball") ? 1000000 : 1
 	return Math.random() * 255 < (0.5 * pkmn.captureRate * catchMultiplier * ballMultiplier)
}

function boundModifiers(modifiers) {
	for (const mod in modifiers) {
		if (modifiers[mod] < -6) {
			modifiers[mod] = -6
		}
		if (modifiers[mod] > 6) {
			modifiers[mod] = 6
		}
	}
}

function throwBait() {
	if (!gameState.pokemonEncounter) return
	let encounter = gameState.pokemonEncounter
	let pkmn = gameState.pokemonEncounter.pokemon

	logMsg(`You threw some bait near ${pkmn.name}!`)
	encounter.modifiers.escape -= 1
	if (Math.random() < .75) encounter.modifiers.catch -= 1;
	boundModifiers(encounter.modifiers)
	logMsg(`${pkmn.name} nibbles at the bait...`)
	if (pokemonEscaped(pkmn, encounter.modifiers)) {
		endEncounter("fleed")
	} else {
		logMsg(`${pkmn.name} looks at you intently...`)
	}
}

function throwMud() {
	if (!gameState.pokemonEncounter) return
	let encounter = gameState.pokemonEncounter
	let pkmn = gameState.pokemonEncounter.pokemon

	logMsg(`You threw some mud at ${pkmn.name}!`)
	encounter.modifiers.catch += 1
	if (Math.random() < .75) encounter.modifiers.escape += 1;
	boundModifiers(encounter.modifiers)
	logMsg(`${pkmn.name} is taken aback!`)
	if (pokemonEscaped(pkmn, encounter.modifiers)) {
		endEncounter("fleed")
	} else {
		logMsg(`${pkmn.name} looks at you intently...`)
	}
}

function throwBall(ballType="Pokeball") {
	if (!gameState.pokemonEncounter) return
	let encounter = gameState.pokemonEncounter
	let pkmn = gameState.pokemonEncounter.pokemon

	if (ballType != "Pokeball") {
		let stock = gameState.inventory[ballType + 's']
		if (stock == 0) {
			logMsg(`You don't have any more ${ballType}!`)
			logMsg(`${pkmn.name} looks at you intently...`)
			return
		} 
	}

	logMsg(`You threw a ${ballType} at at ${pkmn.name}!`)
	gameState.inventory[ballType + 's'] -= 1
	if (pokemonCaught(pkmn, encounter.modifiers, ballType)) {
		endEncounter("caught")
		return
	} else {
		logMsg(`Dang it! The ${ballType} failed!`)
		if (pokemonEscaped(pkmn, encounter.modifiers)) {
			endEncounter("fleed")
			return
		} 
	}

	logMsg(`${pkmn.name} looks at you intently...`)
}

function getLoot(landmark) {
	let loot, quantity
	if (Math.random() < .3) {
		loot = 'Ultra Balls'
		quantity = Math.floor(5 * Math.random())
	} else {
		loot = 'Great Balls'
		quantity = Math.floor(10 * Math.random())
	}

	gameState.inventory[loot] += quantity
	logMsg(`You found ${quantity} ${loot} in ${landmark.name}!`)
}
