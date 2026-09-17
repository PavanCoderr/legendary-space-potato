// @vitest-environment jsdom
import { act } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { describe, it, beforeEach, afterEach } from 'vitest';
import { App } from './App';
import { StoreProvider } from './state/StoreProvider';

function mount(hash: string) {
  window.location.hash = hash;
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});
afterEach(cleanup);

describe('Debug signup', () => {
  it('logs what happens during signup', async () => {
    mount('#/signup');
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Sam Lee' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'sam@university.edu' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'quantum123' } });
    fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create account and start learning/i }));
      await new Promise(resolve => setTimeout(resolve, 800));
    });

    console.log('HASH after signup:', window.location.hash);
    console.log('BODY contains Sam Lee?', document.body.textContent.includes('Sam Lee'));
    console.log('BODY contains Alex Rivera?', document.body.textContent.includes('Alex Rivera'));
    console.log('BODY contains Welcome back?', document.body.textContent.includes('Welcome back'));
    console.log('BODY snippet:', document.body.textContent.slice(0, 200));
  });
});
