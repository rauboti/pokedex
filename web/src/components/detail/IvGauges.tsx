import { Box, Stack, Text } from '@chakra-ui/react'
import { Grid } from '@rauboti/ui'
import Highcharts from 'highcharts'
import 'highcharts/highcharts-more'
import 'highcharts/modules/solid-gauge'
import { HighchartsReact } from 'highcharts-react-official'

/**
 * Per-stat IV gauges (Attack / Defense / Stamina, each 0–15). The arc is decorative (`aria-hidden`);
 * the value and label are real text beneath it, so the number stays themed and screen-reader visible.
 *
 * NOTE: this is the only Highcharts use in the app, and it postdates research D4's "no charting"
 * decision — see the web README's "Charting". Slated to move behind a shared wrapper.
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
