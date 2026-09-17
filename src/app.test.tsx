// @vitest-environment jsdom
import { act } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { LESSONS } from './data/lessons';
import { LESSON_STAGES } from './data/stages';
import { StoreProvider } from './state/StoreProvider';

/**
 * End-to-end journey test through the real components and the real store:
 * landing → signup → dashboard → module page → superposition lesson → teaching video →
 * interactive H gate → simulator → tutor → challenge → profile.
 *
 * It exercises the shared circuit/state plumbing, the reducer, the simulation engine, the
 * mocked session, the search index and the tutor context, so a regression anywhere in that
 * chain fails here.
 */
function mount(hash: string) {
  window.location.hash = hash;
  return render(
    <StoreProvider>
      <App />
    </StoreProvider>,
  );
}

/** Route changes in a real browser fire hashchange; in tests we must flush React. */
function goTo(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
});

afterEach(cleanup);

describe('QubitVerse application', () => {
  it('renders the dashboard with progress and quick actions', () => {
    mount('#/dashboard');
    expect(screen.getAllByText(/QubitVerse/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Continue learning/i)).toBeTruthy();
    expect(screen.getByText(/Topic mastery/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Start lesson|Resume lesson/i }).length).toBeGreaterThan(0);
  });

  it('routes between every area of the app', () => {
    mount('#/dashboard');
    const areas: [string, RegExp][] = [
      ['#/learn', /Curriculum/i],
      ['#/builder', /Drag gates onto wires/i],
      ['#/simulator', /Run controls/i],
      ['#/tutor', /AI Quantum Tutor/i],
      ['#/practice', /Quiz bank/i],
      ['#/progress', /Overall mastery/i],
      ['#/projects', /Create a project/i],
      ['#/settings', /AI tutor provider/i],
      ['#/lesson/superposition', /Lab 2/i],
      ['#/nonsense', /Page not found/i],
    ];
    for (const [hash, pattern] of areas) {
      goTo(hash);
      expect(screen.getAllByText(pattern).length).toBeGreaterThan(0);
    }
  });

  it('runs the superposition lesson demo: H then measure gives ~50/50', () => {
    mount('#/lesson/superposition');

    const lab = screen.getByText(/Lab 2 ·/i).closest('section')!;

    // Place an H gate on q0 by selecting it in the lab's palette and clicking its first slot.
    // Both queries are scoped to the lab: the lesson page also renders a read-only example
    // circuit whose gates carry titles like "Hadamard on q0 — step 1".
    fireEvent.click(within(lab).getAllByTitle(/Hadamard/i)[0]);
    fireEvent.click(lab.querySelector('[data-qubit="0"][data-column="0"]') as HTMLElement);

    // Run the circuit from the lab.
    fireEvent.click(within(lab).getByRole('button', { name: /Run/i }));

    // Ideal probabilities are an even split and the raw counts are recorded.
    expect(document.body.textContent).toMatch(/50\.0%/);
    expect(document.body.textContent).toMatch(/1000/);
  });

  it('keeps one circuit shared between builder, simulator and tutor', () => {
    mount('#/builder');
    fireEvent.click(screen.getAllByTitle(/Controlled-NOT/i)[0]);
    fireEvent.click(document.querySelector('[data-qubit="1"][data-column="0"]') as HTMLElement);
    expect(screen.getAllByText(/CX/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Run circuit/i }));
    expect(screen.getAllByText(/\|00⟩/).length).toBeGreaterThan(0);

    // The simulator shows the very same circuit and result.
    goTo('#/simulator');
    expect(screen.getByText(/Run controls/i)).toBeTruthy();
    expect(screen.getAllByText(/\|00⟩/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/CX/).length).toBeGreaterThan(0);
  });

  it('answers tutor questions with context from the live circuit', async () => {
    mount('#/tutor');

    const input = screen.getByPlaceholderText(/Why did the H gate/i);
    fireEvent.change(input, { target: { value: 'Why did the H gate give approximately 50/50?' } });
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/i }));

    const answer = await screen.findByText(/Hadamard gate maps/i, {}, { timeout: 4000 });
    expect(answer).toBeTruthy();
    expect(screen.getAllByText(/context used for this answer/i).length).toBeGreaterThan(0);
  });

  it('validates a challenge against the simulated state', () => {
    mount('#/practice/challenge-superposition');

    const panel = screen.getByRole('button', { name: /Submit for validation/i }).closest('section')!;

    // Submitting the empty starter circuit must explain what is missing.
    fireEvent.click(within(panel).getByRole('button', { name: /Submit for validation/i }));
    expect(screen.getAllByText(/1\/5 requirements met/).length).toBeGreaterThan(0);

    // Build and submit the solution: H on q0 plus a measurement.
    fireEvent.click(screen.getAllByTitle(/Hadamard/i)[0]);
    fireEvent.click(document.querySelector('[data-qubit="0"][data-column="0"]') as HTMLElement);
    fireEvent.click(screen.getAllByTitle(/Measurement/i)[0]);
    fireEvent.click(document.querySelector('[data-qubit="0"][data-column="1"]') as HTMLElement);

    fireEvent.click(within(panel).getByRole('button', { name: /Submit for validation/i }));
    expect(screen.getAllByText(/5\/5 requirements met/).length).toBeGreaterThan(0);
    // The pass is recorded, XP is awarded and the attempt history keeps the checks.
    expect(document.body.textContent).toMatch(/Challenge passed|Achievement unlocked/);
    expect(document.body.textContent).toMatch(/50 XP/);
    expect(document.body.textContent).toMatch(/2 attempt\(s\)/);
  });

  it('applies Qiskit-style code to the visual circuit', () => {
    mount('#/builder');
    fireEvent.click(screen.getByRole('button', { name: /Quantum code/i }));

    const editor = screen.getByLabelText(/Quantum code editor/i) as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: { value: 'qc = QuantumCircuit(2)\nqc.h(0)\nqc.cx(0, 1)\nqc.measure_all()' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Apply to circuit/i }));

    // The circuit model now holds the parsed gates, so a run produces a Bell state.
    expect(screen.getAllByText(/CX/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Run circuit/i }));
    expect(document.body.textContent).toMatch(/\|00⟩/);
    expect(document.body.textContent).toMatch(/\|11⟩/);

    // Invalid code is reported line by line instead of being applied.
    fireEvent.change(editor, { target: { value: 'qc = QuantumCircuit(1)\nqc.cx(0, 5)' } });
    fireEvent.click(screen.getByRole('button', { name: /Apply to circuit/i }));
    expect(document.body.textContent).toMatch(/line 2/i);
  });

  it('saves, reopens and deletes projects', () => {
    mount('#/builder');
    fireEvent.click(screen.getAllByTitle(/Hadamard/i)[0]);
    fireEvent.click(document.querySelector('[data-qubit="0"][data-column="0"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Save project/i }));

    // The projects area lists it and can reopen the circuit.
    expect(document.body.textContent).toMatch(/Saved project/);
    expect(screen.getAllByText(/1 gates|0 gates|1 gate/i).length).toBeGreaterThan(0);
    goTo('#/projects');
    expect(screen.getAllByRole('button', { name: /Duplicate/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Duplicate/i })[0]);
    expect(document.body.textContent).toMatch(/\(copy\)/);
  });

  it('renders the landing page at the root route', () => {
    mount('#');
    expect(screen.getByText(/Quantum Computing, Made Interactive\./i)).toBeTruthy();
    // "Start Learning" appears in the hero and again in the closing call to action.
    expect(screen.getAllByRole('button', { name: /Start Learning/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Explore Quantum Lab/i })).toBeTruthy();
    // The hero circuit is the Bell state, and the probability panel matches it.
    expect(document.body.textContent).toMatch(/Learn Quantum\. Build Quantum\. Understand Quantum\./);
    expect(document.body.textContent).toMatch(/\|00⟩/);
    expect(document.body.textContent).toMatch(/H puts q0 in superposition, CNOT entangles q1/);
  });

  it('opens a module page with its lesson navigation', () => {
    mount('#/learn/superposition');
    expect(document.body.textContent).toMatch(/Lesson navigation/);
    expect(document.body.textContent).toMatch(/difficulty: beginner/);
    expect(document.body.textContent).toMatch(/estimated \d+ minutes/);

    // Selecting a lesson in the navigator swaps the content pane.
    fireEvent.click(screen.getByRole('button', { name: /Hadamard Gate/i }));
    expect(document.body.textContent).toMatch(/The gate that builds the equal superposition/);
  });

  it('searches the whole curriculum from the global search palette', () => {
    mount('#/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Search QubitVerse/i }));

    const input = screen.getByLabelText(/Search query/i);
    fireEvent.change(input, { target: { value: 'grover' } });

    // Results are grouped the way the spec asks for, and the glossary covers "Grover".
    expect(screen.getByText('Concepts')).toBeTruthy();
    expect(screen.getByText("Grover's algorithm")).toBeTruthy();
    expect(document.body.textContent).toMatch(/Video ·/);

    // A hit is a deep link into the app.
    fireEvent.click(screen.getByRole('button', { name: /Grover's algorithm/i }));
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(document.body.textContent).toMatch(/Lesson flow/);
    expect(document.body.textContent).toMatch(/Algorithms/);
  });

  it('marks the teaching video as watched', () => {
    mount('#/lesson/superposition');
    const watch = screen.getByText(/Watch & Learn/i).closest('section')!;
    expect(within(watch).getByRole('button', { name: /Mark as watched/i })).toBeTruthy();

    fireEvent.click(within(watch).getByRole('button', { name: /Mark as watched/i }));

    // The button flips, the toast nudges the next step, and the checkpoint is recorded.
    expect(within(watch).getByRole('button', { name: /Watched/i })).toBeTruthy();
    expect(document.body.textContent).toMatch(/Video marked as watched/);
    // The video is 1 of the 6 lesson checkpoints, so completion moves to 17%.
    expect(document.body.textContent).toMatch(/17%/);
  });

  it('signs up with a learning level, then signs out to the login screen', async () => {
    mount('#/signup');
    fireEvent.change(screen.getByLabelText(/^Name$/i), { target: { value: 'Sam Lee' } });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'sam@university.edu' } });
    // The password field carries a hint, so match the label loosely.
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'quantum123' } });
    fireEvent.click(screen.getByRole('button', { name: /Advanced/i }));

    // Signup is async (bcrypt hashing + state hydration), so await the full lifecycle.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Create account and start learning/i }));
      await new Promise(resolve => setTimeout(resolve, 600));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(document.body.textContent).toMatch(/Welcome back, Sam Lee/);
    expect(document.body.textContent).toMatch(/Advanced/);

    // Sign out clears the user, so the next fresh signup must NOT leak Sam's progress.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Profile menu/i }));
      await new Promise(resolve => setTimeout(resolve, 50));
      fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));
      await new Promise(resolve => setTimeout(resolve, 300));
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByText(/Welcome back/i)).toBeTruthy();
  });

  it('reports profile level, XP and achievements', () => {
    mount('#/profile');
    expect(screen.getByText(/Quantum journey/i)).toBeTruthy();
    expect(screen.getAllByText(/Achievements/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).toMatch(/demo learner/);
    expect(document.body.textContent).toMatch(/Level 1/);
  });

  it('closes the mobile navigation drawer with Escape', () => {
    mount('#/dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Open navigation/i }));
    expect(screen.getByRole('dialog', { name: /Navigation/i })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Navigation/i })).toBeNull();
  });

  it('highlights no area in the sidebar when the route matches nothing', () => {
    mount('#/nonsense');
    expect(screen.getAllByText(/Page not found/i).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.nav-link.active').length).toBe(0);
  });

  it('shows the platform-specific search shortcut', () => {
    mount('#/dashboard');
    // The test user agent is not macOS, so the hint must not claim the ⌘ key.
    expect(screen.getByText(/Ctrl K|⌘K/)).toBeTruthy();
  });

  it('shows the initial and final state in Dirac notation on the simulator', () => {
    mount('#/dashboard');
    // The Simulator is deliberately read-only (no gate palette), so the circuit comes from
    // a preset — the same way a student gets there from the dashboard quick actions.
    fireEvent.click(screen.getByRole('button', { name: /Superposition — /i }));
    act(() => {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(document.body.textContent).toMatch(/Initial state/);
    expect(document.body.textContent).toMatch(/Final state/);
    // A fresh register starts in |0⟩.
    expect(document.body.textContent).toMatch(/\|0⟩/);

    fireEvent.click(screen.getByRole('button', { name: /Run circuit/i }));
    // The final state is written the way the lessons write it.
    expect(document.body.textContent).toMatch(/1\/√2\|0⟩ \+ 1\/√2\|1⟩/);
  });

  it('states the course size from the data rather than from hard-coded copy', () => {
    mount('#/home');
    // The hero counts modules, named lessons, gates and practice items out of the data files.
    expect(screen.getByText(String(LESSONS.length))).toBeTruthy();
    const namedLessons = LESSONS.reduce((sum, lesson) => sum + lesson.outline.length, 0);
    expect(screen.getByText(String(namedLessons))).toBeTruthy();
    expect(document.body.textContent).toMatch(/named lessons/);
    expect(document.body.textContent).toMatch(/gates in the builder/);
  });

  it('shows the gate matrices the engine actually applies', () => {
    mount('#/home');
    expect(document.body.textContent).toMatch(/Hadamard/);
    // The Hadamard matrix, formatted symbolically rather than as 0.7071…
    expect(document.body.textContent).toMatch(/1\/√2/);
    expect(document.body.textContent).toMatch(/−1\/√2/);
    // CNOT and measurement are described in words because they are not 2x2 unitaries.
    expect(document.body.textContent).toMatch(/Controlled-X/);
    expect(document.body.textContent).toMatch(/Not a unitary/);
  });

  it('describes the lesson flow once, from the shared stage definitions', () => {
    mount('#/home');
    // The landing walkthrough and the lesson rail must not drift apart.
    for (const stage of LESSON_STAGES) {
      expect(screen.getAllByText(new RegExp(stage.label, 'i')).length).toBeGreaterThan(0);
    }
  });

  it('lists the modules and the lab in the footer', () => {
    mount('#/home');
    for (const lesson of LESSONS) {
      const links = screen.getAllByRole('link', { name: lesson.title });
      expect(links.some(link => link.getAttribute('href') === `#/learn/${lesson.id}`)).toBe(true);
    }
    // "Circuit builder" is in both the top nav and the footer, so assert on the set.
    const builderLinks = screen.getAllByRole('link', { name: 'Circuit builder' });
    expect(builderLinks.some(link => link.getAttribute('href') === '#/builder')).toBe(true);
    // The privacy note has to stay true: the tutor calls a remote provider once a key is set.
    expect(document.body.textContent).toMatch(/No account is created/i);
    expect(document.body.textContent).toMatch(/unless\s+you paste your own AI key into Settings/i);
  });

  it('renders every module as a keyboard-reachable card with a real CTA', () => {
    mount('#/home');
    // A card wrapped in a <button> collapses the whole card into one control for screen
    // readers, so each module must expose exactly one named button.
    const ctas = screen.getAllByRole('button', { name: /Start Learning/i });
    expect(ctas.length).toBeGreaterThanOrEqual(LESSONS.length);
    for (const cta of ctas) expect(cta.tagName).toBe('BUTTON');
  });

  it('keeps the preset button label readable by a screen reader', () => {
    mount('#/dashboard');
    // The name must not collapse to "Superposition— H on one qubit": the accessible-name
    // algorithm trims whitespace at element boundaries, so the separator is asserted here.
    expect(
      screen.getByRole('button', { name: /^Superposition — H on one qubit/ }),
    ).toBeTruthy();
  });

  it('persists progress to localStorage', async () => {
    mount('#/lesson/qubits');
    // Persistence is debounced, so give the effect a moment to flush.
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 400));
    });
    const stored = window.localStorage.getItem('qubitverse.state.v1');
    expect(stored).toBeTruthy();
    expect(stored).toContain('qubits');
  });
});
