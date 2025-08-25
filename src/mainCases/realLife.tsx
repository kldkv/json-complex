// Здесь импорт откуда не сильно важен, так как для пользователя это проверка пропсов на типы с помощью typescript (tsx)
// А для рендеринга это не имеет значения, так как главное взять название компонента и пропсы
import { Typography } from '@mui/material';

export const name = 'realLife';
export const description = 'Real life example';
export const data = {
  title: '{{hello}}',
};

export default () => {
  return (
    <div>
      <Typography>{'{{data.title}}'}</Typography>
      <Typography>world</Typography>
    </div>
  );
};
