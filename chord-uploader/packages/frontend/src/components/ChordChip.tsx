import { Chip } from '@mui/material';

interface Props {
  value: string;
}

export default function ChordChip({ value }: Props) {
  return (
    <Chip
      label={value}
      size="small"
      color="primary"
      sx={{
        fontFamily: 'monospace',
        fontWeight: 'bold',
        fontSize: '0.75rem',
        height: 22,
        mx: 0.25,
        verticalAlign: 'middle',
      }}
    />
  );
}
