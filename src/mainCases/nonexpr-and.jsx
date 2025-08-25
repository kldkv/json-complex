export const jsx = (
  <Show text={'a and b'}>
    <div>ok</div>
  </Show>
);

export const expected = {
  component: 'Show',
  props: {
    text: 'a and b',
  },
  children: {
    component: 'div',
    children: 'ok',
  },
};

export const name = 'nonexpr-and';
