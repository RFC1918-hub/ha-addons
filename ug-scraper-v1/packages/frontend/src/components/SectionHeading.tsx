import { Typography } from '@mui/material';

interface Props {
  text: string;
}

export default function SectionHeading({ text }: Props) {
  return (
    <Typography
      variant="subtitle1"
      component="div"
      sx={{
        fontWeight: 'bold',
        color: 'secondary.main',
        mt: 2,
        mb: 0.5,
      }}
    >
      [{text}]
    </Typography>
  );
}
