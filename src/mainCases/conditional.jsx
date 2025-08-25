export const jsx = (
  <Show cond={"x ? 'yes' : 'no'"}>
    <div>ok</div>
  </Show>
);

export const expected = {
  component: 'Show',
  props: {
    cond: {
      if: [{ var: 'x' }, 'yes', 'no'],
    },
  },
  children: {
    component: 'div',
    children: 'ok',
  },
};

export const name = 'conditional';
