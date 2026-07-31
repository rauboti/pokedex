import { Table } from '@chakra-ui/react'

/**
 * Shared by the current stats and the level projections, so both keep identical columns. Rows are
 * forced transparent because the `line` variant otherwise fills them with the solid `bg` token.
 */

export type StatRow = {
  /** e.g. `Current`, `L40`, `Best Buddy`. */
  target: string
  level: number
  cp: number
  hp: number
  attack: number
  defense: number
  stamina: number
}

/** Effective stats are fractional, level/CP/HP whole — drop a trailing `.0`. */
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1))

export const StatTable = ({ rows }: { rows: StatRow[] }) => (
  <Table.ScrollArea borderWidth="1px" borderColor="border" rounded="md">
    {/* The `line` variant fills each row with the solid `bg` token (near-black in dark mode);
        keep its borders but let the Card surface show through. */}
    <Table.Root
      size="sm"
      variant="line"
      css={{ '& tr': { background: 'transparent' } }}
    >
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader>Target</Table.ColumnHeader>
          <Table.ColumnHeader>Level</Table.ColumnHeader>
          <Table.ColumnHeader>CP</Table.ColumnHeader>
          <Table.ColumnHeader>HP</Table.ColumnHeader>
          <Table.ColumnHeader>Atk</Table.ColumnHeader>
          <Table.ColumnHeader>Def</Table.ColumnHeader>
          <Table.ColumnHeader>Sta</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {rows.map((r) => (
          <Table.Row key={r.target}>
            <Table.Cell fontWeight="medium">{r.target}</Table.Cell>
            <Table.Cell>{r.level}</Table.Cell>
            <Table.Cell>{r.cp}</Table.Cell>
            <Table.Cell>{r.hp}</Table.Cell>
            <Table.Cell>{fmt(r.attack)}</Table.Cell>
            <Table.Cell>{fmt(r.defense)}</Table.Cell>
            <Table.Cell>{fmt(r.stamina)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  </Table.ScrollArea>
)
