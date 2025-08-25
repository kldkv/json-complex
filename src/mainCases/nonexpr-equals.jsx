export const jsx = (
  <Show note={'1 item = 1 point'}>
    <div>ok</div>
  </Show>
);

export const expected = {
  component: 'Show',
  props: {
    note: '1 item = 1 point',
  },
  children: {
    component: 'div',
    children: 'ok',
  },
};

export const name = 'nonexpr-equals';
