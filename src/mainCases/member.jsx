export const jsx = (
  <Show path={'user.age'}>
    <div>ok</div>
  </Show>
);

export const expected = {
  component: 'Show',
  props: {
    path: { var: 'user.age' },
  },
  children: {
    component: 'div',
    children: 'ok',
  },
};

export const name = 'member';
