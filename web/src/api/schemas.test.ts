import { describe, expect, it } from 'vitest'
import { moveSchema, pokemonSchema } from './schemas'

/**
 * Contract-shape guards for the wire types the mocks don't exercise. Regression for the collection
 * failing to load: the api serializes a **recorded** move's `legacy` as `null` (Jackson includes
 * the null field), and the Pokémon list/detail/patch responses all carry those recorded moves — so
 * `moveSchema` must accept `legacy: null`, not just an absent field. MSW fixtures only ever set
 * `legacy: true` or omit it, which is why this needed a schema-level test.
 */

const recordedMove = {
  id: 'SACRED_SWORD',
  name: 'Sacred Sword',
  type: 'Fighting',
  fast: false,
  legacy: null,
}

describe('moveSchema', () => {
  it('accepts a recorded move with legacy null (the real api shape)', () => {
    expect(moveSchema.parse(recordedMove).legacy).toBeNull()
  })

  it('still accepts a pool move with a real legacy boolean and an absent field', () => {
    expect(moveSchema.parse({ ...recordedMove, legacy: true }).legacy).toBe(
      true,
    )
    const withoutLegacy = {
      id: 'VINE_WHIP_FAST',
      name: 'Vine Whip',
      type: 'Grass',
      fast: true,
    }
    expect(moveSchema.parse(withoutLegacy).legacy).toBeUndefined()
  })
})

describe('pokemonSchema', () => {
  it('parses a Pokémon whose recorded moves carry legacy null', () => {
    const pokemon = {
      id: '45b5c597-79c1-421f-97f2-6f32c8f61ea7',
      species: {
        id: 'TERRAKION',
        dexNr: 639,
        name: 'Terrakion',
        form: null,
        types: ['Rock', 'Fighting'],
        baseAtk: 260,
        baseDef: 192,
        baseSta: 209,
        syncedAt: '2026-07-28T09:00:00Z',
      },
      ivAtk: 15,
      ivDef: 15,
      ivSta: 15,
      cp: 3721,
      flags: {
        shiny: false,
        shadow: false,
        lucky: false,
        purified: false,
        bestBuddy: false,
      },
      moves: {
        fast: {
          id: 'DOUBLE_KICK_FAST',
          name: 'Double Kick',
          type: 'Fighting',
          fast: true,
          legacy: null,
        },
        charged1: recordedMove,
        charged2: {
          id: 'EARTHQUAKE',
          name: 'Earthquake',
          type: 'Ground',
          fast: false,
          legacy: null,
        },
      },
      derived: {
        level: 40.5,
        hp: 160,
        attack: 220,
        defense: 180,
        stamina: 190,
        ivPercent: 100,
        perfect: true,
        projections: [],
      },
      stale: false,
      caughtAt: null,
      createdAt: '2026-07-28T12:00:00Z',
    }
    expect(() => pokemonSchema.parse(pokemon)).not.toThrow()
  })
})
