export const jsx = (
  <Show when={'a === b && c === d'} fallback={<div>fallback</div>}>
    <div>text</div>
  </Show>
);

export const expected = {
  component: 'Show',
  props: {
    when: {
      and: [
        { '===': [{ var: 'a' }, { var: 'b' }] },
        { '===': [{ var: 'c' }, { var: 'd' }] },
      ],
    },
    fallback: {
      component: 'div',
      children: 'fallback',
    },
  },
  children: {
    component: 'div',
    children: 'text',
  },
};

export const name = 'render-basic';
