export const jsx = (
  <Show expr={'a + b * 2'}>
    <div>ok</div>
  </Show>
);

export const expected = {
  component: 'Show',
  props: {
    expr: {
      '+': [{ var: 'a' }, { '*': [{ var: 'b' }, 2] }],
    },
  },
  children: {
    component: 'div',
    children: 'ok',
  },
};

export const name = 'arithmetic';
