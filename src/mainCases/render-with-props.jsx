export const jsx = (
  <Show
    when={'a === {{data.b}} && c === {{data.c}}'}
    fallback={<div>fallback</div>}
  >
    <div>text</div>
  </Show>
);

export const expected = {
  component: 'Show',
  props: {
    when: {
      and: [
        { '===': [{ var: 'a' }, { var: '{{data.b}}' }] },
        { '===': [{ var: 'c' }, { var: '{{data.c}}' }] },
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

export const name = 'render-with-props';
