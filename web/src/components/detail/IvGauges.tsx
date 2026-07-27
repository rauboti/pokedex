import { Box, Stack, Text } from '@chakra-ui/react'
import { Grid } from '@rauboti/ui'
import Highcharts from 'highcharts'
import 'highcharts/highcharts-more'
import 'highcharts/modules/solid-gauge'
import { HighchartsReact } from 'highcharts-react-official'

/**
 * The per-stat IV breakdown as Pokémon GO-style KPI gauges (Highcharts solid-gauge, mirroring the
 * "multiple KPI" demo) — Attack / Defense / Stamina, each 0–15. The gauge arc is decorative
 * (`aria-hidden`); the value and label are real text beneath it, so the number stays themed by the
 * app and available to screen readers. Values come straight from the DTO (no client math, research D7).
 *
 * NOTE: Highcharts is used directly here for now; it (and the Grid in [ProjectionsGrid]) is slated to
 * be lifted behind a shared charting wrapper later.
 */

const IV_MAX = 15

const gaugeOptions = (value: number): Highcharts.Options => ({
  chart: {
    type: 'solidgauge',
    height: 96,
    backgroundColor: 'transparent',
    margin: [0, 0, 0, 0],
    spacing: [0, 0, 0, 0],
  },
  title: { text: undefined },
  credits: { enabled: false },
  tooltip: { enabled: false },
  accessibility: { enabled: false },
  pane: {
    center: ['50%', '55%'],
    size: '100%',
    startAngle: -120,
    endAngle: 120,
    background: [
      {
        backgroundColor: 'rgba(128, 128, 128, 0.2)',
        borderWidth: 0,
        innerRadius: '65%',
        outerRadius: '100%',
        shape: 'arc',
      },
    ],
  },
  yAxis: {
    min: 0,
    max: IV_MAX,
    lineWidth: 0,
    tickWidth: 0,
    tickPositions: [],
    labels: { enabled: false },
    // Red → yellow → green by fraction of the 45-point-per-stat ceiling.
    stops: [
      [0.5, '#df5353'],
      [0.75, '#dddf0d'],
      [0.95, '#55bf3b'],
    ],
  },
  plotOptions: {
    solidgauge: { innerRadius: '65%', dataLabels: { enabled: false } },
  },
  series: [{ type: 'solidgauge', data: [value] }],
})

const IvGauge = ({ label, value }: { label: string; value: number }) => (
  <Stack align="center" gap="0">
    <Box aria-hidden="true" w="full">
      <HighchartsReact highcharts={Highcharts} options={gaugeOptions(value)} />
    </Box>
    <Text fontWeight="semibold" lineHeight="1">
      {value}
    </Text>
    <Text fontSize="xs" color="text.muted">
      {label}
    </Text>
  </Stack>
)

export const IvGauges = ({
  ivAtk,
  ivDef,
  ivSta,
}: {
  ivAtk: number
  ivDef: number
  ivSta: number
}) => (
  <Grid columns={3} gap="3">
    <IvGauge label="Atk" value={ivAtk} />
    <IvGauge label="Def" value={ivDef} />
    <IvGauge label="Sta" value={ivSta} />
  </Grid>
)
