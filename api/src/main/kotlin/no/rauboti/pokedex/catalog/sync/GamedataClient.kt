package no.rauboti.pokedex.catalog.sync

interface GamedataClient {
    /** The full Pokédex feed as raw JSON (a JSON array of species objects). */
    fun fetchPokedex(): String
}